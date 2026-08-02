import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import { RideRatingService } from './ride-rating.service';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { PrismaService } from '../prisma/prisma.service';
import type { Ride } from '@prisma/client';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

describe('RideRatingService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: RideRatingService;
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

    const auditLogRepository: jest.Mocked<AuditLogRepository> = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    const auditService = new AuditService(auditLogRepository);
    service = new RideRatingService(prisma, auditService);

    const customer = await prisma.user.create({
      data: {
        email: `ride-rating-customer-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Customer',
      },
    });
    customerId = customer.id;
    createdUserIds.push(customerId);

    const driver = await prisma.user.create({
      data: {
        email: `ride-rating-driver-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Driver',
      },
    });
    driverId = driver.id;
    createdUserIds.push(driverId);
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.rideRating.deleteMany({ where: { rideId: { in: createdRideIds } } });
      await prisma.ride.deleteMany({ where: { id: { in: createdRideIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  async function createCompletedRide(withDriver = true): Promise<Ride> {
    const ride = await prisma.ride.create({
      data: {
        customerId,
        ...(withDriver ? { driverId } : {}),
        rideType: 'ECONOMY',
        status: 'COMPLETED',
        pickupLatitude: 6.6,
        pickupLongitude: 3.35,
        dropoffLatitude: 6.62,
        dropoffLongitude: 3.37,
        totalFare: 1000,
        completedAt: new Date(),
      },
    });
    createdRideIds.push(ride.id);
    return ride;
  }

  it('lets a customer rate the driver with an overall score and category ratings', async () => {
    if (!databaseAvailable) return;

    const ride = await createCompletedRide();
    const rating = await service.rateDriver(
      customerId,
      ride.id,
      { rating: 5, comment: 'Great trip', categoryRatings: { driving: 5, cleanliness: 4 } },
      {},
    );

    expect(rating.raterRole).toBe('CUSTOMER');
    expect(rating.raterId).toBe(customerId);
    expect(rating.rateeId).toBe(driverId);
    expect(rating.rating).toBe(5);
    expect(rating.categoryRatings).toEqual({ driving: 5, cleanliness: 4 });
  });

  it('lets a driver rate the customer independently of the customer rating', async () => {
    if (!databaseAvailable) return;

    const ride = await createCompletedRide();
    await service.rateDriver(customerId, ride.id, { rating: 4 }, {});

    const rating = await service.rateCustomer(
      driverId,
      ride.id,
      { rating: 3, categoryRatings: { behaviour: 3, waitingTime: 2 } },
      {},
    );

    expect(rating.raterRole).toBe('DRIVER');
    expect(rating.raterId).toBe(driverId);
    expect(rating.rateeId).toBe(customerId);
    expect(rating.rating).toBe(3);
  });

  it('rejects a second rating from the same side of the same ride', async () => {
    if (!databaseAvailable) return;

    const ride = await createCompletedRide();
    await service.rateDriver(customerId, ride.id, { rating: 5 }, {});

    await expect(service.rateDriver(customerId, ride.id, { rating: 1 }, {})).rejects.toThrow(
      'Ride has already been rated from this side',
    );
  });

  it('rejects rating a ride that has not completed', async () => {
    if (!databaseAvailable) return;

    const ride = await prisma.ride.create({
      data: {
        customerId,
        driverId,
        rideType: 'ECONOMY',
        status: 'IN_PROGRESS',
        pickupLatitude: 6.6,
        pickupLongitude: 3.35,
        dropoffLatitude: 6.62,
        dropoffLongitude: 3.37,
        totalFare: 1000,
      },
    });
    createdRideIds.push(ride.id);

    await expect(service.rateDriver(customerId, ride.id, { rating: 5 }, {})).rejects.toThrow(
      'Ride cannot be rated from status IN_PROGRESS',
    );
  });

  it('rejects rating a completed ride that never had a driver assigned', async () => {
    if (!databaseAvailable) return;

    const ride = await createCompletedRide(false);

    await expect(service.rateDriver(customerId, ride.id, { rating: 5 }, {})).rejects.toThrow(
      'Ride has no assigned driver to rate',
    );
  });

  it('rejects rating a ride not owned by the caller', async () => {
    if (!databaseAvailable) return;

    const ride = await createCompletedRide();

    await expect(service.rateDriver(randomUUID(), ride.id, { rating: 5 }, {})).rejects.toThrow(
      'Ride not found',
    );
  });

  it('lists both sides of a rated ride for the assigned driver', async () => {
    if (!databaseAvailable) return;

    const ride = await createCompletedRide();
    await service.rateDriver(customerId, ride.id, { rating: 5 }, {});
    await service.rateCustomer(driverId, ride.id, { rating: 4 }, {});

    const ratings = await service.listRideRatings(driverId, ride.id);
    expect(ratings).toHaveLength(2);
    expect(ratings.map((r) => r.raterRole).sort()).toEqual(['CUSTOMER', 'DRIVER']);
  });

  it('returns an empty list when a ride has no ratings yet', async () => {
    if (!databaseAvailable) return;

    const ride = await createCompletedRide();
    await expect(service.listRideRatings(driverId, ride.id)).resolves.toEqual([]);
  });

  it('rejects listing ratings for a ride not assigned to the caller', async () => {
    if (!databaseAvailable) return;

    const ride = await createCompletedRide();
    await expect(service.listRideRatings(randomUUID(), ride.id)).rejects.toThrow('Ride not found');
  });
});
