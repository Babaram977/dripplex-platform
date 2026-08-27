import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { RideReceiptService } from './ride-receipt.service';

import type { PrismaService } from '../prisma/prisma.service';
import type { Ride, RideStatus } from '@prisma/client';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

describe('RideReceiptService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: RideReceiptService;
  let customerId: string;
  let driverId: string;
  const createdUserIds: string[] = [];
  const createdRideIds: string[] = [];

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

    service = new RideReceiptService(prisma);

    const customer = await prisma.user.create({
      data: {
        email: `ride-receipt-customer-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Customer',
      },
    });
    customerId = customer.id;
    createdUserIds.push(customerId);

    const driver = await prisma.user.create({
      data: {
        email: `ride-receipt-driver-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Ada',
        lastName: 'Driverson',
        phone: `+234${String(Date.now()).slice(-9)}`,
      },
    });
    driverId = driver.id;
    createdUserIds.push(driverId);
    await prisma.driverAvailability.create({
      data: { driverId, online: true, acceptingRides: true, vehicleType: 'TRICYCLE' },
    });
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.ride.deleteMany({ where: { id: { in: createdRideIds } } });
      await prisma.driverAvailability.delete({ where: { driverId } }).catch(() => undefined);
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  async function createRide(status: RideStatus, withDriver = true): Promise<Ride> {
    const ride = await prisma.ride.create({
      data: {
        customerId,
        ...(withDriver ? { driverId } : {}),
        rideType: 'ECONOMY',
        status,
        pickupLatitude: 6.6,
        pickupLongitude: 3.35,
        pickupAddress: '1 Ahmadu Bello Way',
        dropoffLatitude: 6.62,
        dropoffLongitude: 3.37,
        dropoffAddress: '2 Zoo Road',
        estimatedDistanceMeters: 2000,
        estimatedDurationSeconds: 300,
        baseFare: 300,
        distanceFare: 200,
        timeFare: 50,
        totalFare: 550,
        paymentMethod: 'WALLET',
        paymentStatus: 'PAID',
        platformCommission: 82.5,
        driverEarning: 467.5,
        tipAmount: 100,
        completedAt: new Date(),
      },
    });
    createdRideIds.push(ride.id);
    return ride;
  }

  it('composes a full receipt with driver and vehicle details for a completed ride', async () => {
    if (!databaseAvailable) return;

    const ride = await createRide('COMPLETED');
    const receipt = await service.getReceipt(customerId, ride.id);

    expect(receipt.rideId).toBe(ride.id);
    expect(receipt.driver).toEqual({
      id: driverId,
      name: 'Ada Driverson',
      phone: expect.stringContaining('+234'),
      vehicleType: 'TRICYCLE',
    });
    expect(receipt.pickupAddress).toBe('1 Ahmadu Bello Way');
    expect(receipt.dropoffAddress).toBe('2 Zoo Road');
    expect(receipt.fare.totalFare).toBe(550);
    expect(receipt.fare.tipAmount).toBe(100);
    expect(receipt.paymentMethod).toBe('WALLET');
    expect(receipt.paymentStatus).toBe('PAID');
  });

  it('returns a null driver when the ride never had one assigned', async () => {
    if (!databaseAvailable) return;

    const ride = await createRide('COMPLETED', false);
    const receipt = await service.getReceipt(customerId, ride.id);

    expect(receipt.driver).toBeNull();
  });

  it('rejects fetching a receipt before the ride is completed', async () => {
    if (!databaseAvailable) return;

    const ride = await createRide('IN_PROGRESS');

    await expect(service.getReceipt(customerId, ride.id)).rejects.toThrow(
      'Receipt not available until ride is completed',
    );
  });

  it('rejects fetching a receipt for a ride not owned by the caller', async () => {
    if (!databaseAvailable) return;

    const ride = await createRide('COMPLETED');

    await expect(service.getReceipt(randomUUID(), ride.id)).rejects.toThrow('Ride not found');
  });

  describe('a trip repriced on real elapsed time (DPX-PRICING-002)', () => {
    it('reports the real duration and shows the quote beside the charge', async () => {
      if (!databaseAvailable) return;

      const ride = await createRide('COMPLETED');
      await prisma.ride.update({
        where: { id: ride.id },
        // What completeTrip writes when a 5-minute estimate turned into a
        // 22-minute crawl: the fare recomputed, the quote preserved.
        data: { actualDurationSeconds: 1320, quotedTotalFare: 550, totalFare: 890 },
      });

      const receipt = await service.getReceipt(customerId, ride.id);

      // The duration that timeFare was charged on, not the one the booking
      // guessed — a receipt whose stated duration doesn't explain its own time
      // line reads as an overcharge.
      expect(receipt.durationSeconds).toBe(1320);
      expect(receipt.estimatedDurationSeconds).toBe(300);
      expect(receipt.fare.quotedTotalFare).toBe(550);
      expect(receipt.fare.totalFare).toBe(890);
    });

    it('omits the quote line when nothing was repriced', async () => {
      if (!databaseAvailable) return;

      const ride = await createRide('COMPLETED');
      await prisma.ride.update({
        where: { id: ride.id },
        data: { actualDurationSeconds: 300, quotedTotalFare: 550 },
      });

      const receipt = await service.getReceipt(customerId, ride.id);

      // Equal to totalFare, so showing it would ask the passenger to compare
      // two identical numbers and wonder what they missed.
      expect(receipt.fare.quotedTotalFare).toBeNull();
    });

    it('falls back to the estimate for rides completed before repricing existed', async () => {
      if (!databaseAvailable) return;

      const ride = await createRide('COMPLETED');
      const receipt = await service.getReceipt(customerId, ride.id);

      // Those rides were charged on the estimate, so the estimate is the honest
      // basis to print. A null duration would lose the explanation entirely.
      expect(receipt.durationSeconds).toBe(300);
      expect(receipt.fare.quotedTotalFare).toBeNull();
    });
  });
});
