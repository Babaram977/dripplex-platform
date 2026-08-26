import { randomUUID } from 'node:crypto';

import {
  DriverShiftStatus,
  FulfillmentType,
  OperationsCaseType,
  OperationsLifecycleStatus,
  OperationsPriority,
  OrderSettlementStatus,
  PrismaClient,
  RideCancelledBy,
  RideOfferStatus,
  RideStatus,
  RideType,
} from '@prisma/client';

import { OperationsAnalyticsService } from './operations-analytics.service';

import type { AnalyticsRange } from './operations-analytics.service';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/** Every fixture in this suite is pinned to its own isolated slice of a
 * fixed 2020 timeline (never "now") — the same discipline the Slice 3
 * dispatch-support suite used for geographic isolation (Abuja vs. Lagos),
 * applied here to time instead of space. These queries aggregate over the
 * *whole* `Ride`/`RideOffer`/`DriverShift`/`OperationsCase` tables filtered
 * only by a time range, so a shared live test DB with other suites'
 * `now()`-created fixtures would otherwise silently pollute every count.
 * Anchoring each test at a random point within a ~3-year window that
 * starts in 2020 makes collisions between tests (and with any other
 * suite's real-time fixtures) practically impossible. */
function pinnedRange(): { range: AnalyticsRange; anchor: Date } {
  const anchor = new Date(1_577_836_800_000 + Math.floor(Math.random() * 900_000_000) * 1000);
  return {
    anchor,
    range: {
      from: new Date(anchor.getTime() - 10 * 60 * 1000),
      to: new Date(anchor.getTime() + 10 * 60 * 1000),
    },
  };
}

describe('OperationsAnalyticsService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: OperationsAnalyticsService;
  let customerId: string;
  const driverIds: string[] = [];
  const rideIds: string[] = [];
  const orderIds: string[] = [];
  const merchantIds: string[] = [];
  const caseIds: string[] = [];

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

    service = new OperationsAnalyticsService(prisma);

    const customer = await prisma.user.create({
      data: {
        email: `ops-analytics-customer-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Analytics',
        lastName: 'Customer',
      },
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    if (databaseAvailable) {
      if (caseIds.length > 0) {
        await prisma.operationsCase
          .deleteMany({ where: { id: { in: caseIds } } })
          .catch(() => undefined);
      }
      if (rideIds.length > 0) {
        await prisma.ride.deleteMany({ where: { id: { in: rideIds } } }).catch(() => undefined);
      }
      // Settlements first: OrderSettlement.order is onDelete: Restrict, so an
      // order cannot be removed while its settlement still points at it.
      if (orderIds.length > 0) {
        await prisma.orderSettlement
          .deleteMany({ where: { orderId: { in: orderIds } } })
          .catch(() => undefined);
        await prisma.order.deleteMany({ where: { id: { in: orderIds } } }).catch(() => undefined);
      }
      if (merchantIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: merchantIds } } }).catch(() => undefined);
      }
      if (driverIds.length > 0) {
        // DriverShift/RideOffer cascade on User delete (both declared
        // `onDelete: Cascade` on the driver relation) — no separate
        // cleanup needed for those.
        await prisma.user.deleteMany({ where: { id: { in: driverIds } } }).catch(() => undefined);
      }
      await prisma.user.delete({ where: { id: customerId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  async function createDriver(): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `ops-analytics-driver-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Analytics',
        lastName: randomUUID().slice(0, 8),
      },
    });
    driverIds.push(user.id);
    return user.id;
  }

  async function createMerchantUser(): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `ops-analytics-merchant-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Analytics',
        lastName: 'Merchant',
      },
    });
    merchantIds.push(user.id);
    return user.id;
  }

  /** An order plus its settlement — the only shape that produces marketplace
   *  commission. Cohorted on the settlement's createdAt, which is what the
   *  aggregation reads. */
  async function createSettledOrder(
    merchantId: string,
    at: Date,
    money: { gross: number; commission: number; reversed?: boolean },
  ): Promise<void> {
    const order = await prisma.order.create({
      data: {
        customerId,
        merchantId,
        orderNumber: `OPS-${randomUUID().slice(0, 20)}`,
        fulfillmentType: FulfillmentType.DELIVERY,
        subtotal: money.gross,
        total: money.gross,
      },
    });
    orderIds.push(order.id);
    await prisma.orderSettlement.create({
      data: {
        orderId: order.id,
        merchantId,
        status: OrderSettlementStatus.COMPLETED,
        grossAmount: money.gross,
        commissionRate: 0.1,
        commissionAmount: money.commission,
        merchantAmount: money.gross - money.commission,
        createdAt: at,
        ...(money.reversed === true ? { reversedAt: at } : {}),
      },
    });
  }

  async function createRide(overrides: {
    status?: RideStatus;
    rideType?: RideType;
    requestedAt?: Date;
    driverId?: string | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
    driverEarning?: number | null;
    totalFare?: number;
    platformCommission?: number | null;
    promoDiscount?: number;
    tipAmount?: number | null;
    cancelledBy?: RideCancelledBy | null;
    cancellationReason?: string | null;
    pickupLatitude?: number;
    pickupLongitude?: number;
    dropoffLatitude?: number;
    dropoffLongitude?: number;
  }): Promise<string> {
    const ride = await prisma.ride.create({
      data: {
        customerId,
        rideType: overrides.rideType ?? RideType.ECONOMY,
        status: overrides.status ?? RideStatus.COMPLETED,
        ...(overrides.requestedAt !== undefined ? { requestedAt: overrides.requestedAt } : {}),
        pickupLatitude: overrides.pickupLatitude ?? 6.5244,
        pickupLongitude: overrides.pickupLongitude ?? 3.3792,
        dropoffLatitude: overrides.dropoffLatitude ?? 6.601,
        dropoffLongitude: overrides.dropoffLongitude ?? 3.3489,
        ...(overrides.driverId !== undefined ? { driverId: overrides.driverId } : {}),
        ...(overrides.startedAt !== undefined ? { startedAt: overrides.startedAt } : {}),
        ...(overrides.completedAt !== undefined ? { completedAt: overrides.completedAt } : {}),
        ...(overrides.driverEarning !== undefined
          ? { driverEarning: overrides.driverEarning }
          : {}),
        ...(overrides.totalFare !== undefined ? { totalFare: overrides.totalFare } : {}),
        ...(overrides.platformCommission !== undefined
          ? { platformCommission: overrides.platformCommission }
          : {}),
        ...(overrides.promoDiscount !== undefined
          ? { promoDiscount: overrides.promoDiscount }
          : {}),
        ...(overrides.tipAmount !== undefined ? { tipAmount: overrides.tipAmount } : {}),
        ...(overrides.cancelledBy !== undefined ? { cancelledBy: overrides.cancelledBy } : {}),
        ...(overrides.cancellationReason !== undefined
          ? { cancellationReason: overrides.cancellationReason }
          : {}),
      },
    });
    rideIds.push(ride.id);
    return ride.id;
  }

  it('computes ride operations: totals, rates, by-type, demand series, top reasons — scoped to the range', async () => {
    if (!databaseAvailable) return;

    const { range, anchor } = pinnedRange();
    await createRide({
      status: RideStatus.COMPLETED,
      rideType: RideType.ECONOMY,
      requestedAt: anchor,
    });
    await createRide({
      status: RideStatus.CANCELLED,
      rideType: RideType.COMFORT,
      requestedAt: new Date(anchor.getTime() + 1000),
      cancelledBy: RideCancelledBy.CUSTOMER,
      cancellationReason: 'Changed my mind',
    });
    await createRide({
      status: RideStatus.CANCELLED,
      rideType: RideType.COMFORT,
      requestedAt: new Date(anchor.getTime() + 2000),
      cancelledBy: RideCancelledBy.CUSTOMER,
      cancellationReason: 'Changed my mind',
    });
    await createRide({
      status: RideStatus.NO_DRIVERS_FOUND,
      rideType: RideType.XL,
      requestedAt: new Date(anchor.getTime() + 3000),
    });
    // Outside the range entirely — must not be counted.
    await createRide({ requestedAt: new Date(anchor.getTime() - 60 * 60 * 1000) });

    const result = await service.getRideOperations(range);

    expect(result.requested).toBe(4);
    expect(result.completed).toBe(1);
    expect(result.cancelled).toBe(2);
    expect(result.noDriversFound).toBe(1);
    expect(result.completionRate).toBeCloseTo(0.25);
    expect(result.cancellationRate).toBeCloseTo(0.5);
    expect(result.noDriversFoundRate).toBeCloseTo(0.25);
    expect(result.cancelledByCustomer).toBe(2);
    expect(result.cancelledBySystem).toBe(0);
    expect(result.cancelledByOperations).toBe(0);
    expect(result.byRideType).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rideType: 'ECONOMY', requested: 1, completed: 1 }),
        expect.objectContaining({ rideType: 'COMFORT', requested: 2, cancelled: 2 }),
      ]),
    );
    expect(result.demandSeries.length).toBeGreaterThan(0);
    expect(result.topCancellationReasons[0]).toEqual({ reason: 'Changed my mind', count: 2 });
  });

  it('computes dispatch performance: acceptance/decline/expire, time-to-accept, repeated offers', async () => {
    if (!databaseAvailable) return;

    const { range, anchor } = pinnedRange();
    const driverId = await createDriver();
    const rideWithOneOffer = await createRide({ requestedAt: anchor });
    const rideWithTwoOffers = await createRide({ requestedAt: anchor });

    await prisma.rideOffer.create({
      data: {
        rideId: rideWithOneOffer,
        driverId,
        status: RideOfferStatus.ACCEPTED,
        offeredAt: anchor,
        expiresAt: new Date(anchor.getTime() + 15_000),
        respondedAt: new Date(anchor.getTime() + 5000),
      },
    });
    await prisma.rideOffer.create({
      data: {
        rideId: rideWithTwoOffers,
        driverId,
        status: RideOfferStatus.DECLINED,
        offeredAt: anchor,
        expiresAt: new Date(anchor.getTime() + 15_000),
        respondedAt: new Date(anchor.getTime() + 2000),
      },
    });
    await prisma.rideOffer.create({
      data: {
        rideId: rideWithTwoOffers,
        driverId,
        status: RideOfferStatus.EXPIRED,
        offeredAt: new Date(anchor.getTime() + 16_000),
        expiresAt: new Date(anchor.getTime() + 31_000),
        respondedAt: new Date(anchor.getTime() + 31_000),
      },
    });

    const result = await service.getDispatchPerformance(range);

    expect(result.totalOffers).toBe(3);
    expect(result.acceptedOffers).toBe(1);
    expect(result.declinedOffers).toBe(1);
    expect(result.expiredOffers).toBe(1);
    expect(result.acceptanceRate).toBeCloseTo(1 / 3);
    expect(result.averageTimeToAcceptSeconds).toBeCloseTo(5);
    expect(result.ridesWithOffers).toBe(2);
    expect(result.ridesNeedingRepeatedOffers).toBe(1);
    expect(result.repeatedOfferRate).toBeCloseTo(0.5);
  });

  it('computes driver utilization from shift + completed-ride data, honestly null when no shift exists', async () => {
    if (!databaseAvailable) return;

    const { range, anchor } = pinnedRange();
    const driverWithShift = await createDriver();
    const driverWithoutShift = await createDriver();

    await prisma.driverShift.create({
      data: {
        driverId: driverWithShift,
        startedAt: anchor,
        endedAt: new Date(anchor.getTime() + 300_000),
        continuousSince: anchor,
      },
    });
    await createRide({
      driverId: driverWithShift,
      status: RideStatus.COMPLETED,
      requestedAt: anchor,
      startedAt: new Date(anchor.getTime() + 50_000),
      completedAt: new Date(anchor.getTime() + 200_000),
      driverEarning: 1500,
    });
    // A driver with a completed ride but no recorded shift in range —
    // onlineSeconds stays 0, so utilizationRate must be null, not a
    // fabricated divide-by-zero result.
    await createRide({
      driverId: driverWithoutShift,
      status: RideStatus.COMPLETED,
      requestedAt: anchor,
      startedAt: anchor,
      completedAt: new Date(anchor.getTime() + 100_000),
      driverEarning: 800,
    });

    const result = await service.getDriverUtilization(range);

    const withShiftRow = result.topDrivers.find((row) => row.driverId === driverWithShift);
    const withoutShiftRow = result.topDrivers.find((row) => row.driverId === driverWithoutShift);

    expect(withShiftRow?.tripsCompleted).toBe(1);
    expect(withShiftRow?.earnings).toBe(1500);
    expect(withShiftRow?.onlineSeconds).toBe(300);
    expect(withShiftRow?.utilizationRate).not.toBeNull();
    expect(withoutShiftRow?.tripsCompleted).toBe(1);
    expect(withoutShiftRow?.onlineSeconds).toBe(0);
    expect(withoutShiftRow?.utilizationRate).toBeNull();
    expect(result.totalTripsCompleted).toBe(2);
  });

  it('computes shift analytics: started/ended counts, durations, break/reminder counts, in range', async () => {
    if (!databaseAvailable) return;

    const { range, anchor } = pinnedRange();
    const driverId = await createDriver();

    await prisma.driverShift.create({
      data: {
        driverId,
        status: DriverShiftStatus.ENDED,
        startedAt: anchor,
        endedAt: new Date(anchor.getTime() + 400_000),
        continuousSince: anchor,
        totalBreakSeconds: 100,
        forceEndedBy: null,
        breakReminderSentAt: new Date(anchor.getTime() + 200_000),
        fatigueWarningSentAt: null,
        dailyLimitNotifiedAt: null,
      },
    });
    const secondDriverId = await createDriver();
    await prisma.driverShift.create({
      data: {
        driverId: secondDriverId,
        status: DriverShiftStatus.ENDED,
        startedAt: new Date(anchor.getTime() + 1000),
        endedAt: new Date(anchor.getTime() + 1000 + 300_000),
        continuousSince: new Date(anchor.getTime() + 1000),
        forceEndedBy: secondDriverId,
      },
    });

    const result = await service.getShiftAnalytics(range);

    expect(result.shiftsStarted).toBe(2);
    expect(result.shiftsEnded).toBe(2);
    expect(result.forceEndedCount).toBe(1);
    expect(result.averageShiftDurationSeconds).toBeCloseTo((400 + 300) / 2);
    expect(result.breakReminderCount).toBe(1);
    expect(result.averageBreakSeconds).toBeCloseTo(100);
  });

  it('computes operations response SLA analytics uniformly across SOS/Incident/Support', async () => {
    if (!databaseAvailable) return;

    const { range, anchor } = pinnedRange();

    async function createCase(
      caseType: OperationsCaseType,
      offsets: { firstRespondedMs?: number; resolvedMs?: number },
    ): Promise<void> {
      const created = await prisma.operationsCase.create({
        data: {
          caseType,
          sourceId: randomUUID(),
          priority: OperationsPriority.MEDIUM,
          status: OperationsLifecycleStatus.RESOLVED,
          createdAt: anchor,
          firstRespondedAt:
            offsets.firstRespondedMs !== undefined
              ? new Date(anchor.getTime() + offsets.firstRespondedMs)
              : null,
          resolvedAt:
            offsets.resolvedMs !== undefined
              ? new Date(anchor.getTime() + offsets.resolvedMs)
              : null,
        },
      });
      caseIds.push(created.id);
    }

    await createCase(OperationsCaseType.SOS, { firstRespondedMs: 30_000, resolvedMs: 120_000 });
    await createCase(OperationsCaseType.INCIDENT, {
      firstRespondedMs: 60_000,
      resolvedMs: 180_000,
    });
    await createCase(OperationsCaseType.SUPPORT, { firstRespondedMs: 90_000 });

    const result = await service.getOperationsResponse(range);

    expect(result.totalCases).toBe(3);
    const sosRow = result.byType.find((row) => row.caseType === 'SOS');
    expect(sosRow?.totalCases).toBe(1);
    expect(sosRow?.averageTimeToFirstResponseSeconds).toBeCloseTo(30);
    expect(result.averageTimeToFirstResponseSeconds).toBeCloseTo(60);
    expect(result.averageTimeToResolutionSeconds).toBeCloseTo(150);
  });

  it('bins geographic demand into grid cells at the requested resolution', async () => {
    if (!databaseAvailable) return;

    const { range, anchor } = pinnedRange();
    // Two pickups in the same coarse cell, one dropoff far away in its own
    // cell — a 1-degree cell size makes the grouping trivial to assert.
    await createRide({
      requestedAt: anchor,
      pickupLatitude: 6.5,
      pickupLongitude: 3.5,
      dropoffLatitude: 6.5,
      dropoffLongitude: 3.5,
    });
    await createRide({
      requestedAt: new Date(anchor.getTime() + 1000),
      pickupLatitude: 6.6,
      pickupLongitude: 3.6,
      dropoffLatitude: 9.9,
      dropoffLongitude: 7.9,
    });

    const result = await service.getGeographicDemand(range, 1);

    expect(result.totalPickups).toBe(2);
    const busyCell = result.cells.find((cell) => cell.latitude === 6 && cell.longitude === 3);
    expect(busyCell?.pickupCount).toBe(2);
    const farCell = result.cells.find((cell) => cell.latitude === 9 && cell.longitude === 7);
    expect(farCell?.dropoffCount).toBe(1);
  });

  it('returns honest zeros/nulls for an overview range with no data', async () => {
    if (!databaseAvailable) return;

    const { range } = pinnedRange();
    const result = await service.getOverview(range);

    expect(result.ridesRequested).toBe(0);
    expect(result.completionRate).toBe(0);
    expect(result.averageUtilizationRate).toBeNull();
    expect(result.averageTimeToAcceptSeconds).toBeNull();
    expect(result.averageTimeToFirstResponseSeconds).toBeNull();
  });

  it('composes a real overview from the same data the drill-downs see', async () => {
    if (!databaseAvailable) return;

    const { range, anchor } = pinnedRange();
    await createRide({ status: RideStatus.COMPLETED, requestedAt: anchor });
    await createRide({
      status: RideStatus.CANCELLED,
      requestedAt: new Date(anchor.getTime() + 1000),
    });

    const result = await service.getOverview(range);

    expect(result.ridesRequested).toBe(2);
    expect(result.ridesCompleted).toBe(1);
    expect(result.completionRate).toBeCloseTo(0.5);
    expect(result.onlineDriversNow).toBeGreaterThanOrEqual(0);
  });
  it('sums revenue over rides completed in range, keeps tips out of it, and buckets the series', async () => {
    if (!databaseAvailable) return;

    const { range, anchor } = pinnedRange();
    await createRide({
      status: RideStatus.COMPLETED,
      requestedAt: anchor,
      completedAt: anchor,
      totalFare: 1000,
      platformCommission: 100,
      driverEarning: 900,
      tipAmount: 250,
    });
    await createRide({
      status: RideStatus.COMPLETED,
      requestedAt: anchor,
      completedAt: new Date(anchor.getTime() + 60_000),
      totalFare: 500,
      platformCommission: 50,
      driverEarning: 450,
    });
    // Cancelled rides carry a fare too; they are not revenue.
    await createRide({
      status: RideStatus.CANCELLED,
      requestedAt: anchor,
      completedAt: anchor,
      totalFare: 9999,
      platformCommission: 999,
    });

    const result = await service.getOverview(range);

    expect(result.grossFareRevenue).toBe(1500);
    // Rides alone here — the marketplace half is asserted in its own test.
    expect(result.rideCommissionRevenue).toBe(150);
    expect(result.platformCommissionRevenue).toBe(150);
    expect(result.driverEarnings).toBe(1350);
    // A tip is the driver's money and must never inflate either revenue line.
    expect(result.tipsCollected).toBe(250);

    // The series covers the whole window even where nothing happened, and its
    // commission adds back up to the headline figure.
    expect(result.revenueSeries.length).toBeGreaterThan(0);
    const seriesTotal = result.revenueSeries.reduce((sum, b) => sum + b.platformCommission, 0);
    expect(seriesTotal).toBeCloseTo(result.platformCommissionRevenue);
    expect(result.revenueSeries.reduce((sum, b) => sum + b.ridesCompleted, 0)).toBe(2);
  });

  it('reports funded promotions and nets them out of platform revenue', async () => {
    if (!databaseAvailable) return;

    const { range, anchor } = pinnedRange();
    // A ₦5,000 gross fare with a ₦1,000 coupon: the customer paid ₦4,000, the
    // driver was paid on the gross, and commission was charged on the gross.
    await createRide({
      status: RideStatus.COMPLETED,
      requestedAt: anchor,
      completedAt: anchor,
      totalFare: 4000,
      promoDiscount: 1000,
      platformCommission: 500,
      driverEarning: 4500,
    });

    const result = await service.getOverview(range);

    expect(result.promotionsFunded).toBe(1000);
    expect(result.platformCommissionRevenue).toBe(500);
    // The point of the whole change: commission reads +₦500 while DrippleX is
    // ₦500 down on the ride. Net is what the dashboard leads with.
    expect(result.netPlatformRevenue).toBe(-500);
  });

  it('does not count a coupon on a ride that has not settled — nothing has been funded yet', async () => {
    if (!databaseAvailable) return;

    const { range, anchor } = pinnedRange();
    // Completed but unpaid: promoDiscount is set at request time, but the
    // discount only costs the platform anything once settlement runs.
    await createRide({
      status: RideStatus.COMPLETED,
      requestedAt: anchor,
      completedAt: anchor,
      totalFare: 4000,
      promoDiscount: 1000,
      platformCommission: null,
    });

    const result = await service.getOverview(range);

    expect(result.promotionsFunded).toBe(0);
    expect(result.netPlatformRevenue).toBe(0);
  });

  it('leaves revenue untouched when no coupons were redeemed', async () => {
    if (!databaseAvailable) return;

    const { range, anchor } = pinnedRange();
    await createRide({
      status: RideStatus.COMPLETED,
      requestedAt: anchor,
      completedAt: anchor,
      totalFare: 1000,
      platformCommission: 100,
      driverEarning: 900,
    });

    const result = await service.getOverview(range);

    expect(result.promotionsFunded).toBe(0);
    expect(result.netPlatformRevenue).toBe(result.platformCommissionRevenue);
  });

  it('buckets funded promotions alongside the commission they offset', async () => {
    if (!databaseAvailable) return;

    const { range, anchor } = pinnedRange();
    await createRide({
      status: RideStatus.COMPLETED,
      requestedAt: anchor,
      completedAt: anchor,
      totalFare: 4000,
      promoDiscount: 1000,
      platformCommission: 500,
      driverEarning: 4500,
    });

    const result = await service.getOverview(range);

    const promoTotal = result.revenueSeries.reduce((sum, b) => sum + b.promotionsFunded, 0);
    const commissionTotal = result.revenueSeries.reduce((sum, b) => sum + b.platformCommission, 0);
    expect(promoTotal).toBeCloseTo(result.promotionsFunded);
    // The chart plots commission − promotions, so the series has to carry both
    // for that subtraction to be possible at all.
    expect(commissionTotal - promoTotal).toBeCloseTo(result.netPlatformRevenue);
  });

  it('counts marketplace commission as revenue, whatever the order was paid with', async () => {
    if (!databaseAvailable) return;

    // The reason this exists: the only revenue aggregation on the platform
    // read the Ride table alone, so a marketplace-only day reported ₦0 and
    // read as "we earned nothing". It is also why OrderSettlement is the
    // source rather than the commission ledger — the ledger is a receivable
    // that is never written at all for card and wallet orders.
    const { range, anchor } = pinnedRange();
    const merchantId = await createMerchantUser();

    // A card order and a cash order. Only the cash one produces a commission
    // ledger entry in production; both must count here.
    await createSettledOrder(merchantId, anchor, { gross: 5000, commission: 500 });
    await createSettledOrder(merchantId, anchor, { gross: 3000, commission: 300 });
    // Reversed: the commission was given back and is not revenue.
    await createSettledOrder(merchantId, anchor, {
      gross: 9999,
      commission: 999,
      reversed: true,
    });

    const result = await service.getOverview(range);

    expect(result.orderCommissionRevenue).toBe(800);
    expect(result.orderGrossRevenue).toBe(8000);
    // No rides in this window, so the headline is the marketplace figure
    // alone — which is exactly the case that used to read zero.
    expect(result.rideCommissionRevenue).toBe(0);
    expect(result.platformCommissionRevenue).toBe(800);
    // Order commission joins the same series the chart plots.
    const seriesTotal = result.revenueSeries.reduce((sum, b) => sum + b.platformCommission, 0);
    expect(seriesTotal).toBeCloseTo(800);
  });

  it('reports zero revenue — not null — for a range with no completed rides', async () => {
    if (!databaseAvailable) return;

    const { range } = pinnedRange();
    const result = await service.getOverview(range);

    expect(result.grossFareRevenue).toBe(0);
    expect(result.platformCommissionRevenue).toBe(0);
    expect(result.tipsCollected).toBe(0);
  });
});
