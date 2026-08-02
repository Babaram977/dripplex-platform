import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../events/domain-events';

import { RideTripService } from './ride-trip.service';

import type { RideEventsPublisher } from './ride-events.publisher';
import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { NotificationService } from '../notifications/notification.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { Ride } from '@prisma/client';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

describe('RideTripService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: RideTripService;
  let eventBus: DomainEventBus;
  let customerId: string;
  let driverId: string;
  const createdRideIds: string[] = [];
  const context = {};

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
      sendPhoneOtp: jest.fn(),
      notifyMerchantLifecycle: jest.fn(),
      notifyOrderCreated: jest.fn(),
      notifyOrderLifecycle: jest.fn(),
      notifyPaymentResult: jest.fn(),
      notifyDeliveryLifecycle: jest.fn(),
      notifyDriverLifecycle: jest.fn(),
      notifyRideLifecycle: jest.fn().mockResolvedValue(undefined),
      notifyRideEarning: jest.fn().mockResolvedValue(undefined),
    };
    const events: jest.Mocked<RideEventsPublisher> = {
      publishToRide: jest.fn(),
      publishToDriver: jest.fn(),
    };
    eventBus = new DomainEventBus();
    service = new RideTripService(prisma, auditService, notifications, events, eventBus);

    const customer = await prisma.user.create({
      data: {
        email: `trip-test-customer-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Customer',
      },
    });
    customerId = customer.id;

    const driver = await prisma.user.create({
      data: {
        email: `trip-test-driver-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Driver',
      },
    });
    driverId = driver.id;
    await prisma.driverAvailability.create({
      data: {
        driverId,
        online: true,
        acceptingRides: true,
        vehicleType: 'ECONOMY',
        // At the ride's pickup point (6.6, 3.35) — startTrip's GPS proximity
        // gate needs the driver's last-known location to be within 50m.
        latitude: 6.6,
        longitude: 3.35,
      },
    });
  });

  afterEach(async () => {
    // Reset the shared driver's active-ride counter and location so each
    // test's own assertions start from a known baseline, regardless of
    // whether the previous test's transition completed or was rejected.
    if (databaseAvailable) {
      await prisma.driverAvailability.update({
        where: { driverId },
        data: { activeRideCount: 0, latitude: 6.6, longitude: 3.35 },
      });
    }
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.ride.deleteMany({ where: { id: { in: createdRideIds } } });
      await prisma.driverAvailability.delete({ where: { driverId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: customerId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: driverId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  async function createAssignedRide(): Promise<Ride> {
    const ride = await prisma.ride.create({
      data: {
        customerId,
        driverId,
        rideType: 'ECONOMY',
        status: 'DRIVER_ASSIGNED',
        pickupLatitude: 6.6,
        pickupLongitude: 3.35,
        dropoffLatitude: 6.62,
        dropoffLongitude: 3.37,
        estimatedDistanceMeters: 2000,
        estimatedDurationSeconds: 300,
        baseFare: 300,
        distanceFare: 200,
        timeFare: 50,
        totalFare: 550,
        assignedAt: new Date(),
      },
    });
    createdRideIds.push(ride.id);
    await prisma.driverAvailability.update({
      where: { driverId },
      data: { activeRideCount: { increment: 1 } },
    });
    return ride;
  }

  it('walks a ride through arrive -> start -> complete', async () => {
    if (!databaseAvailable) return;

    const ride = await createAssignedRide();

    const arrived = await service.markArrived(driverId, ride.id, context);
    expect(arrived.status).toBe('ARRIVED');

    const started = await service.startTrip(driverId, ride.id, context);
    expect(started.status).toBe('IN_PROGRESS');

    const completed = await service.completeTrip(driverId, ride.id, context);
    expect(completed.status).toBe('COMPLETED');

    const availability = await prisma.driverAvailability.findUniqueOrThrow({
      where: { driverId },
    });
    expect(availability.activeRideCount).toBe(0);
  });

  it('rejects starting a trip before the driver has arrived', async () => {
    if (!databaseAvailable) return;

    const ride = await createAssignedRide();

    await expect(service.startTrip(driverId, ride.id, context)).rejects.toThrow(
      'Ride cannot be started from status DRIVER_ASSIGNED',
    );
  });

  it('rejects starting a trip when the driver is too far from pickup', async () => {
    if (!databaseAvailable) return;

    const ride = await createAssignedRide();
    await service.markArrived(driverId, ride.id, context);
    await prisma.driverAvailability.update({
      where: { driverId },
      // ~1.6km from the pickup point (6.6, 3.35) — well past the 50m gate.
      data: { latitude: 6.615, longitude: 3.365 },
    });

    await expect(service.startTrip(driverId, ride.id, context)).rejects.toThrow(
      'Driver is too far from pickup to start the ride',
    );
  });

  it('rejects starting a trip when the driver has no location on record', async () => {
    if (!databaseAvailable) return;

    const ride = await createAssignedRide();
    await service.markArrived(driverId, ride.id, context);
    await prisma.driverAvailability.update({
      where: { driverId },
      data: { latitude: null, longitude: null },
    });

    await expect(service.startTrip(driverId, ride.id, context)).rejects.toThrow(
      'Driver location is not available; cannot verify proximity to pickup',
    );
  });

  it('rejects completing a trip that has not started', async () => {
    if (!databaseAvailable) return;

    const ride = await createAssignedRide();
    await service.markArrived(driverId, ride.id, context);

    await expect(service.completeTrip(driverId, ride.id, context)).rejects.toThrow(
      'Ride cannot be completed from status ARRIVED',
    );
  });

  it('lets a driver cancel before the trip starts and frees their availability', async () => {
    if (!databaseAvailable) return;

    const ride = await createAssignedRide();
    const emitSpy = jest.spyOn(eventBus, 'emit');

    const cancelled = await service.cancelByDriver(driverId, ride.id, 'car trouble', context);

    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancelledBy).toBe('DRIVER');
    expect(cancelled.cancellationReason).toBe('car trouble');

    const availability = await prisma.driverAvailability.findUniqueOrThrow({
      where: { driverId },
    });
    expect(availability.activeRideCount).toBe(0);

    expect(emitSpy).toHaveBeenCalledWith(
      DOMAIN_EVENTS.RIDE_CANCELLED,
      expect.objectContaining({ customerId, rideId: ride.id }),
    );
  });

  it('rejects a driver cancelling a trip that is already in progress', async () => {
    if (!databaseAvailable) return;

    const ride = await createAssignedRide();
    await service.markArrived(driverId, ride.id, context);
    await service.startTrip(driverId, ride.id, context);

    await expect(service.cancelByDriver(driverId, ride.id, undefined, context)).rejects.toThrow(
      'Ride cannot be cancelled by the driver from status IN_PROGRESS',
    );
  });

  it('rejects acting on a ride not assigned to the calling driver', async () => {
    if (!databaseAvailable) return;

    const ride = await createAssignedRide();

    await expect(service.markArrived(randomUUID(), ride.id, context)).rejects.toThrow(
      'Ride not found',
    );
  });
});
