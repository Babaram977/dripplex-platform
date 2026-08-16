import { randomUUID } from 'node:crypto';

import { Test } from '@nestjs/testing';
import {
  AssignmentMethod,
  DeliveryStatus,
  FulfillmentType,
  OrderPaymentMethod,
  OrderStatus,
  PaymentStatus,
  PrismaClient,
  RidePaymentStatus,
  RideStatus,
  RideType,
} from '@prisma/client';

import { AppModule } from '../app.module';
import { RidesService } from '../rides/rides.service';

import { DeliveryService } from './delivery.service';

import type { TestingModule } from '@nestjs/testing';

/**
 * DPX-CHAT-002 — the courier learns a name, and only a name.
 *
 * A rider carrying an order and a driver carrying a passenger both need to
 * know who they are looking for, and to open a chat thread that says who is on
 * the other end. Until now both saw a bare UUID.
 *
 * What these specs pin is not "a name comes back" — it is the boundary either
 * side of it. A phone number, once handed to a courier, outlives the job,
 * leaves the platform and cannot be withdrawn; a name does not. So the shape
 * of the payload is the control, and it is asserted explicitly: the exact keys
 * added, and no contact field smuggled in beside them.
 */
describe('counterpart identity on a live job (real database)', () => {
  const databaseUrl = process.env['DATABASE_URL'] ?? '';
  let prisma: PrismaClient;
  let moduleRef: TestingModule | null = null;
  let deliveries: DeliveryService;
  let rides: RidesService;
  let databaseAvailable = false;

  const createdUserIds: string[] = [];
  let customerId = '';
  let riderId = '';
  let driverId = '';
  let merchantUserId = '';
  let merchantProfileId = '';
  let deliveryJobId = '';
  let rideId = '';

  const makeUser = async (first: string, last: string): Promise<string> => {
    const user = await prisma.user.create({
      data: {
        email: `${first.toLowerCase()}-${randomUUID()}@example.test`,
        // A real, distinctive phone number on the customer — the leak test below
        // searches the serialised payload for exactly this string.
        phone: `+234${randomUUID().replace(/\D/g, '').padEnd(10, '7').slice(0, 10)}`,
        passwordHash: 'x',
        firstName: first,
        lastName: last,
      },
    });
    createdUserIds.push(user.id);
    return user.id;
  };

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    try {
      await prisma.$connect();
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
      return;
    }

    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    deliveries = moduleRef.get(DeliveryService);
    rides = moduleRef.get(RidesService);

    customerId = await makeUser('Mamman', 'Isa');
    riderId = await makeUser('Tunde', 'Baba');
    driverId = await makeUser('Sani', 'Musa');
    merchantUserId = await makeUser('Merchant', 'Owner');
    const profile = await prisma.merchantProfile.create({ data: { userId: merchantUserId } });
    merchantProfileId = profile.id;

    const order = await prisma.order.create({
      data: {
        customerId,
        merchantId: merchantProfileId,
        orderNumber: `DPX-${randomUUID().slice(0, 12).toUpperCase()}`,
        status: OrderStatus.READY,
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: OrderPaymentMethod.PAYSTACK,
        fulfillmentType: FulfillmentType.DELIVERY,
        subtotal: 5000,
        deliveryFee: 1500,
        total: 6500,
      },
    });
    const job = await prisma.deliveryJob.create({
      data: {
        orderId: order.id,
        riderId,
        merchantId: merchantUserId,
        customerId,
        assignmentMethod: AssignmentMethod.AUTO,
        status: DeliveryStatus.ON_THE_WAY,
        pickupLatitude: 6.5244,
        pickupLongitude: 3.3792,
        dropoffLatitude: 6.6018,
        dropoffLongitude: 3.3515,
        deliveryFee: 1500,
      },
    });
    deliveryJobId = job.id;

    const ride = await prisma.ride.create({
      data: {
        customerId,
        driverId,
        rideType: RideType.ECONOMY,
        status: RideStatus.IN_PROGRESS,
        pickupLatitude: 6.5244,
        pickupLongitude: 3.3792,
        dropoffLatitude: 6.6018,
        dropoffLongitude: 3.3515,
        baseFare: 1500,
        distanceFare: 0,
        timeFare: 0,
        totalFare: 1500,
        paymentStatus: RidePaymentStatus.PENDING,
        assignedAt: new Date(),
      },
    });
    rideId = ride.id;
  }, 60_000);

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.ride.deleteMany({ where: { customerId } });
      await prisma.deliveryJob.deleteMany({ where: { customerId } });
      await prisma.order.deleteMany({ where: { customerId } });
      await prisma.merchantProfile.deleteMany({ where: { id: merchantProfileId } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await moduleRef?.close();
    await prisma.$disconnect();
  });

  it("shows the rider their customer's full name, not an id", async () => {
    if (!databaseAvailable) return;

    const job = await deliveries.getRiderJob(riderId, deliveryJobId);

    expect(job.customerName).toBe('Mamman Isa');
    // Both halves, not just the first name — "Mamman" alone does not identify
    // anyone at a gate with several people waiting.
    expect(job.customerName).not.toBe('Mamman');
    expect(job.customerName).not.toContain(customerId);
  });

  it('never hands the rider the customer phone number', async () => {
    if (!databaseAvailable) return;

    const job = await deliveries.getRiderJob(riderId, deliveryJobId);
    const customer = await prisma.user.findUniqueOrThrow({ where: { id: customerId } });

    // Asserted on the serialised payload, not on a named field: this catches a
    // future `include: { customer: true }` that would leak the number through
    // a nested object nobody thought to check.
    const serialised = JSON.stringify(job);
    expect(serialised).not.toContain(customer.phone ?? '@@no-phone@@');
    expect(Object.keys(job)).not.toContain('customerPhone');
  });

  it('carries the name into the rider job list too, not only the detail view', async () => {
    if (!databaseAvailable) return;

    const jobs = await deliveries.listRiderJobs(riderId);
    const mine = jobs.find((job) => job.id === deliveryJobId);

    expect(mine?.customerName).toBe('Mamman Isa');
  });

  it("shows the driver their passenger's full name on the active ride", async () => {
    if (!databaseAvailable) return;

    const active = await rides.getActiveRide(driverId);

    expect(active?.id).toBe(rideId);
    expect(active?.customerName).toBe('Mamman Isa');
    expect(Object.keys(active ?? {})).not.toContain('customerPhone');
  });

  it('shows the passenger their driver by name, mirroring the delivery side', async () => {
    if (!databaseAvailable) return;

    const ride = await rides.getOwnRide(customerId, rideId);

    expect(ride.driverName).toBe('Sani Musa');
  });

  it('reports no counterpart rather than a wrong one when nobody is assigned yet', async () => {
    if (!databaseAvailable) return;

    const unassigned = await prisma.ride.create({
      data: {
        customerId,
        rideType: RideType.ECONOMY,
        status: RideStatus.REQUESTED,
        pickupLatitude: 6.5244,
        pickupLongitude: 3.3792,
        dropoffLatitude: 6.6018,
        dropoffLongitude: 3.3515,
        baseFare: 1500,
        distanceFare: 0,
        timeFare: 0,
        totalFare: 1500,
        paymentStatus: RidePaymentStatus.PENDING,
      },
    });

    const ride = await rides.getOwnRide(customerId, unassigned.id);
    expect(ride.driverName).toBeNull();

    await prisma.ride.delete({ where: { id: unassigned.id } });
  });
});
