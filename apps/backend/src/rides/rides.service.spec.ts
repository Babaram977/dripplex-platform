import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { CommercialCreditSettingsService } from '../commercial/commercial-credit-settings.service';
import { CommissionAccountService } from '../commercial/commission-account.service';
import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../events/domain-events';
import { PromotionsService } from '../promotions/promotions.service';
import { WalletService } from '../wallet/wallet.service';

import { RideDispatchService } from './ride-dispatch.service';
import { RideFareService } from './ride-fare.service';
import { RidePricingService } from './ride-pricing.service';
import { RidesService } from './rides.service';

import type { RideEventsPublisher } from './ride-events.publisher';
import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { DriverIdentityVerificationService } from '../drivers/identity-verification/driver-identity-verification.service';
import type { NotificationService } from '../notifications/notification.service';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

describe('RidesService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: RidesService;
  let dispatchService: RideDispatchService;
  let eventBus: DomainEventBus;
  let commissionAccounts: CommissionAccountService;
  let customerId: string;
  let otherCustomerId: string;
  let driverId: string;
  const context = {};

  const pickup = { pickupLatitude: 6.6018, pickupLongitude: 3.3515 };
  const dropoff = { dropoffLatitude: 6.605, dropoffLongitude: 3.355 };

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
    dispatchService = new RideDispatchService(
      prisma,
      auditService,
      notifications,
      events,
      new DomainEventBus(),
    );
    eventBus = new DomainEventBus();
    const walletService = new WalletService(prisma, auditService, eventBus);
    const promotionsService = new PromotionsService(prisma, auditService, eventBus, walletService);
    const identityVerificationService: jest.Mocked<DriverIdentityVerificationService> = {
      assertNotRequired: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<DriverIdentityVerificationService>;
    const commercialCreditSettings = new CommercialCreditSettingsService(prisma, auditService);
    commissionAccounts = new CommissionAccountService(
      prisma,
      auditService,
      commercialCreditSettings,
    );
    service = new RidesService(
      prisma,
      new RideFareService(new RidePricingService(prisma, auditService)),
      auditService,
      dispatchService,
      notifications,
      events,
      promotionsService,
      eventBus,
      identityVerificationService,
      commissionAccounts,
    );

    const customer = await prisma.user.create({
      data: {
        email: `ride-service-test-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Customer',
      },
    });
    customerId = customer.id;

    const other = await prisma.user.create({
      data: {
        email: `ride-service-other-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Other',
        lastName: 'Customer',
      },
    });
    otherCustomerId = other.id;

    const driver = await prisma.user.create({
      data: {
        email: `ride-service-driver-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Driver',
      },
    });
    driverId = driver.id;
    await prisma.driverProfile.create({
      data: { userId: driverId, status: 'APPROVED', isApproved: true },
    });
    await prisma.driverAvailability.create({
      data: {
        driverId,
        online: true,
        acceptingRides: true,
        vehicleType: 'ECONOMY',
        latitude: pickup.pickupLatitude,
        longitude: pickup.pickupLongitude,
        // Dispatch ignores a driver whose position is older than
        // DRIVER_LOCATION_MAX_AGE_MS, so a fixture that omits this is
        // a driver who has not reported in — not an available one.
        locationUpdatedAt: new Date(),
      },
    });
  });

  afterEach(async () => {
    if (databaseAvailable) {
      await prisma.rideOffer.deleteMany({ where: { driverId, status: 'PENDING' } });
    }
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.rideOffer.deleteMany({ where: { driverId } });
      await prisma.ride.deleteMany({
        where: { customerId: { in: [customerId, otherCustomerId] } },
      });
      await prisma.driverAvailability.delete({ where: { driverId } }).catch(() => undefined);
      await prisma.driverProfile.delete({ where: { userId: driverId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: customerId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: otherCustomerId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: driverId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it('creates a ride request and dispatches it to the nearest eligible driver', async () => {
    if (!databaseAvailable) return;

    const ride = await service.requestRide(
      customerId,
      { rideType: 'ECONOMY', ...pickup, ...dropoff },
      context,
    );

    expect(ride.status).toBe('SEARCHING');
    expect(ride.driverId).toBeNull();
    expect(ride.totalFare).toBeGreaterThan(0);
    expect(ride.estimatedDistanceMeters).toBeGreaterThan(0);
  });

  it('marks a ride NO_DRIVERS_FOUND when no eligible driver exists for the ride type', async () => {
    if (!databaseAvailable) return;

    const ride = await service.requestRide(
      customerId,
      { rideType: 'TRICYCLE', ...pickup, ...dropoff },
      context,
    );

    expect(ride.status).toBe('NO_DRIVERS_FOUND');
    expect(ride.driverId).toBeNull();
  });

  it("lists only the requesting customer's own rides", async () => {
    if (!databaseAvailable) return;

    await service.requestRide(
      otherCustomerId,
      { rideType: 'TRICYCLE', ...pickup, ...dropoff },
      context,
    );

    const mine = await service.listOwnRides(customerId, { page: 1, limit: 20 });
    expect(mine.items.every((ride) => ride.customerId === customerId)).toBe(true);
  });

  it('rejects reading a ride that belongs to a different customer', async () => {
    if (!databaseAvailable) return;

    const ride = await service.requestRide(
      otherCustomerId,
      { rideType: 'ECONOMY', ...pickup, ...dropoff },
      context,
    );

    await expect(service.getOwnRide(customerId, ride.id)).rejects.toThrow('Ride not found');
  });

  it('cancels a requested ride', async () => {
    if (!databaseAvailable) return;

    const ride = await service.requestRide(
      customerId,
      { rideType: 'ECONOMY', ...pickup, ...dropoff },
      context,
    );

    const cancelled = await service.cancelRide(
      customerId,
      ride.id,
      { reason: 'Changed my mind' },
      context,
    );

    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancelledBy).toBe('CUSTOMER');
    expect(cancelled.cancellationReason).toBe('Changed my mind');
  });

  it('frees the assigned driver when a customer cancels after assignment', async () => {
    if (!databaseAvailable) return;

    const ride = await service.requestRide(
      customerId,
      { rideType: 'ECONOMY', ...pickup, ...dropoff },
      context,
    );
    const offer = await prisma.rideOffer.findFirstOrThrow({ where: { rideId: ride.id } });
    await dispatchService.acceptOffer(driverId, offer.id, context);

    const before = await prisma.driverAvailability.findUniqueOrThrow({ where: { driverId } });
    expect(before.activeRideCount).toBe(1);

    const emitSpy = jest.spyOn(eventBus, 'emit');
    const cancelled = await service.cancelRide(customerId, ride.id, {}, context);
    expect(cancelled.status).toBe('CANCELLED');

    const after = await prisma.driverAvailability.findUniqueOrThrow({ where: { driverId } });
    expect(after.activeRideCount).toBe(0);

    expect(emitSpy).toHaveBeenCalledWith(
      DOMAIN_EVENTS.RIDE_CANCELLED,
      expect.objectContaining({ driverId, rideId: ride.id }),
    );
  });

  it('rejects cancelling a ride that is already cancelled', async () => {
    if (!databaseAvailable) return;

    const ride = await service.requestRide(
      customerId,
      { rideType: 'ECONOMY', ...pickup, ...dropoff },
      context,
    );
    await service.cancelRide(customerId, ride.id, {}, context);

    await expect(service.cancelRide(customerId, ride.id, {}, context)).rejects.toThrow(
      'Ride cannot be cancelled from status CANCELLED',
    );
  });

  it('throws for an unknown ride id', async () => {
    if (!databaseAvailable) return;

    await expect(service.getOwnRide(customerId, randomUUID())).rejects.toThrow('Ride not found');
  });

  it('updates driver availability, creating a row if none exists', async () => {
    if (!databaseAvailable) return;

    const other = await prisma.user.create({
      data: {
        email: `ride-service-availability-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Availability',
        lastName: 'Driver',
      },
    });

    // Driver-001 gates "online" on identity verification, so this driver
    // needs a profile that's already verified — this test exercises
    // availability CRUD, not the verification gate.
    await prisma.driverProfile.create({
      data: {
        userId: other.id,
        status: 'APPROVED',
        isApproved: true,
        lastIdentityVerifiedAt: new Date(),
      },
    });

    try {
      const created = await service.updateDriverAvailability(other.id, {
        online: true,
        acceptingRides: true,
        vehicleType: 'TRICYCLE',
        latitude: 9.05,
        longitude: 7.49,
      });
      expect(created.online).toBe(true);
      expect(created.vehicleType).toBe('TRICYCLE');
      expect(created.latitude).toBe(9.05);

      const updated = await service.updateDriverAvailability(other.id, {
        online: false,
        acceptingRides: false,
        vehicleType: 'TRICYCLE',
      });
      expect(updated.online).toBe(false);
      expect(updated.acceptingRides).toBe(false);
    } finally {
      await prisma.driverAvailability
        .delete({ where: { driverId: other.id } })
        .catch(() => undefined);
      await prisma.driverProfile.delete({ where: { userId: other.id } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: other.id } }).catch(() => undefined);
    }
  });

  describe('DPX-COMMERCIAL-001 Slice 4 — driver blocking on go-online', () => {
    it('rejects going online for a driver whose CommissionAccount is blocked, but never blocks going offline', async () => {
      if (!databaseAvailable) return;

      const other = await prisma.user.create({
        data: {
          email: `ride-service-blocked-driver-${randomUUID()}@dripplex.test`,
          passwordHash: 'not-a-real-hash',
          firstName: 'Blocked',
          lastName: 'Driver',
        },
      });
      await prisma.driverProfile.create({
        data: {
          userId: other.id,
          status: 'APPROVED',
          isApproved: true,
          lastIdentityVerifiedAt: new Date(),
        },
      });

      try {
        // Push the driver's outstanding balance past the default ₦10,000
        // credit limit — recordPayment()/accrue() both recompute
        // `blocked` after every mutation.
        await commissionAccounts.accrue({
          ownerType: 'DRIVER',
          ownerId: other.id,
          amount: 15000,
          referenceType: 'ride',
          referenceId: randomUUID(),
        });
        const account = await commissionAccounts.getOrCreateAccount('DRIVER', other.id);
        expect(account.blocked).toBe(true);

        await expect(
          service.updateDriverAvailability(other.id, {
            online: true,
            acceptingRides: true,
            vehicleType: 'TRICYCLE',
          }),
        ).rejects.toThrow('Driver is currently blocked from going online');

        // Going offline is never blocked — same shape as the identity
        // verification gate right above it.
        const offline = await service.updateDriverAvailability(other.id, {
          online: false,
          acceptingRides: false,
          vehicleType: 'TRICYCLE',
        });
        expect(offline.online).toBe(false);
      } finally {
        await prisma.commissionLedgerEntry
          .deleteMany({ where: { account: { ownerType: 'DRIVER', ownerId: other.id } } })
          .catch(() => undefined);
        await prisma.commissionAccount
          .deleteMany({ where: { ownerType: 'DRIVER', ownerId: other.id } })
          .catch(() => undefined);
        await prisma.driverAvailability
          .delete({ where: { driverId: other.id } })
          .catch(() => undefined);
        await prisma.driverProfile.delete({ where: { userId: other.id } }).catch(() => undefined);
        await prisma.user.delete({ where: { id: other.id } }).catch(() => undefined);
      }
    });
  });

  it('returns null from getOwnAvailability when the driver has no availability row', async () => {
    if (!databaseAvailable) return;

    const other = await prisma.user.create({
      data: {
        email: `ride-service-no-availability-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'No',
        lastName: 'Availability',
      },
    });

    try {
      await expect(service.getOwnAvailability(other.id)).resolves.toBeNull();
    } finally {
      await prisma.user.delete({ where: { id: other.id } }).catch(() => undefined);
    }
  });

  it("returns the driver's own availability from getOwnAvailability", async () => {
    if (!databaseAvailable) return;

    const availability = await service.getOwnAvailability(driverId);
    expect(availability?.online).toBe(true);
    expect(availability?.vehicleType).toBe('ECONOMY');
  });

  it('returns null from getActiveRide when the driver has no ride in progress', async () => {
    if (!databaseAvailable) return;

    await expect(service.getActiveRide(driverId)).resolves.toBeNull();
  });

  it('returns the in-progress ride from getActiveRide once a driver accepts an offer', async () => {
    if (!databaseAvailable) return;

    const ride = await service.requestRide(
      customerId,
      { rideType: 'ECONOMY', ...pickup, ...dropoff },
      context,
    );
    const offer = await prisma.rideOffer.findFirstOrThrow({ where: { rideId: ride.id } });
    await dispatchService.acceptOffer(driverId, offer.id, context);

    const active = await service.getActiveRide(driverId);
    expect(active?.id).toBe(ride.id);
    expect(active?.status).toBe('DRIVER_ASSIGNED');

    await service.cancelRide(customerId, ride.id, {}, context);
  });

  it("lists only the requesting driver's own rides via listOwnRidesForDriver", async () => {
    if (!databaseAvailable) return;

    const ride = await service.requestRide(
      customerId,
      { rideType: 'ECONOMY', ...pickup, ...dropoff },
      context,
    );
    const offer = await prisma.rideOffer.findFirstOrThrow({ where: { rideId: ride.id } });
    await dispatchService.acceptOffer(driverId, offer.id, context);

    const mine = await service.listOwnRidesForDriver(driverId, { page: 1, limit: 20 });
    expect(mine.items.some((item) => item.id === ride.id)).toBe(true);
    expect(mine.items.every((item) => item.driverId === driverId)).toBe(true);

    await service.cancelRide(customerId, ride.id, {}, context);
  });

  describe('listRideTypesWithAvailability', () => {
    it('reports the catalog with no availability claim when given no pickup', () => {
      // Guarded like every sibling: `service` is only constructed inside the
      // database-gated beforeAll, so without this the one test in the file
      // that lacks the guard crashes on `undefined` instead of skipping.
      if (!databaseAvailable) return;
      // Without coordinates there is no "in range" to answer, so the endpoint
      // must not imply one either way — the fare screen has to be able to tell
      // "not checked" apart from "checked, nobody there".
      const types = service.listRideTypes();

      expect(types.length).toBeGreaterThan(0);
      for (const entry of types) {
        expect(entry.availableNow).toBeUndefined();
        expect(entry.nearestDriverMeters).toBeUndefined();
      }
    });

    it('marks the type the online driver drives as available, and the others not', async () => {
      if (!databaseAvailable) return;

      // The suite's one driver is ECONOMY, sitting on the pickup point.
      const types = await service.listRideTypesWithAvailability(
        pickup.pickupLatitude,
        pickup.pickupLongitude,
      );

      const economy = types.find((entry) => entry.type === 'ECONOMY');
      expect(economy?.availableNow).toBe(true);
      expect(economy?.nearestDriverMeters).toBeLessThan(100);

      // Nobody drives these, so booking one would have meant waiting through
      // every dispatch attempt to be told so. This is the field that lets the
      // passenger be told first.
      const comfort = types.find((entry) => entry.type === 'COMFORT');
      expect(comfort?.availableNow).toBe(false);
      expect(comfort?.nearestDriverMeters).toBeNull();
    });

    it('reports nothing available from a pickup outside the widest search ring', async () => {
      if (!databaseAvailable) return;

      // ~55km north of the driver — past the outermost ring dispatch searches,
      // so the honest answer is that no type can be served from here.
      const types = await service.listRideTypesWithAvailability(
        pickup.pickupLatitude + 0.5,
        pickup.pickupLongitude,
      );

      expect(types.every((entry) => entry.availableNow === false)).toBe(true);
      expect(types.every((entry) => entry.nearestDriverMeters === null)).toBe(true);
    });

    it('treats a driver whose location has gone stale as unavailable', async () => {
      if (!databaseAvailable) return;

      await prisma.driverAvailability.update({
        where: { driverId },
        data: { locationUpdatedAt: new Date(Date.now() - 60 * 60_000) },
      });

      const types = await service.listRideTypesWithAvailability(
        pickup.pickupLatitude,
        pickup.pickupLongitude,
      );
      expect(types.find((entry) => entry.type === 'ECONOMY')?.availableNow).toBe(false);

      // Restore, so ordering between tests in this file cannot matter.
      await prisma.driverAvailability.update({
        where: { driverId },
        data: { locationUpdatedAt: new Date() },
      });
    });
  });
});
