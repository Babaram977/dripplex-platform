import { Injectable, Logger } from '@nestjs/common';
import { BookingSettlementStatus, BookingStatus, Prisma, WalletOwnerType } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

import { BookingHotelNotifier } from './booking-hotel-notifier.service';
import { BOOKING_AUDIT_ACTIONS, BOOKING_SETTLEMENT_REFERENCE_TYPE } from './bookings.constants';
import { isSettlementDay, nextSettlementDay, settlementPeriod } from './settlement-week';

import type { BookingSettlement } from '@prisma/client';

/** One hotel's unsettled takings for a week, as the database groups them. */
interface OwedRow {
  businessId: string;
  _count: { _all: number };
  _sum: { totalAmount: Prisma.Decimal | null; commissionAmount: Prisma.Decimal | null };
}

/** What a run would pay, if it ran. Amounts are naira, dates UTC. */
export interface SettlementPreview {
  /** The Monday the run happens on — today when today is Monday. */
  runsOn: Date;
  weekStarting: Date;
  /** First day covered, inclusive. */
  from: Date;
  /** Exclusive end: the Monday itself, so Sunday is the last day paid for. */
  to: Date;
  hotels: {
    businessId: string;
    businessName: string;
    bookingCount: number;
    grossAmount: number;
    commissionAmount: number;
    netAmount: number;
  }[];
  hotelCount: number;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
}

/**
 * Paying hotels — DPX-HOTEL-003.
 *
 * Founder decision 2026-08-22: **weekly, every Monday**, and it exists because
 * of decision 11. A guest now pays THROUGH DrippleX, so DrippleX holds the
 * money and owes each hotel its share; without this, bookings would accumulate
 * paid and no hotel would ever see a naira.
 *
 * The money lands in the hotel's DrippleX wallet, which is where every other
 * merchant payout already lands and which the existing bank-withdrawal flow
 * already drains. No new money rail.
 *
 * **Paying twice is the failure this is built around.** A weekly job can fire
 * more than once on the same Monday — a restart, two instances, an operator
 * retrying a failed run — and application code cannot make that safe on its
 * own: two runs both read "not settled yet" and both decide to pay.
 *
 * What actually prevents it is `Booking.settlementId`, claimed by an update
 * whose WHERE requires it to still be null. Postgres re-evaluates that
 * condition after taking the row lock, so of two runs racing for the same
 * booking the loser matches zero rows, sums zero, and credits nothing. A
 * booking already carrying a settlement id is never picked up again, by this
 * week's run or any later one.
 *
 * That was confirmed by removing the unique index below and running the race
 * anyway: the hotel is still paid exactly once. Worth knowing, because it
 * means the index is **not** the thing standing between a hotel and a double
 * payment, and a future change that keeps the index while loosening the claim
 * would be a regression that looks safe.
 *
 * The index on `(businessId, weekStarting)` earns its place for two smaller
 * reasons: it makes "one settlement per hotel per week" a fact of the schema
 * rather than a convention, and it lets a duplicate run bail out immediately
 * instead of doing the work and discovering there is nothing to claim.
 *
 * The wallet credit is idempotent on its own reference too, so even the
 * unlikely path where a settlement row exists but the credit did not land
 * resolves correctly on a retry rather than double-crediting.
 */
@Injectable()
export class BookingSettlementService {
  private readonly logger = new Logger(BookingSettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly auditService: AuditService,
    private readonly hotelNotifier: BookingHotelNotifier,
  ) {}

  /**
   * Run the weekly settlement, if today is the day.
   *
   * Returns how many hotels were paid. Safe to call as often as you like — on
   * a day that is not Monday it does nothing, and on a Monday it will not pay
   * a hotel that has already been paid for that week.
   */
  public async runWeeklySettlement(now: Date = new Date()): Promise<number> {
    if (!isSettlementDay(now)) return 0;
    return await this.settleWeek(now);
  }

  /**
   * Settle every hotel with unpaid bookings for the week ending this Monday.
   *
   * Exposed separately from `runWeeklySettlement` so an operator can trigger a
   * missed week by hand, and so a test does not have to wait for a Monday.
   */
  public async settleWeek(now: Date): Promise<number> {
    const period = settlementPeriod(now);

    const owed = await this.owedForPeriod(period);

    let settled = 0;
    for (const row of owed) {
      try {
        const result = await this.settleOneHotel(row.businessId, period.weekStarting, period);
        if (result) settled += 1;
      } catch (error) {
        // One hotel that cannot be settled must not stop the rest — every
        // other row here is a business waiting to be paid.
        this.logger.error(
          `Weekly settlement failed for business ${row.businessId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    if (settled > 0) {
      this.logger.log(
        `Weekly hotel settlement: paid ${String(settled)} hotel(s) for the week of ${period.from
          .toISOString()
          .slice(0, 10)}.`,
      );
    }
    return settled;
  }

  private async settleOneHotel(
    businessId: string,
    weekStarting: Date,
    period: { from: Date; to: Date },
  ): Promise<BookingSettlement | null> {
    // Claim the week first. If a run already did this one, the unique index
    // refuses the insert and there is nothing more to do — no bookings get
    // touched and no money moves.
    let settlement: BookingSettlement;
    try {
      settlement = await this.prisma.bookingSettlement.create({
        data: {
          businessId,
          weekStarting,
          status: BookingSettlementStatus.PENDING,
          bookingCount: 0,
          grossAmount: new Prisma.Decimal(0),
          commissionAmount: new Prisma.Decimal(0),
          netAmount: new Prisma.Decimal(0),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        this.logger.warn(
          `Business ${businessId} is already settled for the week of ${weekStarting
            .toISOString()
            .slice(0, 10)} — skipping. This is the duplicate-run guard working.`,
        );
        return null;
      }
      throw error;
    }

    // Claim the bookings. `settlementId: null` in the WHERE is what stops a
    // booking being paid out by two different weeks' runs — Postgres evaluates
    // it as part of the write, so a race loses rather than double-paying.
    const claimed = await this.prisma.booking.updateMany({
      where: {
        businessId,
        status: BookingStatus.CONFIRMED,
        settlementId: null,
        paidAt: { gte: period.from, lt: period.to },
      },
      data: { settlementId: settlement.id },
    });

    if (claimed.count === 0) {
      // Another run took them between the group-by and here. The empty
      // settlement row stays as an honest record that this week had nothing.
      await this.prisma.bookingSettlement.update({
        where: { id: settlement.id },
        data: { status: BookingSettlementStatus.COMPLETED, settledAt: new Date() },
      });
      return null;
    }

    // Sum what was actually claimed, not what the earlier group-by saw — the
    // two can differ if a booking was settled in between, and the hotel must
    // be paid for exactly the rows carrying this settlement's id.
    const totals = await this.prisma.booking.aggregate({
      where: { settlementId: settlement.id },
      _count: { _all: true },
      _sum: { totalAmount: true, commissionAmount: true },
    });

    const grossAmount = Number(totals._sum.totalAmount ?? 0);
    const commissionAmount = Number(totals._sum.commissionAmount ?? 0);
    const netAmount = roundMoney(grossAmount - commissionAmount);

    const business = await this.prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { merchantId: true, businessName: true },
    });

    try {
      if (netAmount > 0) {
        await this.walletService.settlement({
          ownerType: WalletOwnerType.MERCHANT,
          ownerId: business.merchantId,
          amount: netAmount,
          description: `Hotel bookings, week of ${period.from.toISOString().slice(0, 10)}`,
          referenceType: BOOKING_SETTLEMENT_REFERENCE_TYPE,
          referenceId: settlement.id,
        });
      }
    } catch (error) {
      // The money did not move. Record why, leave the bookings claimed so they
      // are not double-counted by the next run, and leave the row FAILED for a
      // human — silently retrying a payout is how a hotel gets paid twice.
      await this.prisma.bookingSettlement.update({
        where: { id: settlement.id },
        data: {
          status: BookingSettlementStatus.FAILED,
          bookingCount: totals._count._all,
          grossAmount: new Prisma.Decimal(grossAmount),
          commissionAmount: new Prisma.Decimal(commissionAmount),
          netAmount: new Prisma.Decimal(netAmount),
          failureReason: error instanceof Error ? error.message.slice(0, 1000) : String(error),
        },
      });
      throw error;
    }

    const completed = await this.prisma.bookingSettlement.update({
      where: { id: settlement.id },
      data: {
        status: BookingSettlementStatus.COMPLETED,
        bookingCount: totals._count._all,
        grossAmount: new Prisma.Decimal(grossAmount),
        commissionAmount: new Prisma.Decimal(commissionAmount),
        netAmount: new Prisma.Decimal(netAmount),
        settledAt: new Date(),
      },
    });

    // Tell the hotel the money landed. Without this a merchant sees a wallet
    // balance change with no explanation — the gap flagged when settlement
    // shipped. Guarded: a payout that succeeded must never be undone by a
    // message that would not send.
    try {
      await this.hotelNotifier.settlementPaid(completed, business.merchantId);
    } catch (error) {
      this.logger.error(
        `Paid settlement ${settlement.id} but could not notify the hotel: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    // Empty context on purpose: no person did this. A settlement is the clock
    // paying a hotel, and attributing it to a user would invent an actor.
    await this.auditService.record(
      BOOKING_AUDIT_ACTIONS.SETTLED,
      {},
      {
        resource: 'booking_settlement',
        resourceId: settlement.id,
        metadata: {
          businessId,
          businessName: business.businessName,
          weekStarting: weekStarting.toISOString().slice(0, 10),
          bookingCount: totals._count._all,
          grossAmount,
          commissionAmount,
          netAmount,
        },
      },
    );

    return completed;
  }

  /**
   * Which hotels have money waiting for a given week.
   *
   * Shared deliberately between the real run and the preview below. A preview
   * built on its own copy of this query is worse than no preview: it would
   * agree with the run right up until someone edited one of them, and then
   * quietly show a hotel a number it is not going to be paid.
   *
   * Grouped in the database rather than pulled into memory — a platform-wide
   * settlement should not depend on how many bookings happened that week.
   */
  private async owedForPeriod(period: { from: Date; to: Date }): Promise<OwedRow[]> {
    // Assigned before returning on purpose: annotating the return type of a
    // function that returns `groupBy` directly feeds that annotation back into
    // Prisma's own inference and it stops type-checking.
    const rows = await this.prisma.booking.groupBy({
      by: ['businessId'],
      where: {
        status: BookingStatus.CONFIRMED,
        settlementId: null,
        paidAt: { gte: period.from, lt: period.to },
      },
      _count: { _all: true },
      _sum: { totalAmount: true, commissionAmount: true },
    });
    return rows;
  }

  /**
   * What the next run will pay, without paying it.
   *
   * Read-only by construction: it calls the same query the run calls and then
   * stops. Nothing is inserted, nothing is claimed, and calling it a hundred
   * times changes nothing — which is the whole point of being able to look
   * before Monday rather than finding out afterwards.
   *
   * Dated from `nextSettlementDay`, not from now. Asked on a Sunday, "the
   * period a run happening now would cover" is last week — already paid. The
   * question a person is asking is what tomorrow pays.
   */
  public async previewNextRun(now: Date = new Date()): Promise<SettlementPreview> {
    const runsOn = nextSettlementDay(now);
    const period = settlementPeriod(runsOn);
    const owed = await this.owedForPeriod(period);

    const businesses =
      owed.length === 0
        ? []
        : await this.prisma.business.findMany({
            where: { id: { in: owed.map((row) => row.businessId) } },
            select: { id: true, businessName: true },
          });
    const nameOf = new Map(businesses.map((b) => [b.id, b.businessName]));

    const hotels = owed
      .map((row) => {
        const grossAmount = Number(row._sum.totalAmount ?? 0);
        const commissionAmount = Number(row._sum.commissionAmount ?? 0);
        return {
          businessId: row.businessId,
          businessName: nameOf.get(row.businessId) ?? 'Unknown hotel',
          bookingCount: row._count._all,
          grossAmount,
          commissionAmount,
          netAmount: roundMoney(grossAmount - commissionAmount),
        };
      })
      .sort((a, b) => b.netAmount - a.netAmount);

    return {
      runsOn,
      weekStarting: period.weekStarting,
      from: period.from,
      to: period.to,
      hotels,
      hotelCount: hotels.length,
      grossAmount: roundMoney(hotels.reduce((sum, h) => sum + h.grossAmount, 0)),
      commissionAmount: roundMoney(hotels.reduce((sum, h) => sum + h.commissionAmount, 0)),
      netAmount: roundMoney(hotels.reduce((sum, h) => sum + h.netAmount, 0)),
    };
  }

  /** One hotel's slice of the next run. */
  public async previewNextRunForBusiness(
    businessId: string,
    now: Date = new Date(),
  ): Promise<SettlementPreview> {
    const all = await this.previewNextRun(now);
    const mine = all.hotels.filter((h) => h.businessId === businessId);
    return {
      ...all,
      hotels: mine,
      hotelCount: mine.length,
      grossAmount: roundMoney(mine.reduce((sum, h) => sum + h.grossAmount, 0)),
      commissionAmount: roundMoney(mine.reduce((sum, h) => sum + h.commissionAmount, 0)),
      netAmount: roundMoney(mine.reduce((sum, h) => sum + h.netAmount, 0)),
    };
  }

  /** A hotel's own settlement history. */
  public async listForBusiness(
    businessId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: BookingSettlement[]; total: number }> {
    const where = { businessId };
    const [total, items] = await Promise.all([
      this.prisma.bookingSettlement.count({ where }),
      this.prisma.bookingSettlement.findMany({
        where,
        orderBy: { weekStarting: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items, total };
  }

  /** Every settlement, for Ops. */
  public async listAll(
    page: number,
    pageSize: number,
    status?: BookingSettlementStatus,
  ): Promise<{ items: BookingSettlement[]; total: number }> {
    const where = status ? { status } : {};
    const [total, items] = await Promise.all([
      this.prisma.bookingSettlement.count({ where }),
      this.prisma.bookingSettlement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items, total };
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
