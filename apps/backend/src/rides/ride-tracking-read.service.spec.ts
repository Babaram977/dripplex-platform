import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { RideTrackingReadService } from './ride-tracking-read.service';

import type { PrismaService } from '../prisma/prisma.service';
import type { Ride } from '@prisma/client';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

describe('RideTrackingReadService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: RideTrackingReadService;
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

    service = new RideTrackingReadService(prisma);

    const customer = await prisma.user.create({
      data: {
        email: `ride-tracking-customer-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Customer',
      },
    });
    customerId = customer.id;
    createdUserIds.push(customerId);

    const driver = await prisma.user.create({
      data: {
        email: `ride-tracking-driver-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Ada',
        lastName: 'Driverson',
      },
    });
    driverId = driver.id;
    createdUserIds.push(driverId);
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.ride.deleteMany({ where: { id: { in: createdRideIds } } });
      await prisma.driverAvailability.delete({ where: { driverId } }).catch(() => undefined);
      await prisma.driverProfile.delete({ where: { userId: driverId } }).catch(() => undefined);
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  async function createRide(): Promise<Ride> {
    const ride = await prisma.ride.create({
      data: {
        customerId,
        rideType: 'ECONOMY',
        status: 'IN_PROGRESS',
        pickupLatitude: 6.6,
        pickupLongitude: 3.35,
        dropoffLatitude: 6.62,
        dropoffLongitude: 3.37,
        baseFare: 300,
        distanceFare: 200,
        timeFare: 50,
        totalFare: 550,
        paymentStatus: 'PENDING',
      },
    });
    createdRideIds.push(ride.id);
    return ride;
  }

  describe('getNearbyDrivers', () => {
    afterEach(async () => {
      if (!databaseAvailable) return;
      await prisma.driverAvailability.deleteMany({ where: { driverId } });
      await prisma.driverProfile.deleteMany({ where: { userId: driverId } });
    });

    it('returns an approved online driver within radius, rounded for privacy', async () => {
      if (!databaseAvailable) return;

      await prisma.driverProfile.create({
        data: { userId: driverId, status: 'APPROVED' },
      });
      await prisma.driverAvailability.create({
        data: {
          driverId,
          online: true,
          acceptingRides: true,
          vehicleType: 'ECONOMY',
          latitude: 6.60011,
          longitude: 3.35009,
          // Dispatch ignores a driver whose position is older than
          // DRIVER_LOCATION_MAX_AGE_MS, so a fixture that omits this is
          // a driver who has not reported in — not an available one.
          locationUpdatedAt: new Date(),
        },
      });

      const results = await service.getNearbyDrivers({
        latitude: 6.6,
        longitude: 3.35,
        rideType: 'ECONOMY',
        radiusMeters: 5_000,
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        latitude: expect.closeTo(6.6001, 4),
        longitude: expect.closeTo(3.3501, 4),
        vehicleType: 'ECONOMY',
      });
    });

    it('excludes drivers outside the search radius', async () => {
      if (!databaseAvailable) return;

      await prisma.driverProfile.create({
        data: { userId: driverId, status: 'APPROVED' },
      });
      await prisma.driverAvailability.create({
        data: {
          driverId,
          online: true,
          acceptingRides: true,
          vehicleType: 'ECONOMY',
          latitude: 6.9,
          longitude: 3.9,
          // Dispatch ignores a driver whose position is older than
          // DRIVER_LOCATION_MAX_AGE_MS, so a fixture that omits this is
          // a driver who has not reported in — not an available one.
          locationUpdatedAt: new Date(),
        },
      });

      const results = await service.getNearbyDrivers({
        latitude: 6.6,
        longitude: 3.35,
        rideType: 'ECONOMY',
        radiusMeters: 5_000,
      });

      expect(results).toHaveLength(0);
    });

    it('excludes drivers not accepting rides', async () => {
      if (!databaseAvailable) return;

      await prisma.driverProfile.create({
        data: { userId: driverId, status: 'APPROVED' },
      });
      await prisma.driverAvailability.create({
        data: {
          driverId,
          online: true,
          acceptingRides: false,
          vehicleType: 'ECONOMY',
          latitude: 6.6,
          longitude: 3.35,
          // Dispatch ignores a driver whose position is older than
          // DRIVER_LOCATION_MAX_AGE_MS, so a fixture that omits this is
          // a driver who has not reported in — not an available one.
          locationUpdatedAt: new Date(),
        },
      });

      const results = await service.getNearbyDrivers({
        latitude: 6.6,
        longitude: 3.35,
        rideType: 'ECONOMY',
        radiusMeters: 5_000,
      });

      expect(results).toHaveLength(0);
    });
  });

  describe('getTrackingHistory', () => {
    it('returns breadcrumb points in chronological order', async () => {
      if (!databaseAvailable) return;

      const ride = await createRide();
      await prisma.rideTracking.create({
        data: { rideId: ride.id, latitude: 6.601, longitude: 3.351 },
      });
      await prisma.rideTracking.create({
        data: { rideId: ride.id, latitude: 6.602, longitude: 3.352, heading: 90, speed: 5.5 },
      });

      const points = await service.getTrackingHistory(customerId, ride.id);

      expect(points).toHaveLength(2);
      expect(points[0]?.latitude).toBe(6.601);
      expect(points[1]).toMatchObject({ heading: 90, speed: 5.5 });
      expect(new Date(points[0]?.at ?? 0).getTime()).toBeLessThanOrEqual(
        new Date(points[1]?.at ?? 0).getTime(),
      );
    });

    it('rejects a ride not owned by the caller', async () => {
      if (!databaseAvailable) return;

      const ride = await createRide();

      await expect(service.getTrackingHistory(randomUUID(), ride.id)).rejects.toThrow(
        'Ride not found',
      );
    });
  });
});
