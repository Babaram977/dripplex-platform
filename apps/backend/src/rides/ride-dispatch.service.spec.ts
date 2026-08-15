import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { DomainEventBus } from '../events/domain-event-bus';

import { RideDispatchService } from './ride-dispatch.service';
import { MAX_DISPATCH_ATTEMPTS } from './ride.constants';

import type { RideEventsPublisher } from './ride-events.publisher';
import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { NotificationService } from '../notifications/notification.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { DriverStatus, Ride } from '@prisma/client';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

// Deliberately far from other spec files' fixture coordinates (e.g.
// rides.service.spec.ts uses Lagos-area 6.60/3.35) — real-DB dispatch tests
// share one live database, and "nearest driver" queries have no radius cap,
// so overlapping coordinates across concurrently-run spec files can leak a
// foreign fixture in as the "nearest" candidate.
const PICKUP = { lat: 12.0, lng: 8.5 };
const NEARBY = { lat: 12.002, lng: 8.5005 };
const FARTHER = { lat: 12.05, lng: 8.6 };

describe('RideDispatchService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: RideDispatchService;
  let customerId: string;
  const createdDriverIds: string[] = [];
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
    const notifications: jest.Mocked<NotificationService> = {
      sendPasswordReset: jest.fn(),
      sendPasswordChanged: jest.fn(),
      sendEmailVerification: jest.fn(),
      sendEmailOtp: jest.fn(),
      sendPhoneOtp: jest.fn(),
      notifyMerchantLifecycle: jest.fn(),
      notifyOrderCreated: jest.fn(),
      notifyOrderLifecycle: jest.fn(),
      notifyPaymentResult: jest.fn(),
      notifyDeliveryLifecycle: jest.fn(),
      notifyDriverLifecycle: jest.fn(),
      notifyRiderLifecycle: jest.fn(),
      notifyRideLifecycle: jest.fn().mockResolvedValue(undefined),
      notifyRideEarning: jest.fn().mockResolvedValue(undefined),
    };
    const events: jest.Mocked<RideEventsPublisher> = {
      publishToRide: jest.fn(),
      publishToDriver: jest.fn(),
    };
    service = new RideDispatchService(
      prisma,
      auditService,
      notifications,
      events,
      new DomainEventBus(),
    );

    const customer = await prisma.user.create({
      data: {
        email: `dispatch-test-customer-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Customer',
      },
    });
    customerId = customer.id;
  });

  afterEach(async () => {
    // Deactivate every driver created so far so later tests only see the
    // drivers they create themselves, not leftover candidates from earlier
    // tests sharing the same pickup location.
    if (databaseAvailable && createdDriverIds.length > 0) {
      await prisma.driverAvailability.updateMany({
        where: { driverId: { in: createdDriverIds } },
        data: { acceptingRides: false },
      });
    }
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.rideOffer.deleteMany({ where: { rideId: { in: createdRideIds } } });
      await prisma.ride.deleteMany({ where: { id: { in: createdRideIds } } });
      await prisma.driverAvailability
        .deleteMany({ where: { driverId: { in: createdDriverIds } } })
        .catch(() => undefined);
      await prisma.driverProfile
        .deleteMany({ where: { userId: { in: createdDriverIds } } })
        .catch(() => undefined);
      await prisma.user.deleteMany({ where: { id: { in: createdDriverIds } } });
      await prisma.user.delete({ where: { id: customerId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  async function createDriver(
    location: { lat: number; lng: number },
    status: DriverStatus = 'APPROVED',
  ): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `dispatch-test-driver-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Driver',
      },
    });
    createdDriverIds.push(user.id);
    await prisma.driverProfile.create({
      data: { userId: user.id, status, isApproved: status === 'APPROVED' },
    });
    await prisma.driverAvailability.create({
      data: {
        driverId: user.id,
        online: true,
        acceptingRides: true,
        vehicleType: 'ECONOMY',
        latitude: location.lat,
        longitude: location.lng,
      },
    });
    return user.id;
  }

  async function createRide(): Promise<Ride> {
    const ride = await prisma.ride.create({
      data: {
        customerId,
        rideType: 'ECONOMY',
        pickupLatitude: PICKUP.lat,
        pickupLongitude: PICKUP.lng,
        dropoffLatitude: PICKUP.lat + 0.02,
        dropoffLongitude: PICKUP.lng + 0.02,
        estimatedDistanceMeters: 2000,
        estimatedDurationSeconds: 300,
        baseFare: 300,
        distanceFare: 200,
        timeFare: 50,
        totalFare: 550,
      },
    });
    createdRideIds.push(ride.id);
    return ride;
  }

  it('offers the nearest eligible driver and marks the ride SEARCHING', async () => {
    if (!databaseAvailable) return;

    const nearDriverId = await createDriver(NEARBY);
    const farDriverId = await createDriver(FARTHER);
    const ride = await createRide();

    const dispatched = await service.dispatchRide(ride.id);

    expect(dispatched.status).toBe('SEARCHING');
    const offers = await prisma.rideOffer.findMany({ where: { rideId: ride.id } });
    expect(offers).toHaveLength(1);
    expect(offers[0]?.driverId).toBe(nearDriverId);
    expect(offers[0]?.driverId).not.toBe(farDriverId);
  });

  it('excludes drivers whose DriverProfile is not APPROVED', async () => {
    if (!databaseAvailable) return;

    const unapprovedDriverId = await createDriver(NEARBY, 'PENDING');
    const approvedDriverId = await createDriver(FARTHER);
    const ride = await createRide();

    await service.dispatchRide(ride.id);

    const offers = await prisma.rideOffer.findMany({ where: { rideId: ride.id } });
    expect(offers).toHaveLength(1);
    expect(offers[0]?.driverId).toBe(approvedDriverId);
    expect(offers[0]?.driverId).not.toBe(unapprovedDriverId);
  });

  it('marks the ride NO_DRIVERS_FOUND when no eligible driver is available', async () => {
    if (!databaseAvailable) return;

    const ride = await createRide();

    const dispatched = await service.dispatchRide(ride.id);

    expect(dispatched.status).toBe('NO_DRIVERS_FOUND');
    const offers = await prisma.rideOffer.findMany({ where: { rideId: ride.id } });
    expect(offers).toHaveLength(0);
  });

  it('returns pickup/dropoff/fare preview without exposing customer identity', async () => {
    if (!databaseAvailable) return;

    const driverId = await createDriver(NEARBY);
    const ride = await createRide();
    await service.dispatchRide(ride.id);
    const offer = await prisma.rideOffer.findFirstOrThrow({ where: { rideId: ride.id } });

    const preview = await service.getOfferPreview(driverId, offer.id);

    expect(preview.rideId).toBe(ride.id);
    expect(preview.status).toBe('PENDING');
    expect(preview.pickupLatitude).toBeCloseTo(Number(ride.pickupLatitude));
    expect(preview.dropoffLatitude).toBeCloseTo(Number(ride.dropoffLatitude));
    expect(preview.totalFare).toBe(Number(ride.totalFare));
    expect(preview).not.toHaveProperty('customerId');
    expect(preview).not.toHaveProperty('driverId');
  });

  it('rejects previewing an offer belonging to another driver', async () => {
    if (!databaseAvailable) return;

    await createDriver(NEARBY);
    const otherDriverId = await createDriver(FARTHER);
    const ride = await createRide();
    await service.dispatchRide(ride.id);
    const offer = await prisma.rideOffer.findFirstOrThrow({ where: { rideId: ride.id } });

    await expect(service.getOfferPreview(otherDriverId, offer.id)).rejects.toThrow();
  });

  it('assigns the driver and increments activeRideCount on accept', async () => {
    if (!databaseAvailable) return;

    const driverId = await createDriver(NEARBY);
    const ride = await createRide();
    await service.dispatchRide(ride.id);
    const offer = await prisma.rideOffer.findFirstOrThrow({ where: { rideId: ride.id } });

    const accepted = await service.acceptOffer(driverId, offer.id, {});

    expect(accepted.status).toBe('DRIVER_ASSIGNED');
    expect(accepted.driverId).toBe(driverId);
    const availability = await prisma.driverAvailability.findUniqueOrThrow({
      where: { driverId },
    });
    expect(availability.activeRideCount).toBe(1);
    const updatedOffer = await prisma.rideOffer.findUniqueOrThrow({ where: { id: offer.id } });
    expect(updatedOffer.status).toBe('ACCEPTED');
  });

  it('reassigns to the next-nearest driver when the first declines', async () => {
    if (!databaseAvailable) return;

    const nearDriverId = await createDriver(NEARBY);
    const farDriverId = await createDriver(FARTHER);
    const ride = await createRide();
    await service.dispatchRide(ride.id);
    const firstOffer = await prisma.rideOffer.findFirstOrThrow({ where: { rideId: ride.id } });
    expect(firstOffer.driverId).toBe(nearDriverId);

    await service.declineOffer(nearDriverId, firstOffer.id, {});

    const offers = await prisma.rideOffer.findMany({ where: { rideId: ride.id } });
    expect(offers).toHaveLength(2);
    const secondOffer = offers.find((offer) => offer.id !== firstOffer.id);
    expect(secondOffer?.driverId).toBe(farDriverId);
    expect(secondOffer?.status).toBe('PENDING');
  });

  it('reassigns to the next driver when an offer expires', async () => {
    if (!databaseAvailable) return;

    const nearDriverId = await createDriver(NEARBY);
    const farDriverId = await createDriver(FARTHER);
    const ride = await createRide();
    await service.dispatchRide(ride.id);
    const firstOffer = await prisma.rideOffer.findFirstOrThrow({ where: { rideId: ride.id } });
    expect(firstOffer.driverId).toBe(nearDriverId);

    await prisma.rideOffer.update({
      where: { id: firstOffer.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const expiredCount = await service.expireStaleOffers();

    expect(expiredCount).toBeGreaterThanOrEqual(1);
    const expired = await prisma.rideOffer.findUniqueOrThrow({ where: { id: firstOffer.id } });
    expect(expired.status).toBe('EXPIRED');
    const newOffer = await prisma.rideOffer.findFirst({
      where: { rideId: ride.id, driverId: farDriverId },
    });
    expect(newOffer?.status).toBe('PENDING');
  });

  it('gives up after MAX_DISPATCH_ATTEMPTS declined offers', async () => {
    if (!databaseAvailable) return;

    const driverIds = await Promise.all(
      Array.from({ length: MAX_DISPATCH_ATTEMPTS }, () => createDriver(NEARBY)),
    );
    const ride = await createRide();

    let status = (await service.dispatchRide(ride.id)).status;
    let attempts = 0;
    while (status === 'SEARCHING' && attempts < driverIds.length) {
      const offer = await prisma.rideOffer.findFirstOrThrow({
        where: { rideId: ride.id, status: 'PENDING' },
      });
      await service.declineOffer(offer.driverId, offer.id, {});
      const refreshed = await prisma.ride.findUniqueOrThrow({ where: { id: ride.id } });
      status = refreshed.status;
      attempts += 1;
    }

    const finalRide = await prisma.ride.findUniqueOrThrow({ where: { id: ride.id } });
    expect(finalRide.status).toBe('NO_DRIVERS_FOUND');
    const offers = await prisma.rideOffer.findMany({ where: { rideId: ride.id } });
    expect(offers).toHaveLength(MAX_DISPATCH_ATTEMPTS);
    expect(offers.every((offer) => offer.status === 'DECLINED')).toBe(true);
  });

  it('rejects accepting an offer that does not belong to the driver', async () => {
    if (!databaseAvailable) return;

    const driverId = await createDriver(NEARBY);
    const otherDriverId = await createDriver(FARTHER);
    const ride = await createRide();
    await service.dispatchRide(ride.id);
    const offer = await prisma.rideOffer.findFirstOrThrow({ where: { rideId: ride.id } });
    expect(offer.driverId).toBe(driverId);

    await expect(service.acceptOffer(otherDriverId, offer.id, {})).rejects.toThrow(
      'Ride offer not found',
    );
  });

  it('rejects accepting an offer that is no longer pending', async () => {
    if (!databaseAvailable) return;

    const driverId = await createDriver(NEARBY);
    const ride = await createRide();
    await service.dispatchRide(ride.id);
    const offer = await prisma.rideOffer.findFirstOrThrow({ where: { rideId: ride.id } });

    await service.acceptOffer(driverId, offer.id, {});

    await expect(service.acceptOffer(driverId, offer.id, {})).rejects.toThrow(
      'Offer is no longer pending',
    );
  });
});
