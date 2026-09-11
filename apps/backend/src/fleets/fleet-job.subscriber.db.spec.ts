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
import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../events/domain-events';

import { FleetCommissionService } from './fleet-commission.service';
import { FleetJobSubscriber } from './fleet-job.subscriber';
import { FleetsService } from './fleets.service';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * DPX-AUDIT-001 — a fleet is billed on the gross fare, before any coupon.
 *
 * `ride.totalFare` is stored discounted, so counting it billed the fleet on the
 * net while the driver beside them was already paid on the gross — the same
 * mistake DPX-PROMO-FUNDING fixed for the driver split, one ledger over. This
 * subscriber had no test at all, which is how it survived the fix next door.
 */
describe('FleetJobSubscriber', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let eventBus: DomainEventBus;
  let fleetId: string;
  let ownerId: string;
  let driverId: string;
  let customerId: string;
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
    eventBus = new DomainEventBus();

    const commission = new FleetCommissionService(
      prisma,
      new CommissionAccountService(
        prisma,
        auditService,
        new CommercialCreditSettingsService(prisma, auditService),
      ),
      auditService,
      new CommissionRateResolverService(prisma),
    );

    // The real subscriber on a real bus: the handlers are private, and driving
    // them through the event is the path production actually takes.
    new FleetJobSubscriber(
      eventBus,
      prisma,
      new FleetsService(prisma, auditService),
      commission,
    ).onModuleInit();

    ownerId = await createUser('owner');
    driverId = await createUser('driver');
    customerId = await createUser('customer');

    const fleet = await prisma.fleet.create({
      data: {
        ownerId,
        fleetNumber: `DX-FL-${String(Math.floor(Math.random() * 8999) + 1000)}`,
        name: 'Gross Fare Fleet',
      },
    });
    fleetId = fleet.id;

    await prisma.fleetMember.create({
      data: {
        fleetId,
        userId: driverId,
        role: FleetMemberRole.DRIVER,
        status: FleetMemberStatus.ACTIVE,
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

  async function createUser(label: string): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `fleet-job-${label}-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: label,
      },
    });
    createdUserIds.push(user.id);
    return user.id;
  }

  /** A completed ride by the fleet's driver, charged `totalFare` after a
   *  `promoDiscount` coupon — exactly how `rides.service.ts` stores one. */
  async function completedRide(totalFare: number, promoDiscount: number): Promise<string> {
    const ride = await prisma.ride.create({
      data: {
        customerId,
        driverId,
        status: RideStatus.COMPLETED,
        rideType: RideType.ECONOMY,
        totalFare,
        promoDiscount,
        completedAt: new Date(),
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
    return ride.id;
  }

  async function chargeableTotal(): Promise<number> {
    const period = await prisma.fleetCommissionPeriod.findFirst({
      where: { fleetId },
      orderBy: { periodStart: 'desc' },
    });
    return period === null ? 0 : Number(period.chargeableTotal);
  }

  it('bills the fleet on the gross fare, not on what the customer paid', async () => {
    if (!databaseAvailable) return;
    // ₦4,500 charged after a ₦500 coupon. The driver is paid on ₦5,000
    // (DPX-PROMO-FUNDING), so the fleet is billed on ₦5,000 too. Billing the
    // net would quietly hand DrippleX's marketing spend to the fleet as a
    // discount on their commission.
    const rideId = await completedRide(4500, 500);

    await eventBus.emit(DOMAIN_EVENTS.RIDE_COMPLETED, { rideId });
    // emit() returns before handlers run; drain() is how the bus exposes them.
    await eventBus.drain();

    expect(await chargeableTotal()).toBe(5000);
  });

  it('counts an undiscounted ride at its fare, unchanged', async () => {
    if (!databaseAvailable) return;
    // The overwhelmingly common case, and the one that must not move: with no
    // coupon the gross and the net are the same number.
    const before = await chargeableTotal();
    const rideId = await completedRide(3000, 0);

    await eventBus.emit(DOMAIN_EVENTS.RIDE_COMPLETED, { rideId });
    // emit() returns before handlers run; drain() is how the bus exposes them.
    await eventBus.drain();

    expect(await chargeableTotal()).toBe(before + 3000);
  });

  it('counts a fleet rider\u2019s delivery at the fee charged', async () => {
    if (!databaseAvailable) return;
    // The delivery branch read the event wrapper the same way the ride branch
    // did, so it counted nothing either. Nothing discounts a delivery fee, so
    // there is no gross/net distinction here — only that it now arrives.
    const before = await chargeableTotal();
    const riderId = await createUser('fleet-rider');
    await prisma.fleetMember.create({
      data: {
        fleetId,
        userId: riderId,
        role: FleetMemberRole.RIDER,
        status: FleetMemberStatus.ACTIVE,
      },
    });
    // A delivery job hangs off a real order — the schema requires it.
    const order = await prisma.order.create({
      data: {
        customerId,
        merchantId: ownerId,
        orderNumber: `FLEET-${randomUUID().slice(0, 12).toUpperCase()}`,
        status: OrderStatus.COMPLETED,
        fulfillmentType: FulfillmentType.DELIVERY,
        subtotal: 5000,
        total: 5000,
      },
      select: { id: true },
    });
    createdOrderIds.push(order.id);

    const job = await prisma.deliveryJob.create({
      data: {
        orderId: order.id,
        riderId,
        customerId,
        merchantId: ownerId,
        status: DeliveryStatus.DELIVERED,
        deliveryFee: 1200,
        pickupLatitude: 6.5,
        pickupLongitude: 3.3,
        dropoffLatitude: 6.6,
        dropoffLongitude: 3.4,
        deliveredAt: new Date(),
      },
      select: { id: true },
    });
    createdDeliveryJobIds.push(job.id);

    await eventBus.emit(DOMAIN_EVENTS.DELIVERY_COMPLETED, {
      deliveryJobId: job.id,
      riderId,
    });
    await eventBus.drain();

    expect(await chargeableTotal()).toBe(before + 1200);
  });

  it('ignores a ride by a driver who is on no fleet', async () => {
    if (!databaseAvailable) return;
    const before = await chargeableTotal();
    const loneDriverId = await createUser('lone-driver');
    const ride = await prisma.ride.create({
      data: {
        customerId,
        driverId: loneDriverId,
        status: RideStatus.COMPLETED,
        rideType: RideType.ECONOMY,
        totalFare: 2000,
        promoDiscount: 0,
        completedAt: new Date(),
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

    await eventBus.emit(DOMAIN_EVENTS.RIDE_COMPLETED, { rideId: ride.id });
    // emit() returns before handlers run; drain() is how the bus exposes them.
    await eventBus.drain();

    expect(await chargeableTotal()).toBe(before);
  });
});
