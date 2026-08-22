import { Injectable } from '@nestjs/common';
import { Prisma, RideSurchargeTrigger, RideSurchargeType, RideType } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import { haversineMeters } from './ride-geo';
import { RIDE_AUDIT_ACTIONS, RIDE_FARE_RATES, RIDE_MINIMUM_FARE } from './ride.constants';

import type { RideFareRate, RideSurchargeZone } from '@prisma/client';

/** What a zone added to one particular trip, resolved to naira. */
export interface AppliedSurcharge {
  zoneId: string;
  zoneName: string;
  amount: number;
}

export interface FareRateValues {
  baseFare: number;
  perKmRate: number;
  perMinuteRate: number;
  minimumFare: number;
}

/**
 * The Ops-editable ride fare table and surcharge zones.
 *
 * Fares used to be `RIDE_FARE_RATES`, a constant that carried its own warning
 * that it was "not a founder-approved fare table" — changing a price meant a
 * code change and a deploy, and charging more for an airport run was not
 * possible at all.
 *
 * The database row is the source of truth from first creation onward; the
 * constants only seed it, the same shape as
 * `PlatformCommissionSettingsService`. Every edit is audit-logged with the
 * before and after, because a fare change is a commercial act.
 *
 * Editing a rate never re-prices a trip that has already happened: each ride
 * snapshots the amounts it was priced at, including the surcharge and the name
 * of the zone that caused it.
 */
@Injectable()
export class RidePricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ── Fare rates ────────────────────────────────────────────────────────────

  /**
   * Rates for one ride type, seeding the row from the constants on first
   * touch.
   *
   * The seed can be hit concurrently by two racing first-ever fare estimates;
   * the primary key lets exactly one create win, and the loser reads the row
   * the winner just wrote. A pricing call is never failed by the seed race —
   * the same money-path safety the commission setting uses.
   */
  public async getRate(rideType: RideType): Promise<FareRateValues> {
    const existing = await this.prisma.rideFareRate.findUnique({ where: { rideType } });
    if (existing) {
      return toRateValues(existing);
    }

    const seed = RIDE_FARE_RATES[rideType];
    try {
      const created = await this.prisma.rideFareRate.create({
        data: {
          rideType,
          baseFare: seed.baseFare,
          perKmRate: seed.perKmRate,
          perMinuteRate: seed.perMinuteRate,
          minimumFare: RIDE_MINIMUM_FARE,
        },
      });
      return toRateValues(created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const row = await this.prisma.rideFareRate.findUniqueOrThrow({ where: { rideType } });
        return toRateValues(row);
      }
      throw error;
    }
  }

  /** Every rate, seeding any type that has no row yet. Powers the console. */
  public async listRates(): Promise<(FareRateValues & { rideType: RideType })[]> {
    const types = Object.keys(RIDE_FARE_RATES) as RideType[];
    const rates = await Promise.all(
      types.map(async (rideType) => ({ rideType, ...(await this.getRate(rideType)) })),
    );
    return rates;
  }

  public async updateRate(
    rideType: RideType,
    values: FareRateValues,
    adminUserId: string,
    context: AuditContext,
  ): Promise<FareRateValues & { rideType: RideType }> {
    // Seeds the row if this type has never been priced, so an update cannot
    // fail purely because nobody has requested that type yet.
    const before = await this.getRate(rideType);

    const updated = await this.prisma.rideFareRate.update({
      where: { rideType },
      data: {
        baseFare: values.baseFare,
        perKmRate: values.perKmRate,
        perMinuteRate: values.perMinuteRate,
        minimumFare: values.minimumFare,
        updatedBy: adminUserId,
      },
    });

    await this.auditService.record(
      RIDE_AUDIT_ACTIONS.FARE_RATE_UPDATED,
      { ...context, userId: adminUserId },
      {
        resource: 'ride_fare_rates',
        resourceId: rideType,
        // Spelled out field by field rather than spreading FareRateValues:
        // the audit metadata column is JSON, and an interface is not assignable
        // to InputJsonValue. Writing it out also means a later field added to
        // the rate cannot slip into the audit log unreviewed.
        metadata: {
          rideType,
          before: {
            baseFare: before.baseFare,
            perKmRate: before.perKmRate,
            perMinuteRate: before.perMinuteRate,
            minimumFare: before.minimumFare,
          },
          after: {
            baseFare: Number(updated.baseFare),
            perKmRate: Number(updated.perKmRate),
            perMinuteRate: Number(updated.perMinuteRate),
            minimumFare: Number(updated.minimumFare),
          },
          changedBy: adminUserId,
        },
      },
    );

    return { rideType, ...toRateValues(updated) };
  }

  // ── Surcharge zones ───────────────────────────────────────────────────────

  public async listZones(includeInactive = true): Promise<RideSurchargeZone[]> {
    return await this.prisma.rideSurchargeZone.findMany({
      ...(includeInactive ? {} : { where: { active: true } }),
      orderBy: { name: 'asc' },
    });
  }

  public async createZone(
    input: {
      name: string;
      latitude: number;
      longitude: number;
      radiusMeters: number;
      surchargeType: RideSurchargeType;
      amount: number;
      appliesTo: RideSurchargeTrigger;
      excludedRideTypes?: RideType[];
      active?: boolean;
    },
    adminUserId: string,
    context: AuditContext,
  ): Promise<RideSurchargeZone> {
    assertSurchargeAmount(input.surchargeType, input.amount);

    const zone = await this.prisma.rideSurchargeZone.create({
      data: { ...input, active: input.active ?? true, updatedBy: adminUserId },
    });

    await this.auditService.record(
      RIDE_AUDIT_ACTIONS.SURCHARGE_ZONE_CREATED,
      { ...context, userId: adminUserId },
      {
        resource: 'ride_surcharge_zones',
        resourceId: zone.id,
        metadata: { name: zone.name, changedBy: adminUserId },
      },
    );

    return zone;
  }

  public async updateZone(
    zoneId: string,
    input: Partial<{
      name: string;
      latitude: number;
      longitude: number;
      radiusMeters: number;
      surchargeType: RideSurchargeType;
      amount: number;
      appliesTo: RideSurchargeTrigger;
      excludedRideTypes: RideType[];
      active: boolean;
    }>,
    adminUserId: string,
    context: AuditContext,
  ): Promise<RideSurchargeZone> {
    const before = await this.prisma.rideSurchargeZone.findUnique({ where: { id: zoneId } });
    if (!before) {
      throw new NotFoundDomainException('Surcharge zone not found');
    }

    // Validate against the resulting pair, not the submitted fields — changing
    // only the type on a zone whose amount suits the other type would
    // otherwise slip through.
    assertSurchargeAmount(
      input.surchargeType ?? before.surchargeType,
      input.amount ?? Number(before.amount),
    );

    const zone = await this.prisma.rideSurchargeZone.update({
      where: { id: zoneId },
      data: { ...input, updatedBy: adminUserId },
    });

    await this.auditService.record(
      RIDE_AUDIT_ACTIONS.SURCHARGE_ZONE_UPDATED,
      { ...context, userId: adminUserId },
      {
        resource: 'ride_surcharge_zones',
        resourceId: zone.id,
        metadata: {
          before: {
            name: before.name,
            surchargeType: before.surchargeType,
            amount: Number(before.amount),
            radiusMeters: before.radiusMeters,
            appliesTo: before.appliesTo,
            excludedRideTypes: before.excludedRideTypes,
            active: before.active,
          },
          after: {
            name: zone.name,
            surchargeType: zone.surchargeType,
            amount: Number(zone.amount),
            radiusMeters: zone.radiusMeters,
            appliesTo: zone.appliesTo,
            excludedRideTypes: zone.excludedRideTypes,
            active: zone.active,
          },
          changedBy: adminUserId,
        },
      },
    );

    return zone;
  }

  // ── Applying a surcharge to a trip ────────────────────────────────────────

  /**
   * The zone that applies to a trip, if any, resolved to a naira amount.
   *
   * When more than one active zone contains the trip, the one that adds the
   * most is applied and the others are ignored — surcharges are deliberately
   * NOT stacked. A passenger who crosses two overlapping zones should not be
   * charged twice for one journey, and a single predictable line on the
   * receipt is easier to explain than an arithmetic chain.
   *
   * ⚠️ That non-stacking rule is an engineering choice, not a founder
   * decision — recorded in the diff register for confirmation.
   */
  public async resolveSurcharge(
    pickup: { lat: number; lng: number },
    dropoff: { lat: number; lng: number },
    meteredFare: number,
  ): Promise<AppliedSurcharge | null> {
    const zones = await this.prisma.rideSurchargeZone.findMany({ where: { active: true } });

    let best: AppliedSurcharge | null = null;
    for (const zone of zones) {
      if (!zoneContainsTrip(zone, pickup, dropoff)) {
        continue;
      }

      const amount =
        zone.surchargeType === RideSurchargeType.FLAT
          ? Number(zone.amount)
          : // A multiplier is expressed as what the fare becomes (1.25 = a
            // quarter more), so the surcharge is the part above the metered
            // fare. Rounded to whole naira — a receipt cannot show kobo the
            // payment never charges.
            Math.round(meteredFare * (Number(zone.amount) - 1));

      if (amount <= 0) {
        continue;
      }
      if (!best || amount > best.amount) {
        best = { zoneId: zone.id, zoneName: zone.name, amount };
      }
    }

    return best;
  }

  /**
   * The zone, if any, that forbids this ride type from serving this trip.
   *
   * Separate from resolveSurcharge because it answers a different question:
   * not "what does this cost" but "may this vehicle go at all". A tricycle is
   * not permitted onto Kano airport, so a tricycle quote for an airport trip
   * promises a journey that cannot legally be made — and dispatch would then
   * offer it to a tricycle driver who would have to turn back at the gate.
   *
   * Unlike the surcharge, restrictions do not compete: the first zone that
   * forbids the type settles it. There is nothing to pick a maximum of, and a
   * trip barred by any zone is barred.
   */
  public async findExclusion(
    rideType: RideType,
    pickup: { lat: number; lng: number },
    dropoff: { lat: number; lng: number },
  ): Promise<{ zoneId: string; zoneName: string } | null> {
    const zones = await this.prisma.rideSurchargeZone.findMany({
      where: { active: true, excludedRideTypes: { has: rideType } },
    });

    for (const zone of zones) {
      if (zoneContainsTrip(zone, pickup, dropoff)) {
        return { zoneId: zone.id, zoneName: zone.name };
      }
    }
    return null;
  }

  /**
   * Ride types barred from a single point — used by the fare screen, which
   * knows where the passenger is standing before it knows where they are
   * going. A destination-side restriction cannot be seen from here and is
   * caught at estimate time instead.
   */
  public async exclusionsAtPoint(point: { lat: number; lng: number }): Promise<Set<RideType>> {
    const zones = await this.prisma.rideSurchargeZone.findMany({
      where: { active: true, NOT: { excludedRideTypes: { isEmpty: true } } },
    });

    const barred = new Set<RideType>();
    for (const zone of zones) {
      if (zone.appliesTo === RideSurchargeTrigger.DROPOFF) {
        continue; // says nothing about where the passenger is now
      }
      if (
        haversineMeters(Number(zone.latitude), Number(zone.longitude), point.lat, point.lng) <=
        zone.radiusMeters
      ) {
        for (const type of zone.excludedRideTypes) {
          barred.add(type);
        }
      }
    }
    return barred;
  }
}

function toRateValues(row: RideFareRate): FareRateValues {
  return {
    baseFare: Number(row.baseFare),
    perKmRate: Number(row.perKmRate),
    perMinuteRate: Number(row.perMinuteRate),
    minimumFare: Number(row.minimumFare),
  };
}

/**
 * A MULTIPLIER below 1 would quietly discount every trip through the zone, and
 * a negative FLAT would do the same — neither is a surcharge, and both are far
 * more likely to be a typo in the console than an intention.
 */
function assertSurchargeAmount(surchargeType: RideSurchargeType, amount: number): void {
  if (surchargeType === RideSurchargeType.MULTIPLIER && amount < 1) {
    throw new ValidationDomainException(
      'A multiplier surcharge must be at least 1 — a value below 1 would discount the fare',
    );
  }
  if (surchargeType === RideSurchargeType.FLAT && amount < 0) {
    throw new ValidationDomainException('A flat surcharge cannot be negative');
  }
}

function zoneContainsTrip(
  zone: RideSurchargeZone,
  pickup: { lat: number; lng: number },
  dropoff: { lat: number; lng: number },
): boolean {
  const centreLat = Number(zone.latitude);
  const centreLng = Number(zone.longitude);
  const inside = (point: { lat: number; lng: number }): boolean =>
    haversineMeters(centreLat, centreLng, point.lat, point.lng) <= zone.radiusMeters;

  switch (zone.appliesTo) {
    case RideSurchargeTrigger.PICKUP:
      return inside(pickup);
    case RideSurchargeTrigger.DROPOFF:
      return inside(dropoff);
    case RideSurchargeTrigger.EITHER:
      return inside(pickup) || inside(dropoff);
  }
}
