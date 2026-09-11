import { Injectable, Logger } from '@nestjs/common';
import { DeliveryStatus, Prisma, RideStatus } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import { ValidationDomainException } from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import { FleetCommissionService } from './fleet-commission.service';
import { FLEET_AUDIT_ACTIONS } from './fleet.constants';

/** What a month should have counted, beside what it actually holds. */
export interface FleetMonthReconstructionDto {
  fleetId: string;
  fleetName: string;
  fleetNumber: string;
  /** Lagos month, as `YYYY-MM`. */
  month: string;
  periodStart: string;

  recordedOrderCount: number;
  recordedChargeableTotal: number;

  actualOrderCount: number;
  actualChargeableTotal: number;

  /** `actual − recorded`. Positive means the month under-counted. */
  missingOrderCount: number;
  missingChargeableTotal: number;

  /** A settled month is never rewritten — see the service comment. */
  settled: boolean;
  applied: boolean;
}

/**
 * DPX-AUDIT-001 §3.1 — reconstructing what a fleet actually owes.
 *
 * `FleetJobSubscriber` read the wrong object off the event bus for its whole
 * life, so every handler returned at its first guard and **no fleet job was
 * ever counted**. Every `FleetCommissionPeriod` holds zero, which means no
 * fleet has ever been billed commission.
 *
 * The counts are gone but the work is not: every ride and every delivery job is
 * still on the record, with its fare, its fee, its completion time and who did
 * it. So the month is recomputable from source, and this recomputes it.
 *
 * Four rules this follows, each because getting it wrong bills a real company
 * the wrong amount:
 *
 * - **A settled month is never touched.** An invoice that has gone out is a
 *   number somebody has agreed to. A shortfall in a settled month is reported
 *   and left for a human to decide about, not silently corrected.
 * - **It recomputes absolutely rather than incrementing.** The live path
 *   increments because it sees one job at a time; this sees the whole month, so
 *   it sets. That also makes it idempotent — running it twice is the same as
 *   running it once, which matters for something an operator will re-run.
 * - **Membership is read as it was at the time**, not as it is now. A rider who
 *   left last month still did that work for the fleet they were on. A member
 *   covers a job at time T when they joined on or before T and had not been
 *   removed by then.
 * - **Reporting is the default.** `apply` is opt-in, because the first thing
 *   anybody should do with this is look.
 *
 * A ride is counted on its **gross** fare, matching the live path and
 * DPX-PROMO-FUNDING: DrippleX funds its own coupons, so a fleet is billed on
 * what the trip was worth rather than on what the customer happened to pay.
 */
@Injectable()
export class FleetCommissionBackfillService {
  private readonly logger = new Logger(FleetCommissionBackfillService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly commission: FleetCommissionService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Every fleet, every month from its first job to the month before this one.
   *
   * The current month is excluded: it is still being counted by the live path
   * now that the subscriber works, and rewriting a month that is still
   * accruing would race it.
   */
  public async reconstructAll(input: {
    apply: boolean;
    adminUserId: string;
    context?: AuditContext;
  }): Promise<FleetMonthReconstructionDto[]> {
    const fleets = await this.prisma.fleet.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, fleetNumber: true, createdAt: true },
      orderBy: { fleetNumber: 'asc' },
    });

    const results: FleetMonthReconstructionDto[] = [];
    const currentMonthStart = this.commission.monthStart(new Date());

    for (const fleet of fleets) {
      let month = this.commission.monthStart(fleet.createdAt);
      while (month < currentMonthStart) {
        const row = await this.reconstructMonth({
          fleetId: fleet.id,
          fleetName: fleet.name,
          fleetNumber: fleet.fleetNumber,
          monthStart: month,
          apply: input.apply,
        });
        // A month with nothing in it and nothing recorded is noise in a report
        // an operator has to read.
        if (row.actualOrderCount > 0 || row.recordedOrderCount > 0) {
          results.push(row);
        }
        month = this.commission.monthEnd(month);
      }
    }

    if (input.apply) {
      await this.auditService.record(
        FLEET_AUDIT_ACTIONS.COMMISSION_BACKFILLED,
        { ...(input.context ?? {}), userId: input.adminUserId },
        {
          resource: 'fleet_commission_period',
          metadata: {
            monthsRewritten: results.filter((row) => row.applied).length,
            monthsSkippedAsSettled: results.filter((row) => row.settled).length,
            totalChargeableAdded: results
              .filter((row) => row.applied)
              .reduce((sum, row) => sum + row.missingChargeableTotal, 0),
          },
        },
      );
    }

    return results;
  }

  /** One fleet, one Lagos month. */
  public async reconstructMonth(input: {
    fleetId: string;
    fleetName?: string;
    fleetNumber?: string;
    monthStart: Date;
    apply: boolean;
  }): Promise<FleetMonthReconstructionDto> {
    const periodStart = this.commission.monthStart(input.monthStart);
    const periodEnd = this.commission.monthEnd(input.monthStart);
    if (periodStart >= this.commission.monthStart(new Date())) {
      throw new ValidationDomainException(
        'The current month is still being counted; reconstruct a month that has closed',
      );
    }

    const fleet =
      input.fleetName !== undefined && input.fleetNumber !== undefined
        ? { name: input.fleetName, fleetNumber: input.fleetNumber }
        : await this.prisma.fleet.findUnique({
            where: { id: input.fleetId },
            select: { name: true, fleetNumber: true },
          });
    if (fleet === null) {
      throw new ValidationDomainException('That fleet does not exist');
    }

    const memberIds = await this.membersDuring(input.fleetId, periodStart, periodEnd);

    const [rides, deliveries, period] = await Promise.all([
      memberIds.length === 0
        ? []
        : this.prisma.ride.findMany({
            where: {
              driverId: { in: memberIds },
              status: RideStatus.COMPLETED,
              completedAt: { gte: periodStart, lt: periodEnd },
            },
            select: { totalFare: true, promoDiscount: true },
          }),
      memberIds.length === 0
        ? []
        : this.prisma.deliveryJob.findMany({
            where: {
              riderId: { in: memberIds },
              status: DeliveryStatus.DELIVERED,
              deliveredAt: { gte: periodStart, lt: periodEnd },
            },
            select: { deliveryFee: true },
          }),
      this.prisma.fleetCommissionPeriod.findUnique({
        where: { fleetId_periodStart: { fleetId: input.fleetId, periodStart } },
      }),
    ]);

    // Gross, not net — the same basis the live path uses.
    let actualChargeable = new Prisma.Decimal(0);
    for (const ride of rides) {
      actualChargeable = actualChargeable.add(ride.totalFare).add(ride.promoDiscount);
    }
    for (const delivery of deliveries) {
      actualChargeable = actualChargeable.add(delivery.deliveryFee);
    }
    const actualOrderCount = rides.length + deliveries.length;

    const recordedOrderCount = period?.orderCount ?? 0;
    const recordedChargeable = Number(period?.chargeableTotal ?? 0);
    const settled = (period?.settledAt ?? null) !== null;

    let applied = false;
    if (input.apply && !settled && actualOrderCount > 0) {
      await this.prisma.fleetCommissionPeriod.upsert({
        where: { fleetId_periodStart: { fleetId: input.fleetId, periodStart } },
        create: {
          fleetId: input.fleetId,
          periodStart,
          periodEnd,
          orderCount: actualOrderCount,
          chargeableTotal: actualChargeable,
        },
        // Set, not increment: this has seen the whole month, so re-running it
        // must land on the same number rather than doubling it.
        update: { orderCount: actualOrderCount, chargeableTotal: actualChargeable },
      });
      applied = true;
    }

    if (settled && actualOrderCount !== recordedOrderCount) {
      this.logger.warn(
        `Fleet ${fleet.fleetNumber} month ${periodStart.toISOString().slice(0, 7)} is settled but ` +
          `under-counted by ${String(actualOrderCount - recordedOrderCount)} jobs; left untouched for review.`,
      );
    }

    return {
      fleetId: input.fleetId,
      fleetName: fleet.name,
      fleetNumber: fleet.fleetNumber,
      month: periodStart.toISOString().slice(0, 7),
      periodStart: periodStart.toISOString(),
      recordedOrderCount,
      recordedChargeableTotal: round(recordedChargeable),
      actualOrderCount,
      actualChargeableTotal: round(Number(actualChargeable)),
      missingOrderCount: actualOrderCount - recordedOrderCount,
      missingChargeableTotal: round(Number(actualChargeable) - recordedChargeable),
      settled,
      applied,
    };
  }

  /**
   * Who was on this fleet during the window.
   *
   * A member covers the window when they joined before it ended and had not
   * been removed before it began — `joinedAt` and `removedAt` are both on the
   * row, so this is read rather than inferred. Using today's membership instead would drop
   * the work of everybody who has since left — which, for a backfill covering
   * months of history, is exactly the population most likely to have moved on.
   *
   * Known limit: a deactivation is not recorded historically, only as a current
   * flag, so a job done during one would still count. Deactivating stops
   * DrippleX dispatching to that person, so there should be no such jobs; if
   * there are, they were real work the fleet's rider did.
   */
  private async membersDuring(fleetId: string, from: Date, to: Date): Promise<string[]> {
    const members = await this.prisma.fleetMember.findMany({
      where: {
        fleetId,
        joinedAt: { lt: to },
        OR: [{ removedAt: null }, { removedAt: { gt: from } }],
      },
      select: { userId: true },
    });
    return [...new Set(members.map((member) => member.userId))];
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
