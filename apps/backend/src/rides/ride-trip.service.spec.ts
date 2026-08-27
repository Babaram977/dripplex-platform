import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../events/domain-events';

import { RideFareService } from './ride-fare.service';
import { RidePricingService } from './ride-pricing.service';
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
  let fareService: RideFareService;
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
    eventBus = new DomainEventBus();
    // The real fare service against the real fare table: completion prices the
    // trip for real now (DPX-PRICING-002), and a stub would assert the mock's
    // arithmetic rather than the platform's.
    fareService = new RideFareService(new RidePricingService(prisma, auditService));
    service = new RideTripService(
      prisma,
      auditService,
      notifications,
      events,
      eventBus,
      fareService,
    );

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
        // gate needs the driver's last-known location within
        // RIDE_START_PROXIMITY_METERS of it.
        latitude: 6.6,
        longitude: 3.35,
        // Dispatch ignores a driver whose position is older than
        // DRIVER_LOCATION_MAX_AGE_MS, so a fixture that omits this is
        // a driver who has not reported in — not an available one.
        locationUpdatedAt: new Date(),
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

  /** `dropoffLatitude` is a parameter because the ECONOMY minimum fare is
   * ₦1,500 and the default 2 km hop meters out far below it: with the floor in
   * force every fare is ₦1,500 regardless of time, which would make the
   * DPX-PRICING-002 assertions below pass or fail on the floor rather than on
   * the arithmetic they are testing. 6.69 is ~10 km out, clear of it. */
  async function createAssignedRide(dropoffLatitude = 6.62): Promise<Ride> {
    const ride = await prisma.ride.create({
      data: {
        customerId,
        driverId,
        rideType: 'ECONOMY',
        status: 'DRIVER_ASSIGNED',
        pickupLatitude: 6.6,
        pickupLongitude: 3.35,
        dropoffLatitude,
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

    const started = await service.startTrip(driverId, ride.id, undefined, context);
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

    await expect(service.startTrip(driverId, ride.id, undefined, context)).rejects.toThrow(
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

    await expect(service.startTrip(driverId, ride.id, undefined, context)).rejects.toThrow(
      'Driver is too far from pickup to start the ride',
    );
  });

  it('lets a driver start from within the GPS accuracy the gate allows', async () => {
    if (!databaseAvailable) return;

    const ride = await createAssignedRide();
    await service.markArrived(driverId, ride.id, context);
    await prisma.driverAvailability.update({
      where: { driverId },
      // ~122m north of the pickup point (6.6, 3.35). Refused under the old 50m
      // limit and allowed under 150m — the founder's revision of 2026-08-27,
      // taken after a driver at the kerb in Kano was refused at 180m. Consumer
      // GPS in a built-up area is routinely this far out, so 50m was rejecting
      // drivers who were actually there.
      data: { latitude: 6.6011, longitude: 3.35 },
    });

    const started = await service.startTrip(driverId, ride.id, undefined, context);
    expect(started.status).toBe('IN_PROGRESS');
  });

  it('still refuses a driver who is genuinely on another street', async () => {
    if (!databaseAvailable) return;

    const ride = await createAssignedRide();
    await service.markArrived(driverId, ride.id, context);
    await prisma.driverAvailability.update({
      where: { driverId },
      // ~330m out — beyond any plausible GPS error, and a distance a passenger
      // can see across. Widening the gate to 150m must not turn it off.
      data: { latitude: 6.603, longitude: 3.35 },
    });

    await expect(service.startTrip(driverId, ride.id, undefined, context)).rejects.toThrow(
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

    await expect(service.startTrip(driverId, ride.id, undefined, context)).rejects.toThrow(
      'Driver location is not available; cannot verify proximity to pickup',
    );
  });

  it('rejects starting a trip with the wrong passenger trip code', async () => {
    if (!databaseAvailable) return;

    const ride = await createAssignedRide();
    await prisma.ride.update({ where: { id: ride.id }, data: { verificationCode: '4729' } });
    await service.markArrived(driverId, ride.id, context);

    await expect(service.startTrip(driverId, ride.id, '1234', context)).rejects.toThrow(
      'That trip code does not match',
    );
    await expect(service.startTrip(driverId, ride.id, undefined, context)).rejects.toThrow(
      'That trip code does not match',
    );

    const started = await service.startTrip(driverId, ride.id, '4729', context);
    expect(started.status).toBe('IN_PROGRESS');
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
    await service.startTrip(driverId, ride.id, undefined, context);

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

  describe('completion prices the time the trip actually took (DPX-PRICING-002)', () => {
    /** Drives a ride to IN_PROGRESS and then back-dates `startedAt` by
     * `minutesAgo`, which is how a trip that took real time is simulated
     * without one. */
    const LONG_TRIP_DROPOFF_LAT = 6.69;

    async function rideInProgressFor(minutesAgo: number): Promise<Ride> {
      const ride = await createAssignedRide(LONG_TRIP_DROPOFF_LAT);
      await service.markArrived(driverId, ride.id, context);
      await service.startTrip(driverId, ride.id, undefined, context);
      return await prisma.ride.update({
        where: { id: ride.id },
        data: { startedAt: new Date(Date.now() - minutesAgo * 60_000) },
      });
    }

    it('charges a driver held up in traffic for the time they were held up', async () => {
      if (!databaseAvailable) return;

      // Same two points, same distance. The only difference between these two
      // trips is that one took twenty minutes longer — which before this change
      // cost the passenger nothing and paid the driver nothing.
      const quick = await service.completeTrip(driverId, (await rideInProgressFor(5)).id, context);
      const stuck = await service.completeTrip(driverId, (await rideInProgressFor(25)).id, context);

      expect(stuck.timeFare).toBeGreaterThan(quick.timeFare);
      expect(stuck.totalFare).toBeGreaterThan(quick.totalFare);
      // Distance is identical, so nothing but time may move.
      expect(stuck.distanceFare).toBe(quick.distanceFare);
      expect(stuck.baseFare).toBe(quick.baseFare);
    });

    it('records the elapsed seconds it charged on', async () => {
      if (!databaseAvailable) return;

      const ride = await rideInProgressFor(12);
      const completed = await service.completeTrip(driverId, ride.id, context);

      // Derivable from the timestamps, and stored anyway: this is the number
      // the receipt has to keep explaining, even if Ops later corrects one.
      expect(completed.actualDurationSeconds).toBeGreaterThanOrEqual(12 * 60);
      expect(completed.actualDurationSeconds).toBeLessThan(13 * 60);
      // ...and it is not the estimate the booking assumed.
      expect(completed.actualDurationSeconds).not.toBe(completed.estimatedDurationSeconds);
    });

    it('keeps the quote, so the receipt can show both numbers', async () => {
      if (!databaseAvailable) return;

      const ride = await rideInProgressFor(30);
      const completed = await service.completeTrip(driverId, ride.id, context);

      // 550 is what createAssignedRide books at. Overwriting totalFare without
      // keeping this would leave the passenger with a charge and no way to see
      // what they agreed to.
      expect(completed.quotedTotalFare).toBe(550);
      expect(completed.totalFare).not.toBe(550);
    });

    it('bills a fast trip down, not just a slow one up', async () => {
      if (!databaseAvailable) return;

      // The estimate assumes 30 km/h. A 2 km trip that took one minute beat
      // that assumption, and charging the assumption anyway would be the same
      // unfairness pointing the other way.
      const ride = await rideInProgressFor(1);
      const completed = await service.completeTrip(driverId, ride.id, context);

      expect(completed.actualDurationSeconds).toBeLessThan(
        completed.estimatedDurationSeconds ?? Infinity,
      );
      expect(completed.timeFare).toBeLessThan(50);
    });

    it('leaves the promo discount alone', async () => {
      if (!databaseAvailable) return;

      const ride = await rideInProgressFor(20);
      await prisma.ride.update({ where: { id: ride.id }, data: { promoDiscount: 100 } });

      const completed = await service.completeTrip(driverId, ride.id, context);

      // Granted against the quote and already accepted by the customer;
      // re-deriving it would reopen redemption accounting mid-completion.
      expect(completed.promoDiscount).toBe(100);
      const beforeDiscount =
        completed.baseFare +
        completed.distanceFare +
        completed.timeFare +
        completed.surchargeAmount;
      expect(completed.totalFare).toBe(Math.max(0, Math.round(beforeDiscount - 100)));
    });

    it('never charges a negative fare when the discount exceeds the trip', async () => {
      if (!databaseAvailable) return;

      const ride = await rideInProgressFor(1);
      await prisma.ride.update({ where: { id: ride.id }, data: { promoDiscount: 999_999 } });

      const completed = await service.completeTrip(driverId, ride.id, context);

      expect(completed.totalFare).toBe(0);
    });

    it('leaves a short trip on the minimum fare however long it is stuck', async () => {
      if (!databaseAvailable) return;

      // The floor is applied after time, not before it, so a 2 km hop at
      // ₦300 + ₦240 + ₦20/min has to sit in traffic for roughly three quarters
      // of an hour before the meter reaches the ₦1,500 minimum at all. Charging
      // for time genuinely changes nothing for these trips — asserted here so
      // that is a known property of the ₦1,500 floor rather than a surprise
      // when a driver reports being stuck for twenty minutes and paid the same.
      const ride = await createAssignedRide();
      await service.markArrived(driverId, ride.id, context);
      await service.startTrip(driverId, ride.id, undefined, context);
      await prisma.ride.update({
        where: { id: ride.id },
        data: { startedAt: new Date(Date.now() - 20 * 60_000) },
      });

      const completed = await service.completeTrip(driverId, ride.id, context);

      expect(completed.timeFare).toBe(400);
      expect(completed.totalFare).toBe(1500);
    });

    it('still completes a ride whose start time was never recorded', async () => {
      if (!databaseAvailable) return;

      const ride = await createAssignedRide();
      await service.markArrived(driverId, ride.id, context);
      await service.startTrip(driverId, ride.id, undefined, context);
      await prisma.ride.update({ where: { id: ride.id }, data: { startedAt: null } });

      // Unreachable through the state machine, but a fare must never be priced
      // on a null duration — the completion goes through untouched instead.
      const completed = await service.completeTrip(driverId, ride.id, context);

      expect(completed.status).toBe('COMPLETED');
      expect(completed.actualDurationSeconds).toBeNull();
      expect(completed.totalFare).toBe(550);
    });
  });
});
