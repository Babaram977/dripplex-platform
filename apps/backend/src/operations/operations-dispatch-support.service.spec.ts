import { randomUUID } from 'node:crypto';

import { DriverStatus, PrismaClient, RideRatingRole, RideStatus, RideType } from '@prisma/client';

import { OperationsDispatchSupportService } from './operations-dispatch-support.service';

import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

// Lagos-ish coordinates. ~0.01 degrees latitude is roughly 1.1km.
const PICKUP_LAT = 6.5244;
const PICKUP_LON = 3.3792;

describe('OperationsDispatchSupportService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: OperationsDispatchSupportService;
  let customerId: string;
  const driverIds: string[] = [];
  const rideIds: string[] = [];

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

    service = new OperationsDispatchSupportService(prisma);

    const customer = await prisma.user.create({
      data: {
        email: `ops-dispatch-customer-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Dispatch',
        lastName: 'Customer',
      },
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    if (databaseAvailable) {
      if (rideIds.length > 0) {
        await prisma.rideTracking
          .deleteMany({ where: { rideId: { in: rideIds } } })
          .catch(() => undefined);
        await prisma.ride.deleteMany({ where: { id: { in: rideIds } } }).catch(() => undefined);
      }
      if (driverIds.length > 0) {
        await prisma.rideRating
          .deleteMany({ where: { rateeId: { in: driverIds } } })
          .catch(() => undefined);
        await prisma.vehicle
          .deleteMany({ where: { driverId: { in: driverIds } } })
          .catch(() => undefined);
        await prisma.driverAvailability
          .deleteMany({ where: { driverId: { in: driverIds } } })
          .catch(() => undefined);
        await prisma.driverProfile
          .deleteMany({ where: { userId: { in: driverIds } } })
          .catch(() => undefined);
        await prisma.user.deleteMany({ where: { id: { in: driverIds } } }).catch(() => undefined);
      }
      await prisma.user.delete({ where: { id: customerId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  async function createDriver(overrides: {
    approved?: boolean;
    online?: boolean;
    acceptingRides?: boolean;
    vehicleType?: RideType;
    activeRideCount?: number;
    latitude?: number | null;
    longitude?: number | null;
  }): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `ops-dispatch-driver-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Candidate',
        lastName: randomUUID().slice(0, 8),
      },
    });
    driverIds.push(user.id);
    await prisma.driverProfile.create({
      data: {
        userId: user.id,
        status: overrides.approved === false ? DriverStatus.PENDING : DriverStatus.APPROVED,
        isApproved: overrides.approved !== false,
      },
    });
    await prisma.driverAvailability.create({
      data: {
        driverId: user.id,
        online: overrides.online ?? true,
        acceptingRides: overrides.acceptingRides ?? true,
        vehicleType: overrides.vehicleType ?? RideType.ECONOMY,
        activeRideCount: overrides.activeRideCount ?? 0,
        latitude: overrides.latitude === undefined ? PICKUP_LAT : overrides.latitude,
        longitude: overrides.longitude === undefined ? PICKUP_LON : overrides.longitude,
      },
    });
    return user.id;
  }

  async function createRide(
    pickup: { latitude: number; longitude: number } = {
      latitude: PICKUP_LAT,
      longitude: PICKUP_LON,
    },
  ): Promise<string> {
    const ride = await prisma.ride.create({
      data: {
        customerId,
        rideType: RideType.ECONOMY,
        status: RideStatus.SEARCHING,
        pickupLatitude: pickup.latitude,
        pickupLongitude: pickup.longitude,
        dropoffLatitude: 6.601,
        dropoffLongitude: 3.3489,
      },
    });
    rideIds.push(ride.id);
    return ride.id;
  }

  it('returns tracking points ordered ascending by time', async () => {
    if (!databaseAvailable) return;

    const rideId = await createRide();
    const now = Date.now();
    await prisma.rideTracking.create({
      data: { rideId, latitude: 6.53, longitude: 3.38, createdAt: new Date(now + 10_000) },
    });
    await prisma.rideTracking.create({
      data: { rideId, latitude: 6.52, longitude: 3.37, createdAt: new Date(now) },
    });

    const tracking = await service.getTripTracking(rideId);
    expect(tracking.points).toHaveLength(2);
    expect(new Date(tracking.points[0]?.at ?? 0).getTime()).toBeLessThan(
      new Date(tracking.points[1]?.at ?? 0).getTime(),
    );
  });

  it('throws NotFoundDomainException for tracking on an unknown ride', async () => {
    if (!databaseAvailable) return;

    await expect(service.getTripTracking(randomUUID())).rejects.toThrow('Ride not found');
  });

  it('surfaces only genuinely eligible nearby drivers, with distance/ETA/rating populated', async () => {
    if (!databaseAvailable) return;

    const eligibleDriverId = await createDriver({
      latitude: PICKUP_LAT + 0.005,
      longitude: PICKUP_LON,
    });
    await createDriver({ online: false });
    await createDriver({ acceptingRides: false });
    await createDriver({ vehicleType: RideType.XL });
    await createDriver({ activeRideCount: 1 });
    await createDriver({ approved: false });
    // Far outside the 10km decision-support radius.
    await createDriver({ latitude: PICKUP_LAT + 1, longitude: PICKUP_LON + 1 });

    await prisma.vehicle.create({
      data: {
        driverId: eligibleDriverId,
        plateNumber: `disp-${randomUUID().slice(0, 6)}`.toUpperCase(),
        make: 'Toyota',
        model: 'Corolla',
        color: 'Black',
        year: 2021,
        rideCategory: RideType.ECONOMY,
        isActive: true,
      },
    });
    await prisma.rideRating.create({
      data: {
        rideId: await createRide(),
        raterId: customerId,
        rateeId: eligibleDriverId,
        raterRole: RideRatingRole.CUSTOMER,
        rating: 5,
      },
    });

    const rideId = await createRide();
    const support = await service.getDispatchCandidates(rideId);

    expect(support.candidates).toHaveLength(1);
    const candidate = support.candidates[0];
    expect(candidate?.driverId).toBe(eligibleDriverId);
    expect(candidate?.vehiclePlateNumber).not.toBeNull();
    expect(candidate?.distanceMeters).toBeGreaterThan(0);
    expect(candidate?.etaSeconds).toBeGreaterThan(0);
    expect(candidate?.isEstimate).toBe(true);
    expect(candidate?.averageRating).toBe(5);
    expect(candidate?.ratingCount).toBe(1);
  });

  it('returns an empty candidate list, not an error, when nobody is eligible', async () => {
    if (!databaseAvailable) return;

    // A pickup far from every driver this suite creates (all clustered
    // around Lagos), so this is a genuine zero-candidates assertion rather
    // than a shape check that happens to dodge the other tests' fixtures.
    const rideId = await createRide({ latitude: 9.0765, longitude: 7.3986 });
    const support = await service.getDispatchCandidates(rideId);
    expect(support.candidates).toHaveLength(0);
  });
});
