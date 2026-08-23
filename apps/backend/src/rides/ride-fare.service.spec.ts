import { randomUUID } from 'node:crypto';

import { PrismaClient, RideSurchargeTrigger, RideSurchargeType, RideType } from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import { boundingBox, haversineMeters, RideFareService } from './ride-fare.service';
import { RidePricingService } from './ride-pricing.service';
import { RIDE_FARE_RATES, RIDE_MINIMUM_FARE } from './ride.constants';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

describe('haversineMeters', () => {
  it('returns zero for identical coordinates', () => {
    expect(haversineMeters(6.5244, 3.3792, 6.5244, 3.3792)).toBe(0);
  });

  it('computes a plausible distance between two Lagos-area points', () => {
    // Ikeja to Victoria Island, Lagos — roughly 15-20km straight-line
    const meters = haversineMeters(6.6018, 3.3515, 6.4281, 3.4219);
    expect(meters).toBeGreaterThan(15_000);
    expect(meters).toBeLessThan(25_000);
  });
});

describe('boundingBox', () => {
  it('contains every point inside the radius it was built for', () => {
    const centre = { lat: 12.0, lng: 8.5 };
    const box = boundingBox(centre.lat, centre.lng, 5_000);

    // Due north, due east and a diagonal, all comfortably inside 5km.
    for (const point of [
      { lat: 12.04, lng: 8.5 },
      { lat: 12.0, lng: 8.54 },
      { lat: 12.03, lng: 8.53 },
    ]) {
      expect(haversineMeters(centre.lat, centre.lng, point.lat, point.lng)).toBeLessThan(5_000);
      expect(point.lat).toBeGreaterThanOrEqual(box.minLat);
      expect(point.lat).toBeLessThanOrEqual(box.maxLat);
      expect(point.lng).toBeGreaterThanOrEqual(box.minLng);
      expect(point.lng).toBeLessThanOrEqual(box.maxLng);
    }
  });

  it('excludes a point well beyond the radius', () => {
    const box = boundingBox(12.0, 8.5, 5_000);
    // ~22km north — outside the box, so the database never loads it.
    expect(12.2 > box.maxLat).toBe(true);
  });

  it('widens in longitude as latitude increases, because degrees narrow', () => {
    const atEquator = boundingBox(0, 0, 5_000);
    const atSixty = boundingBox(60, 0, 5_000);

    const spread = (box: { minLng: number; maxLng: number }): number => box.maxLng - box.minLng;
    expect(spread(atSixty)).toBeGreaterThan(spread(atEquator));
  });
});

describe('RideFareService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: RideFareService;
  let pricing: RidePricingService;
  const createdZoneIds: string[] = [];

  const IKEJA = { lat: 6.6018, lng: 3.3515 };
  const VICTORIA_ISLAND = { lat: 6.4281, lng: 3.4219 };

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    }) as unknown as PrismaService;

    try {
      await prisma.$connect();
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
      return;
    }

    const auditLogRepository: jest.Mocked<AuditLogRepository> = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    pricing = new RidePricingService(prisma, new AuditService(auditLogRepository));
    service = new RideFareService(pricing);
  });

  afterEach(async () => {
    if (databaseAvailable && createdZoneIds.length > 0) {
      await prisma.rideSurchargeZone.deleteMany({ where: { id: { in: createdZoneIds } } });
      createdZoneIds.length = 0;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createZone(input: {
    name: string;
    centre: { lat: number; lng: number };
    radiusMeters: number;
    surchargeType: RideSurchargeType;
    amount: number;
    appliesTo?: RideSurchargeTrigger;
    active?: boolean;
  }): Promise<string> {
    const zone = await prisma.rideSurchargeZone.create({
      data: {
        name: `${input.name}-${randomUUID()}`,
        latitude: input.centre.lat,
        longitude: input.centre.lng,
        radiusMeters: input.radiusMeters,
        surchargeType: input.surchargeType,
        amount: input.amount,
        appliesTo: input.appliesTo ?? RideSurchargeTrigger.EITHER,
        active: input.active ?? true,
      },
    });
    createdZoneIds.push(zone.id);
    return zone.id;
  }

  it('seeds the fare table from the constants that were in force', async () => {
    if (!databaseAvailable) return;

    // The whole point of the seed: the first fare quoted after fares moved
    // into the database has to match the last one quoted before.
    const rate = await pricing.getRate(RideType.ECONOMY);

    expect(rate.baseFare).toBe(RIDE_FARE_RATES[RideType.ECONOMY].baseFare);
    expect(rate.perKmRate).toBe(RIDE_FARE_RATES[RideType.ECONOMY].perKmRate);
    expect(rate.perMinuteRate).toBe(RIDE_FARE_RATES[RideType.ECONOMY].perMinuteRate);
    expect(rate.minimumFare).toBe(RIDE_MINIMUM_FARE);
  });

  /**
   * The itemised lines must account for the total.
   *
   * The estimate reported base, distance and time and a `totalFare` that could
   * be far larger, because a surcharge zone adds to it and a minimum fare
   * floors it — and neither was reported. A 2km trip quoted ₦300 + ₦198 + ₦66
   * and a total of ₦1,500, which the founder read, correctly, as a breakdown
   * that does not tally.
   */
  it('reports the floor it applied, so a short trip adds up', async () => {
    if (!databaseAvailable) return;

    // Two points a few hundred metres apart price well under the minimum.
    const near = { lat: IKEJA.lat + 0.002, lng: IKEJA.lng + 0.002 };
    const e = await service.estimate(RideType.ECONOMY, IKEJA, near);

    expect(e.meteredFare).toBe(e.baseFare + e.distanceFare + e.timeFare);
    expect(e.meteredFare + e.surchargeAmount).toBeLessThan(e.minimumFare);
    expect(e.minimumFareApplied).toBe(true);
    expect(e.totalFare).toBe(e.minimumFare);
    // The gap the UI renders as its own line.
    expect(e.minimumFare - e.meteredFare - e.surchargeAmount).toBeGreaterThan(0);
  });

  it('leaves a trip priced above the floor alone, and says so', async () => {
    if (!databaseAvailable) return;

    const e = await service.estimate(RideType.ECONOMY, IKEJA, VICTORIA_ISLAND);

    expect(e.meteredFare).toBe(e.baseFare + e.distanceFare + e.timeFare);
    expect(e.minimumFareApplied).toBe(false);
    // With no floor and no surcharge in play, the lines are the total.
    expect(e.totalFare).toBe(e.meteredFare + e.surchargeAmount);
  });

  it('estimates a higher fare for Economy than Tricycle over the same trip', async () => {
    if (!databaseAvailable) return;

    // Far enough apart that both price above the platform minimum — below it
    // every type is charged the same floor, which is the point of a floor.
    const economy = await service.estimate(RideType.ECONOMY, IKEJA, VICTORIA_ISLAND);
    const tricycle = await service.estimate(RideType.TRICYCLE, IKEJA, VICTORIA_ISLAND);

    expect(economy.totalFare).toBeGreaterThan(tricycle.totalFare);
  });

  it('composes total fare from base + distance + time once above the minimum', async () => {
    if (!databaseAvailable) return;

    const estimate = await service.estimate(RideType.ECONOMY, IKEJA, VICTORIA_ISLAND);

    expect(estimate.totalFare).toBe(estimate.baseFare + estimate.distanceFare + estimate.timeFare);
    expect(estimate.totalFare).toBeGreaterThan(RIDE_MINIMUM_FARE);
    expect(estimate.distanceMeters).toBeGreaterThan(0);
    expect(estimate.durationSeconds).toBeGreaterThan(0);
    expect(estimate.surchargeAmount).toBe(0);
    expect(estimate.surchargeZoneId).toBeNull();
  });

  /**
   * Founder decision, 2026-08-16: a trip under a kilometre is charged NGN 1,500.
   * Economy's base fare is 300, so before this a sub-kilometre hop earned a
   * driver a few hundred naira and was not worth taking.
   */
  describe('platform minimum fare', () => {
    it('charges the minimum for a zero-distance trip, not the base fare alone', async () => {
      if (!databaseAvailable) return;

      const estimate = await service.estimate(RideType.ECONOMY, IKEJA, IKEJA);

      expect(estimate.distanceFare).toBe(0);
      expect(estimate.timeFare).toBe(0);
      expect(estimate.totalFare).toBe(RIDE_MINIMUM_FARE);
    });

    it('charges the minimum for a trip under one kilometre', async () => {
      if (!databaseAvailable) return;

      // ~600 m away.
      const estimate = await service.estimate(RideType.ECONOMY, IKEJA, {
        lat: 6.6072,
        lng: 3.3515,
      });

      expect(estimate.distanceMeters).toBeLessThan(1000);
      expect(estimate.totalFare).toBe(RIDE_MINIMUM_FARE);
    });

    it('applies to every ride type, including the cheapest', async () => {
      if (!databaseAvailable) return;

      for (const rideType of [RideType.ECONOMY, RideType.COMFORT, RideType.XL, RideType.TRICYCLE]) {
        const estimate = await service.estimate(rideType, IKEJA, IKEJA);
        expect(estimate.totalFare).toBe(RIDE_MINIMUM_FARE);
      }
    });

    it('leaves a long trip alone — the minimum is a floor, never an addition', async () => {
      if (!databaseAvailable) return;

      const estimate = await service.estimate(RideType.ECONOMY, IKEJA, VICTORIA_ISLAND);

      expect(estimate.totalFare).toBe(
        estimate.baseFare + estimate.distanceFare + estimate.timeFare,
      );
    });
  });

  describe('surcharge zones', () => {
    it('adds a flat surcharge when the trip ends inside the zone', async () => {
      if (!databaseAvailable) return;

      const before = await service.estimate(RideType.ECONOMY, IKEJA, VICTORIA_ISLAND);
      const zoneId = await createZone({
        name: 'Airport',
        centre: VICTORIA_ISLAND,
        radiusMeters: 3_000,
        surchargeType: RideSurchargeType.FLAT,
        amount: 1_000,
      });

      const after = await service.estimate(RideType.ECONOMY, IKEJA, VICTORIA_ISLAND);

      expect(after.surchargeAmount).toBe(1_000);
      expect(after.surchargeZoneId).toBe(zoneId);
      expect(after.surchargeZoneName).toContain('Airport');
      expect(after.totalFare).toBe(before.totalFare + 1_000);
    });

    it('scales the metered fare for a multiplier zone', async () => {
      if (!databaseAvailable) return;

      const before = await service.estimate(RideType.ECONOMY, IKEJA, VICTORIA_ISLAND);
      await createZone({
        name: 'Airport',
        centre: VICTORIA_ISLAND,
        radiusMeters: 3_000,
        surchargeType: RideSurchargeType.MULTIPLIER,
        amount: 1.5,
      });

      const after = await service.estimate(RideType.ECONOMY, IKEJA, VICTORIA_ISLAND);

      // 1.5 means the fare becomes half again as much, so the surcharge is
      // half the metered fare — not the whole thing.
      expect(after.surchargeAmount).toBe(Math.round(before.totalFare * 0.5));
      expect(after.totalFare).toBe(before.totalFare + after.surchargeAmount);
    });

    it('ignores a zone the trip never touches', async () => {
      if (!databaseAvailable) return;

      await createZone({
        name: 'Somewhere else',
        centre: { lat: 12.0, lng: 8.5 },
        radiusMeters: 3_000,
        surchargeType: RideSurchargeType.FLAT,
        amount: 5_000,
      });

      const estimate = await service.estimate(RideType.ECONOMY, IKEJA, VICTORIA_ISLAND);
      expect(estimate.surchargeAmount).toBe(0);
      expect(estimate.surchargeZoneId).toBeNull();
    });

    it('ignores an inactive zone', async () => {
      if (!databaseAvailable) return;

      await createZone({
        name: 'Airport',
        centre: VICTORIA_ISLAND,
        radiusMeters: 3_000,
        surchargeType: RideSurchargeType.FLAT,
        amount: 1_000,
        active: false,
      });

      const estimate = await service.estimate(RideType.ECONOMY, IKEJA, VICTORIA_ISLAND);
      expect(estimate.surchargeAmount).toBe(0);
    });

    it('respects DROPOFF-only and PICKUP-only triggers', async () => {
      if (!databaseAvailable) return;

      await createZone({
        name: 'Arrivals only',
        centre: VICTORIA_ISLAND,
        radiusMeters: 3_000,
        surchargeType: RideSurchargeType.FLAT,
        amount: 800,
        appliesTo: RideSurchargeTrigger.DROPOFF,
      });

      // Ends in the zone — charged.
      const inbound = await service.estimate(RideType.ECONOMY, IKEJA, VICTORIA_ISLAND);
      expect(inbound.surchargeAmount).toBe(800);

      // Starts in the zone but ends outside it — not charged, because this
      // zone only triggers on the dropoff.
      const outbound = await service.estimate(RideType.ECONOMY, VICTORIA_ISLAND, IKEJA);
      expect(outbound.surchargeAmount).toBe(0);
    });

    it('applies only the largest of two overlapping zones, never both', async () => {
      if (!databaseAvailable) return;

      // Deliberate: a passenger crossing two overlapping zones must not be
      // charged twice for one journey. Engineering choice, flagged in the diff
      // register for founder confirmation.
      await createZone({
        name: 'Small',
        centre: VICTORIA_ISLAND,
        radiusMeters: 3_000,
        surchargeType: RideSurchargeType.FLAT,
        amount: 500,
      });
      await createZone({
        name: 'Large',
        centre: VICTORIA_ISLAND,
        radiusMeters: 4_000,
        surchargeType: RideSurchargeType.FLAT,
        amount: 1_200,
      });

      const estimate = await service.estimate(RideType.ECONOMY, IKEJA, VICTORIA_ISLAND);

      expect(estimate.surchargeAmount).toBe(1_200);
      expect(estimate.surchargeZoneName).toContain('Large');
    });

    it('still floors a short surcharged trip at the minimum fare', async () => {
      if (!databaseAvailable) return;

      await createZone({
        name: 'Airport',
        centre: IKEJA,
        radiusMeters: 3_000,
        surchargeType: RideSurchargeType.FLAT,
        amount: 100,
      });

      const estimate = await service.estimate(RideType.ECONOMY, IKEJA, IKEJA);

      // Metered 300 + 100 surcharge = 400, well under the 1,500 floor.
      expect(estimate.surchargeAmount).toBe(100);
      expect(estimate.totalFare).toBe(RIDE_MINIMUM_FARE);
    });
  });
});
