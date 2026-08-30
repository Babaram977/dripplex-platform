import { Injectable, Logger } from '@nestjs/common';
import { CommissionOwnerType, Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { CommissionAccountService } from '../commercial/commission-account.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import { FLEET_AUDIT_ACTIONS, FLEET_COMMISSION_REFERENCE_TYPE } from './fleet.constants';

import type { AuditContext } from '../audit/audit.service';
import type { FleetCommissionPeriod, FleetCommissionTier } from '@prisma/client';

/**
 * Lagos is UTC+1 all year — no daylight saving — so a calendar month boundary
 * is a fixed offset. Written out rather than pulled from a date library
 * because the whole platform already treats Lagos as the operating timezone
 * (see `lagosWeekStart` in the wallet settlement report) and a month that
 * started an hour late would put orders in the wrong invoice.
 */
const LAGOS_UTC_OFFSET_HOURS = 1;

export interface FleetPeriodTotals {
  periodStart: Date;
  periodEnd: Date;
  orderCount: number;
  chargeableTotal: number;
  /** The rate the current volume would attract, if the month closed now. */
  projectedRate: number | null;
  projectedCommission: number | null;
  settled: boolean;
  appliedRate: number | null;
  commissionAmount: number | null;
}

/**
 * DPX-FLEET — what a fleet owes DrippleX, and when.
 *
 * Founder decision, 2026-08-30. Two parts, and the second is the subtle one:
 *
 *   1. Commission is a percentage of the delivery fees the fleet's members
 *      earned — "8% of the delivery fee the system charge" — never of the
 *      basket the merchant sold. The merchant's own 10% is a separate deal.
 *
 *   2. The whole month settles at the band its total volume reaches. A fleet
 *      that finishes on 5,200 orders pays the 5,000+ rate on all 5,200, not
 *      8% on the first 4,999 and 6.5% on the rest. Crossing a threshold makes
 *      the entire month cheaper, which is the incentive the founder wanted.
 *
 * (2) means the rate is unknowable until the month closes. So the running
 * figures on a period are an estimate — `projectedRate` — and nothing is
 * charged to the fleet's commission account until `settlePeriod` runs. The
 * rate that was finally applied is then snapshotted onto the period, the same
 * way `Ride.platformCommissionRate` snapshots its own, so editing the tier
 * table later never rewrites a month that has already been invoiced.
 */
@Injectable()
export class FleetCommissionService {
  private readonly logger = new Logger(FleetCommissionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly commissionAccounts: CommissionAccountService,
    private readonly auditService: AuditService,
  ) {}

  /** First instant of the Lagos calendar month containing `at`, as UTC. */
  public monthStart(at: Date): Date {
    const lagos = new Date(at.getTime() + LAGOS_UTC_OFFSET_HOURS * 3_600_000);
    return new Date(
      Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), 1, 0, 0, 0, 0) -
        LAGOS_UTC_OFFSET_HOURS * 3_600_000,
    );
  }

  /** First instant of the following Lagos month, as UTC — the exclusive end. */
  public monthEnd(at: Date): Date {
    const lagos = new Date(at.getTime() + LAGOS_UTC_OFFSET_HOURS * 3_600_000);
    return new Date(
      Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth() + 1, 1, 0, 0, 0, 0) -
        LAGOS_UTC_OFFSET_HOURS * 3_600_000,
    );
  }

  /**
   * The rate for a given monthly volume.
   *
   * Returns null when no band covers it, and the caller must refuse rather
   * than fall back to a default. The founder gave two bands as an
   * illustration and never set the ones below 999 or above 9,999; inventing a
   * rate to fill that gap would put a number nobody agreed on an invoice.
   */
  public async rateForVolume(orderCount: number): Promise<number | null> {
    const tiers = await this.prisma.fleetCommissionTier.findMany({
      orderBy: { minOrders: 'asc' },
    });
    const match = this.selectTier(tiers, orderCount);
    return match === null ? null : Number(match.rate);
  }

  private selectTier(tiers: FleetCommissionTier[], orderCount: number): FleetCommissionTier | null {
    for (const tier of tiers) {
      const aboveFloor = orderCount >= tier.minOrders;
      const belowCeiling = tier.maxOrders === null || orderCount <= tier.maxOrders;
      if (aboveFloor && belowCeiling) return tier;
    }
    return null;
  }

  /** The fleet's open period for `at`, created on first use. */
  public async currentPeriod(
    fleetId: string,
    at: Date = new Date(),
  ): Promise<FleetCommissionPeriod> {
    const periodStart = this.monthStart(at);
    const periodEnd = this.monthEnd(at);

    return await this.prisma.fleetCommissionPeriod.upsert({
      where: { fleetId_periodStart: { fleetId, periodStart } },
      create: { fleetId, periodStart, periodEnd },
      update: {},
    });
  }

  /**
   * Records one completed job — a delivery or a ride — against the running
   * month.
   *
   * Increments rather than recomputing: a fleet doing thousands of orders a
   * month should not re-scan its own history on every delivery, and the
   * increment is atomic so two deliveries completing at once cannot lose one.
   *
   * Deliberately does NOT touch the commission account. Nothing is owed until
   * the month closes and the band is known — see the class comment.
   */
  public async recordJob(input: {
    fleetId: string;
    /** Delivery fee for a delivery, trip fare for a ride. */
    amount: number | string | Prisma.Decimal;
    at?: Date;
  }): Promise<void> {
    const at = input.at ?? new Date();
    const period = await this.currentPeriod(input.fleetId, at);

    if (period.settledAt !== null) {
      // A delivery landing after its month was invoiced would silently change
      // a settled figure. Refusing is wrong too — the delivery really
      // happened — so it is logged and left for Operations to reconcile.
      this.logger.warn(
        `Job for fleet ${input.fleetId} at ${at.toISOString()} falls in a period ` +
          `settled on ${period.settledAt.toISOString()}; not counted. Reconcile manually.`,
      );
      return;
    }

    await this.prisma.fleetCommissionPeriod.update({
      where: { id: period.id },
      data: {
        orderCount: { increment: 1 },
        chargeableTotal: { increment: new Prisma.Decimal(input.amount) },
      },
    });
  }

  /** The running month, with what it would cost if it closed now. */
  public async periodTotals(fleetId: string, at: Date = new Date()): Promise<FleetPeriodTotals> {
    const period = await this.currentPeriod(fleetId, at);
    return await this.toTotals(period);
  }

  private async toTotals(period: FleetCommissionPeriod): Promise<FleetPeriodTotals> {
    const chargeableTotal = Number(period.chargeableTotal);
    const settled = period.settledAt !== null;
    const projectedRate = settled ? null : await this.rateForVolume(period.orderCount);

    return {
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      orderCount: period.orderCount,
      chargeableTotal,
      projectedRate,
      projectedCommission:
        projectedRate === null ? null : this.round(chargeableTotal * projectedRate),
      settled,
      appliedRate: period.appliedRate === null ? null : Number(period.appliedRate),
      commissionAmount: period.commissionAmount === null ? null : Number(period.commissionAmount),
    };
  }

  /** Kobo precision, matching every other money figure on the platform. */
  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /**
   * Closes a month and charges the fleet.
   *
   * The only place a fleet's commission account is ever debited. Refuses
   * rather than guesses when no band covers the volume, and refuses to settle
   * a month twice — an invoice sent again is worse than one sent late.
   */
  public async settlePeriod(input: {
    fleetId: string;
    periodStart: Date;
    adminUserId: string;
    context: AuditContext;
  }): Promise<FleetCommissionPeriod> {
    const period = await this.prisma.fleetCommissionPeriod.findUnique({
      where: { fleetId_periodStart: { fleetId: input.fleetId, periodStart: input.periodStart } },
    });
    if (!period) {
      throw new NotFoundDomainException('No trading period found for that fleet and month');
    }
    if (period.settledAt !== null) {
      throw new ConflictDomainException(
        `That month was already settled on ${period.settledAt.toISOString()}`,
      );
    }
    if (period.periodEnd.getTime() > Date.now()) {
      throw new ConflictDomainException(
        'That month has not finished yet. The rate depends on its final volume, so it cannot be settled early.',
      );
    }

    const rate = await this.rateForVolume(period.orderCount);
    if (rate === null) {
      throw new ValidationDomainException(
        `No commission band covers ${String(period.orderCount)} orders. ` +
          'Add a band that does before settling this month.',
      );
    }

    const commissionAmount = this.round(Number(period.chargeableTotal) * rate);

    const settled = await this.prisma.fleetCommissionPeriod.update({
      where: { id: period.id },
      data: {
        appliedRate: new Prisma.Decimal(rate),
        commissionAmount: new Prisma.Decimal(commissionAmount),
        settledAt: new Date(),
        settledBy: input.adminUserId,
      },
    });

    // Zero is a legitimate month — a fleet that did nothing owes nothing, and
    // accrue() rejects a non-positive amount. The period is still closed above
    // so it cannot be settled again.
    if (commissionAmount > 0) {
      await this.commissionAccounts.accrue({
        ownerType: CommissionOwnerType.FLEET,
        ownerId: input.fleetId,
        amount: commissionAmount,
        referenceType: FLEET_COMMISSION_REFERENCE_TYPE,
        referenceId: period.id,
        description: `Commission for ${period.periodStart.toISOString().slice(0, 7)} — ${String(period.orderCount)} orders at ${String(rate * 100)}%`,
        context: input.context,
      });
    }

    await this.auditService.record(FLEET_AUDIT_ACTIONS.PERIOD_SETTLED, input.context, {
      resource: 'fleet_commission_period',
      resourceId: period.id,
      metadata: {
        fleetId: input.fleetId,
        orderCount: period.orderCount,
        chargeableTotal: Number(period.chargeableTotal),
        appliedRate: rate,
        commissionAmount,
      },
    });

    return settled;
  }

  public async listTiers(): Promise<FleetCommissionTier[]> {
    return await this.prisma.fleetCommissionTier.findMany({ orderBy: { minOrders: 'asc' } });
  }

  /**
   * Replaces the whole band table in one transaction.
   *
   * Whole-table rather than per-row edits because the bands only mean anything
   * together: adding one that overlaps another, or leaving a gap between two,
   * produces a table that silently charges the wrong rate or none at all. The
   * checks below can only be made against the complete set.
   */
  public async replaceTiers(input: {
    tiers: { minOrders: number; maxOrders: number | null; rate: number }[];
    adminUserId: string;
    context: AuditContext;
  }): Promise<FleetCommissionTier[]> {
    const sorted = [...input.tiers].sort((a, b) => a.minOrders - b.minOrders);

    if (sorted.length === 0) {
      throw new ValidationDomainException('At least one commission band is required');
    }

    for (const [index, tier] of sorted.entries()) {
      if (tier.minOrders < 0) {
        throw new ValidationDomainException('A band cannot start below zero orders');
      }
      if (tier.rate <= 0 || tier.rate >= 1) {
        throw new ValidationDomainException(
          `Rate must be a fraction between 0 and 1 — 0.08 for 8%. Got ${String(tier.rate)}`,
        );
      }
      if (tier.maxOrders !== null && tier.maxOrders < tier.minOrders) {
        throw new ValidationDomainException(
          `Band starting at ${String(tier.minOrders)} ends at ${String(tier.maxOrders)}, before it begins`,
        );
      }

      const next = sorted[index + 1];
      if (next === undefined) {
        // Only the last band may be open-ended, and one of them must be, or a
        // fleet that outgrows the table has no rate at all.
        if (tier.maxOrders !== null) {
          throw new ValidationDomainException(
            'The highest band must be open-ended, or a fleet above it would have no rate',
          );
        }
        continue;
      }
      if (tier.maxOrders === null) {
        throw new ValidationDomainException(
          `Only the highest band may be open-ended; the one starting at ${String(tier.minOrders)} is not`,
        );
      }
      if (next.minOrders !== tier.maxOrders + 1) {
        throw new ValidationDomainException(
          `Bands must meet exactly: ${String(tier.minOrders)}–${String(tier.maxOrders)} is followed by one starting at ${String(next.minOrders)}, leaving ${next.minOrders > tier.maxOrders + 1 ? 'a gap' : 'an overlap'}`,
        );
      }
    }

    if (sorted[0]?.minOrders !== 0) {
      throw new ValidationDomainException(
        'The lowest band must start at 0 orders, or a fleet in its first quiet month would have no rate',
      );
    }

    const replaced = await this.prisma.$transaction(async (tx) => {
      await tx.fleetCommissionTier.deleteMany({});
      for (const tier of sorted) {
        await tx.fleetCommissionTier.create({
          data: {
            minOrders: tier.minOrders,
            maxOrders: tier.maxOrders,
            rate: new Prisma.Decimal(tier.rate),
            updatedBy: input.adminUserId,
          },
        });
      }
      return await tx.fleetCommissionTier.findMany({ orderBy: { minOrders: 'asc' } });
    });

    await this.auditService.record(FLEET_AUDIT_ACTIONS.TIERS_UPDATED, input.context, {
      resource: 'fleet_commission_tier',
      metadata: { bands: sorted },
    });

    return replaced;
  }
}
