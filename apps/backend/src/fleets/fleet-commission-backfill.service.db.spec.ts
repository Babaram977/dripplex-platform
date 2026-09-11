import { randomUUID } from 'node:crypto';

import {
  DeliveryStatus,
  FleetMemberRole,
  FleetMemberStatus,
  FulfillmentType,
  OrderStatus,
  PrismaClient,
  RideStatus,
  RideType,
} from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { CommercialCreditSettingsService } from '../commercial/commercial-credit-settings.service';
import { CommissionAccountService } from '../commercial/commission-account.service';
import { CommissionRateResolverService } from '../commercial/commission-rate-resolver.service';

import { FleetCommissionBackfillService } from './fleet-commission-backfill.service';
import { FleetCommissionService } from './fleet-commission.service';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * DPX-AUDIT-001 §3.1 — reconstructing what a fleet actually owes.
 *
 * Every fleet's commission period holds zero because the subscriber never
 * fired. The rides and delivery jobs are still there, so the months are
 * recomputable — and these tests are about getting a real company's bill right.
 */
describe('FleetCommissionBackfillService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let backfill: FleetCommissionBackfillService;
  let commission: FleetCommissionService;
  let fleetId: string;
  let ownerId: string;
  let driverId: string;
  let customerId: string;
  /** A Lagos month that has certainly closed. */
  let lastMonth: Date;
  const createdUserIds: string[] = [];
  const createdRideIds: string[] = [];
  const createdDeliveryJobIds: string[] = [];
  const createdOrderIds: string[] = [];

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
    const auditService = new AuditService(auditLogRepository);
    commission = new FleetCommissionService(
      prisma,
      new CommissionAccountService(
        prisma,
        auditService,
        new CommercialCreditSettingsService(prisma, auditService),
      ),
      auditService,
      new CommissionRateResolverService(prisma),
    );
    backfill = new FleetCommissionBackfillService(prisma, commission, auditService);

    // The month before this one, which the live path is no longer writing to.
    const now = new Date();
    lastMonth = commission.monthStart(new Date(commission.monthStart(now).getTime() - 1000));

    ownerId = await createUser('owner');
    driverId = await createUser('driver');
    customerId = await createUser('customer');

    const fleet = await prisma.fleet.create({
      data: {
        ownerId,
        fleetNumber: `DX-FL-${String(Math.floor(Math.random() * 8999) + 1000)}`,
        name: 'Backfill Fleet',
        // Created well before the month under test, so reconstructAll walks it.
        createdAt: new Date(lastMonth.getTime() - 40 * 24 * 60 * 60 * 1000),
      },
    });
    fleetId = fleet.id;

    await prisma.fleetMember.create({
      data: {
        fleetId,
        userId: driverId,
        role: FleetMemberRole.DRIVER,
        status: FleetMemberStatus.ACTIVE,
        joinedAt: new Date(lastMonth.getTime() - 30 * 24 * 60 * 60 * 1000),
      },
    });
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.deliveryJob.deleteMany({ where: { id: { in: createdDeliveryJobIds } } });
      await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
      await prisma.ride.deleteMany({ where: { id: { in: createdRideIds } } });
      await prisma.fleetCommissionPeriodSegment
        .deleteMany({ where: { period: { fleetId } } })
        .catch(() => undefined);
      await prisma.fleetCommissionPeriod.deleteMany({ where: { fleetId } }).catch(() => undefined);
      await prisma.fleetMember.deleteMany({ where: { fleetId } });
      await prisma.fleet.delete({ where: { id: fleetId } }).catch(() => undefined);
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  // Each test states a whole month's worth of work and then asserts the total
  // it adds up to, so the month has to start empty every time: left in place,
  // the previous test's rides are indistinguishable from this one's.
  afterEach(async () => {
    if (!databaseAvailable) return;
    await prisma.deliveryJob.deleteMany({ where: { id: { in: createdDeliveryJobIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    await prisma.ride.deleteMany({ where: { id: { in: createdRideIds } } });
    createdDeliveryJobIds.length = 0;
    createdOrderIds.length = 0;
    createdRideIds.length = 0;
    await prisma.fleetCommissionPeriodSegment
      .deleteMany({ where: { period: { fleetId } } })
      .catch(() => undefined);
    await prisma.fleetCommissionPeriod.deleteMany({ where: { fleetId } }).catch(() => undefined);
  });

  async function createUser(label: string): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `fleet-backfill-${label}-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: label,
      },
    });
    createdUserIds.push(user.id);
    return user.id;
  }

  /** A completed ride mid-way through the month under test. */
  async function rideInLastMonth(
    totalFare: number,
    promoDiscount: number,
    driver = driverId,
  ): Promise<void> {
    const ride = await prisma.ride.create({
      data: {
        customerId,
        driverId: driver,
        status: RideStatus.COMPLETED,
        rideType: RideType.ECONOMY,
        totalFare,
        promoDiscount,
        completedAt: new Date(lastMonth.getTime() + 5 * 24 * 60 * 60 * 1000),
        pickupAddress: 'Test pickup',
        pickupLatitude: 6.5,
        pickupLongitude: 3.3,
        dropoffAddress: 'Test dropoff',
        dropoffLatitude: 6.6,
        dropoffLongitude: 3.4,
      },
      select: { id: true },
    });
    createdRideIds.push(ride.id);
  }

  async function deliveryInLastMonth(deliveryFee: number, rider: string): Promise<void> {
    const order = await prisma.order.create({
      data: {
        customerId,
        merchantId: ownerId,
        orderNumber: `BF-${randomUUID().slice(0, 12).toUpperCase()}`,
        status: OrderStatus.COMPLETED,
        fulfillmentType: FulfillmentType.DELIVERY,
        subtotal: 4000,
        total: 4000,
      },
      select: { id: true },
    });
    createdOrderIds.push(order.id);

    const job = await prisma.deliveryJob.create({
      data: {
        orderId: order.id,
        riderId: rider,
        customerId,
        merchantId: ownerId,
        status: DeliveryStatus.DELIVERED,
        deliveryFee,
        pickupLatitude: 6.5,
        pickupLongitude: 3.3,
        dropoffLatitude: 6.6,
        dropoffLongitude: 3.4,
        deliveredAt: new Date(lastMonth.getTime() + 6 * 24 * 60 * 60 * 1000),
      },
      select: { id: true },
    });
    createdDeliveryJobIds.push(job.id);
  }

  async function reconstruct(apply: boolean): Promise<{
    actualOrderCount: number;
    actualChargeableTotal: number;
    missingChargeableTotal: number;
    applied: boolean;
    settled: boolean;
  }> {
    return await backfill.reconstructMonth({ fleetId, monthStart: lastMonth, apply });
  }

  it('recovers a month the subscriber never counted', async () => {
    if (!databaseAvailable) return;
    // The state every fleet is actually in: work done, nothing recorded.
    await rideInLastMonth(4000, 0);
    await rideInLastMonth(2500, 0);

    const report = await reconstruct(false);

    expect(report.actualOrderCount).toBe(2);
    expect(report.actualChargeableTotal).toBe(6500);
    expect(report.missingChargeableTotal).toBe(6500);
  });

  it('reports without writing until it is told to apply', async () => {
    if (!databaseAvailable) return;
    // The first thing anybody should do with this is look.
    await rideInLastMonth(4000, 0);

    await reconstruct(false);

    const period = await prisma.fleetCommissionPeriod.findFirst({ where: { fleetId } });
    expect(period).toBeNull();
  });

  it('writes the recovered totals when applied', async () => {
    if (!databaseAvailable) return;
    await rideInLastMonth(4000, 0);
    await rideInLastMonth(1000, 0);

    const report = await reconstruct(true);
    expect(report.applied).toBe(true);

    const period = await prisma.fleetCommissionPeriod.findFirstOrThrow({ where: { fleetId } });
    expect(period.orderCount).toBe(2);
    expect(Number(period.chargeableTotal)).toBe(5000);
  });

  it('lands on the same number however often it is run', async () => {
    if (!databaseAvailable) return;
    // An operator will re-run this. Setting rather than incrementing is what
    // makes that safe — and doubling a fleet's bill is the failure it prevents.
    await rideInLastMonth(3000, 0);

    await reconstruct(true);
    await reconstruct(true);
    await reconstruct(true);

    const period = await prisma.fleetCommissionPeriod.findFirstOrThrow({ where: { fleetId } });
    expect(Number(period.chargeableTotal)).toBe(3000);
    expect(period.orderCount).toBe(1);
  });

  it('counts a discounted ride on its gross fare', async () => {
    if (!databaseAvailable) return;
    // Same basis as the live path: DrippleX funds its own coupons, so the fleet
    // is billed on what the trip was worth.
    await rideInLastMonth(4500, 500);

    const report = await reconstruct(false);

    expect(report.actualChargeableTotal).toBe(5000);
  });

  it('counts deliveries alongside rides', async () => {
    if (!databaseAvailable) return;
    const riderId = await createUser('backfill-rider');
    await prisma.fleetMember.create({
      data: {
        fleetId,
        userId: riderId,
        role: FleetMemberRole.RIDER,
        status: FleetMemberStatus.ACTIVE,
        joinedAt: new Date(lastMonth.getTime() - 20 * 24 * 60 * 60 * 1000),
      },
    });
    await rideInLastMonth(2000, 0);
    await deliveryInLastMonth(800, riderId);

    const report = await reconstruct(false);

    expect(report.actualOrderCount).toBe(2);
    expect(report.actualChargeableTotal).toBe(2800);
  });

  it('counts the work of a member who has since left', async () => {
    if (!databaseAvailable) return;
    // The population most likely to have moved on, over months of history.
    // Reading today's membership would drop their work entirely.
    const leaverId = await createUser('leaver');
    await prisma.fleetMember.create({
      data: {
        fleetId,
        userId: leaverId,
        role: FleetMemberRole.DRIVER,
        status: FleetMemberStatus.REMOVED,
        joinedAt: new Date(lastMonth.getTime() - 15 * 24 * 60 * 60 * 1000),
        // Left after the month under test.
        removedAt: new Date(lastMonth.getTime() + 40 * 24 * 60 * 60 * 1000),
      },
    });
    await rideInLastMonth(1500, 0, leaverId);

    const report = await reconstruct(false);

    expect(report.actualOrderCount).toBe(1);
    expect(report.actualChargeableTotal).toBe(1500);
  });

  it('ignores work done before somebody joined the fleet', async () => {
    if (!databaseAvailable) return;
    // A driver's earlier trips were not this fleet's work.
    const joinerId = await createUser('late-joiner');
    await prisma.fleetMember.create({
      data: {
        fleetId,
        userId: joinerId,
        role: FleetMemberRole.DRIVER,
        status: FleetMemberStatus.ACTIVE,
        // Joined after the month under test ended.
        joinedAt: new Date(commission.monthEnd(lastMonth).getTime() + 24 * 60 * 60 * 1000),
      },
    });
    await rideInLastMonth(9000, 0, joinerId);

    const report = await reconstruct(false);

    expect(report.actualOrderCount).toBe(0);
  });

  it('never rewrites a month that has already been invoiced', async () => {
    if (!databaseAvailable) return;
    // An invoice that has gone out is a number somebody agreed to. The
    // shortfall is reported and left for a human.
    await rideInLastMonth(4000, 0);
    await prisma.fleetCommissionPeriod.create({
      data: {
        fleetId,
        periodStart: lastMonth,
        periodEnd: commission.monthEnd(lastMonth),
        orderCount: 0,
        chargeableTotal: 0,
        settledAt: new Date(),
        settledBy: ownerId,
      },
    });

    const report = await reconstruct(true);

    expect(report.settled).toBe(true);
    expect(report.applied).toBe(false);
    expect(report.missingChargeableTotal).toBe(4000);
    const period = await prisma.fleetCommissionPeriod.findFirstOrThrow({ where: { fleetId } });
    expect(Number(period.chargeableTotal)).toBe(0);
  });

  it('refuses to reconstruct the month still being counted', async () => {
    if (!databaseAvailable) return;
    // The live path is writing to it now, and rewriting would race it.
    await expect(
      backfill.reconstructMonth({ fleetId, monthStart: new Date(), apply: false }),
    ).rejects.toThrow(/has closed/i);
  });
});
