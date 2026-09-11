import { randomUUID } from 'node:crypto';

import {
  DriverTier,
  Prisma,
  PrismaClient,
  RideCancelledBy,
  RideRatingRole,
  RideStatus,
  RideType,
} from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import { DriverTierService } from './driver-tier.service';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * What a driver has earned, and therefore what DrippleX charges them.
 *
 * Nora's rule is that a tier needs completed trips **and** a sustained rating,
 * never volume alone — and that a handful of ratings must not buy a premium
 * tier. Both are money, so both are checked against real rows rather than a
 * mock that would agree with whatever the code does.
 */
describe('DriverTierService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: DriverTierService;
  let driverId: string;
  let customerId: string;
  const createdUserIds: string[] = [];

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
    service = new DriverTierService(prisma, new AuditService(auditLogRepository));

    driverId = await createUser('driver');
    customerId = await createUser('customer');
  });

  async function createUser(label: string): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `driver-tier-${label}-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: label,
      },
    });
    createdUserIds.push(user.id);
    return user.id;
  }

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.rideRating.deleteMany({ where: { rateeId: { in: createdUserIds } } });
      await prisma.ride.deleteMany({ where: { driverId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  afterEach(async () => {
    if (!databaseAvailable) return;
    await prisma.rideRating.deleteMany({ where: { rateeId: driverId } });
    await prisma.ride.deleteMany({ where: { driverId } });
  });

  /**
   * `trips` completed rides, of which `rated` carry a customer rating.
   *
   * Bulk-inserted. The founder's thresholds run to 4,500 trips, and creating
   * those a row at a time takes long enough to blow the test timeout — which
   * then leaves rows behind and quietly poisons the next test.
   */
  async function trade(input: {
    trips: number;
    rated?: number;
    rating?: number;
    cancelledByDriver?: number;
  }): Promise<void> {
    const base = {
      customerId,
      driverId,
      rideType: RideType.ECONOMY,
      pickupLatitude: 12,
      pickupLongitude: 8,
      dropoffLatitude: 12,
      dropoffLongitude: 8,
      estimatedDistanceMeters: 2000,
      estimatedDurationSeconds: 300,
      baseFare: new Prisma.Decimal(300),
      distanceFare: new Prisma.Decimal(200),
      timeFare: new Prisma.Decimal(50),
      totalFare: new Prisma.Decimal(1000),
    };

    await prisma.ride.createMany({
      data: Array.from({ length: input.trips }, () => ({
        ...base,
        status: RideStatus.COMPLETED,
      })),
    });

    if ((input.cancelledByDriver ?? 0) > 0) {
      await prisma.ride.createMany({
        data: Array.from({ length: input.cancelledByDriver ?? 0 }, () => ({
          ...base,
          status: RideStatus.CANCELLED,
          cancelledBy: RideCancelledBy.DRIVER,
        })),
      });
    }

    const rated = input.rated ?? 0;
    if (rated > 0) {
      const rides = await prisma.ride.findMany({
        where: { driverId, status: RideStatus.COMPLETED },
        select: { id: true },
        take: rated,
      });
      await prisma.rideRating.createMany({
        data: rides.map((ride) => ({
          rideId: ride.id,
          raterId: customerId,
          rateeId: driverId,
          raterRole: RideRatingRole.CUSTOMER,
          rating: input.rating ?? 5,
        })),
      });
    }
  }

  it('gives a brand-new driver no tier at all', async () => {
    if (!databaseAvailable) return;

    const standing = await service.standingFor(driverId);

    // Founder decision 2026-09-11 put STANDARD at 500 completed trips, so a
    // tier is earned rather than issued. A null tier means the platform rate
    // applies — what they were charged before tiers existed.
    expect(standing?.tier).toBeNull();
    expect(standing?.commissionRate).toBeNull();
    // Not zero: nobody has rated them, which is not the same as rating them badly.
    expect(standing?.averageRating).toBeNull();
    expect(standing?.nextTier?.tier).toBe(DriverTier.STANDARD);
  });

  it('earns STANDARD at the trip threshold', async () => {
    if (!databaseAvailable) return;

    await trade({ trips: 500 });

    const standing = await service.standingFor(driverId);

    expect(standing?.tier).toBe(DriverTier.STANDARD);
    expect(standing?.commissionRate).toBe(0.1);
  });

  it('will not promote on trips alone', async () => {
    if (!databaseAvailable) return;

    // Well past Silver's 1,500 trips, but nobody has ever rated them. Volume
    // without a sustained rating is exactly what the rating bar refuses.
    await trade({ trips: 1_600, rated: 0 });

    const standing = await service.standingFor(driverId);

    expect(standing?.tier).toBe(DriverTier.STANDARD);
  });

  it('will not let a handful of perfect ratings buy a tier', async () => {
    if (!databaseAvailable) return;

    // Past Silver's trip bar with a flawless 5.00 — from three ratings. Silver
    // wants fifty behind the average, because three five-star trips prove
    // nothing.
    await trade({ trips: 1_600, rated: 3, rating: 5 });

    const standing = await service.standingFor(driverId);

    expect(standing?.averageRating).toBe(5);
    expect(standing?.ratedTrips).toBe(3);
    expect(standing?.tier).toBe(DriverTier.STANDARD);
  });

  it('promotes to SILVER on trips and a sustained rating together', async () => {
    if (!databaseAvailable) return;

    await trade({ trips: 1_600, rated: 60, rating: 5 });

    const standing = await service.standingFor(driverId);

    expect(standing?.tier).toBe(DriverTier.SILVER);
    expect(standing?.commissionRate).toBe(0.095);
  });

  it('holds a driver at the tier their rating actually clears', async () => {
    if (!databaseAvailable) return;

    // Enough trips and ratings for Gold, but the average clears Silver's 4.60
    // and not Gold's 4.70.
    await trade({ trips: 2_600, rated: 110, rating: 4 });
    await prisma.rideRating.updateMany({ where: { rateeId: driverId }, data: { rating: 5 } });
    const someRatings = await prisma.rideRating.findMany({
      where: { rateeId: driverId },
      take: 38,
      select: { id: true },
    });
    await prisma.rideRating.updateMany({
      where: { id: { in: someRatings.map((rating) => rating.id) } },
      data: { rating: 4 },
    });

    const standing = await service.standingFor(driverId);

    expect(standing?.averageRating).toBeGreaterThanOrEqual(4.6);
    expect(standing?.averageRating).toBeLessThan(4.7);
    expect(standing?.tier).toBe(DriverTier.SILVER);
  });

  it('reaches PLATINUM at the top thresholds', async () => {
    if (!databaseAvailable) return;

    await trade({ trips: 4_600, rated: 210, rating: 5 });

    const standing = await service.standingFor(driverId);

    expect(standing?.tier).toBe(DriverTier.PLATINUM);
    expect(standing?.commissionRate).toBe(0.085);
    expect(standing?.nextTier).toBeNull();
  }, 30_000);

  it('measures cancellations against everything the driver was assigned', async () => {
    if (!databaseAvailable) return;

    // Otherwise cancelling more would improve the ratio, which is backwards.
    await trade({ trips: 120, rated: 60, rating: 5, cancelledByDriver: 30 });

    const standing = await service.standingFor(driverId);

    expect(standing?.cancellationRate).toBeCloseTo(30 / 150, 4);
  });

  it('refuses a tier once its cancellation gate is set and breached', async () => {
    if (!databaseAvailable) return;

    await trade({ trips: 1_600, rated: 60, rating: 5, cancelledByDriver: 300 });
    await prisma.driverTierSetting.update({
      where: { tier: DriverTier.SILVER },
      data: { maxCancellationRate: 0.05 },
    });

    // Silver is out of reach on cancellations; STANDARD has no gate set.
    const standing = await service.standingFor(driverId);
    expect(standing?.tier).toBe(DriverTier.STANDARD);

    await prisma.driverTierSetting.update({
      where: { tier: DriverTier.SILVER },
      data: { maxCancellationRate: null },
    });
  });

  it('says what the next tier still needs', async () => {
    if (!databaseAvailable) return;

    await trade({ trips: 520, rated: 20, rating: 5 });

    const standing = await service.standingFor(driverId);

    expect(standing?.tier).toBe(DriverTier.STANDARD);
    expect(standing?.nextTier?.tier).toBe(DriverTier.SILVER);
    expect(standing?.nextTier?.tripsToGo).toBe(980);
    expect(standing?.nextTier?.ratedTripsToGo).toBe(30);
    expect(standing?.nextTier?.ratingRequired).toBe(4.6);
  });

  it('follows a threshold Operations changes, without a deployment', async () => {
    if (!databaseAvailable) return;

    await trade({ trips: 520, rated: 20, rating: 5 });
    await expect(service.standingFor(driverId)).resolves.toMatchObject({
      tier: DriverTier.STANDARD,
    });

    await service.updateSetting(
      DriverTier.SILVER,
      { minCompletedTrips: 500, minRatedTrips: 10 },
      customerId,
    );

    await expect(service.standingFor(driverId)).resolves.toMatchObject({
      tier: DriverTier.SILVER,
    });

    await service.updateSetting(
      DriverTier.SILVER,
      { minCompletedTrips: 1_500, minRatedTrips: 50 },
      customerId,
    );
  });

  it('skips a tier Operations has retired', async () => {
    if (!databaseAvailable) return;

    await trade({ trips: 1_600, rated: 60, rating: 5 });
    await service.updateSetting(DriverTier.SILVER, { active: false }, customerId);

    await expect(service.standingFor(driverId)).resolves.toMatchObject({
      tier: DriverTier.STANDARD,
    });

    await service.updateSetting(DriverTier.SILVER, { active: true }, customerId);
  });

  it('refuses a commission rate given as a percentage', async () => {
    if (!databaseAvailable) return;

    await expect(
      service.updateSetting(DriverTier.GOLD, { commissionRate: 9 }, customerId),
    ).rejects.toThrow('fraction between 0 and 1');
  });
});
