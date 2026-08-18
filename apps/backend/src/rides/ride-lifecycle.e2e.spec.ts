import { randomUUID } from 'node:crypto';

import { PrismaClient, WalletOwnerType } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { CommercialCreditSettingsService } from '../commercial/commercial-credit-settings.service';
import { CommissionAccountService } from '../commercial/commission-account.service';
import { PlatformCommissionSettingsService } from '../commercial/platform-commission-settings.service';
import { DomainEventBus } from '../events/domain-event-bus';
import { PromotionsService } from '../promotions/promotions.service';
import { PLATFORM_WALLET_OWNER_ID } from '../wallet/wallet.constants';
import { WalletService } from '../wallet/wallet.service';

import { RideDispatchService } from './ride-dispatch.service';
import { RideFareService } from './ride-fare.service';
import { RidePaymentService } from './ride-payment.service';
import { RideProblemReportService } from './ride-problem-report.service';
import { RideRatingService } from './ride-rating.service';
import { RideReceiptService } from './ride-receipt.service';
import { RideTripService } from './ride-trip.service';
import { MAX_DISPATCH_ATTEMPTS } from './ride.constants';
import { RidesService } from './rides.service';

import type { RideEventsPublisher } from './ride-events.publisher';
import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { DriverIdentityVerificationService } from '../drivers/identity-verification/driver-identity-verification.service';
import type { NotificationService } from '../notifications/notification.service';
import type { PaymentProviderAdapter } from '../payments/providers/payment-provider.adapter';
import type { PrismaService } from '../prisma/prisma.service';
import type { RideDto } from '@dripplex/types';
import type { PaymentProvider } from '@prisma/client';

/**
 * RIDE-002.9 — end-to-end backend integration.
 *
 * Every prior RIDE-002.x milestone was verified in isolation (dispatch,
 * trip lifecycle, payment, ratings, tips, receipts — each in its own
 * real-DB spec). This spec walks the entire chain in continuous runs,
 * wiring the real services together exactly as the controllers do, so a
 * regression in how milestones compose (not just how each behaves alone)
 * would actually be caught. Scenarios follow the founder's RIDE-002.9 spec
 * (see docs/RIDE-002.9-E2E-VERIFICATION.md for the full report, including
 * the two confirmed gaps this spec deliberately does not fabricate
 * coverage for: no verification-code/PIN step and no SOS/emergency/trip-
 * sharing feature exist anywhere in the backend).
 */

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

const PICKUP = { lat: 13.0, lng: 9.0 };
const NEAR_DRIVER = { lat: 13.001, lng: 9.001 };
const FAR_DRIVER = { lat: 13.05, lng: 9.06 };
const DROPOFF = { lat: 13.02, lng: 9.02 };

function fakeAdapter(provider: PaymentProvider): jest.Mocked<PaymentProviderAdapter> {
  return {
    provider,
    initializePayment: jest.fn(),
    verifyPayment: jest.fn(),
    handleWebhook: jest.fn(),
  };
}

describe('Ride end-to-end lifecycle (RIDE-002.9)', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let walletService: WalletService;
  let ridesService: RidesService;
  let dispatchService: RideDispatchService;
  let tripService: RideTripService;
  let paymentService: RidePaymentService;
  let ratingService: RideRatingService;
  let receiptService: RideReceiptService;
  let problemReportService: RideProblemReportService;
  let events: jest.Mocked<RideEventsPublisher>;
  const createdUserIds: string[] = [];
  const createdRideIds: string[] = [];
  const createdDriverIds: string[] = [];

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
    walletService = new WalletService(prisma, auditService, new DomainEventBus());

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
    events = { publishToRide: jest.fn(), publishToDriver: jest.fn() };
    // OPay is safe-disabled from ride selection (DPX-DRIVER-013 §G): no OPAY
    // adapter is registered, matching production where GATEWAY_METHODS excludes it.
    const providers = [fakeAdapter('PAYSTACK'), fakeAdapter('FLUTTERWAVE')];

    const fareService = new RideFareService();
    dispatchService = new RideDispatchService(
      prisma,
      auditService,
      notifications,
      events,
      new DomainEventBus(),
    );
    const promotionsService = new PromotionsService(
      prisma,
      auditService,
      new DomainEventBus(),
      walletService,
    );
    const identityVerificationService: jest.Mocked<DriverIdentityVerificationService> = {
      assertNotRequired: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<DriverIdentityVerificationService>;
    const commercialCreditSettings = new CommercialCreditSettingsService(prisma, auditService);
    const commissionAccounts = new CommissionAccountService(
      prisma,
      auditService,
      commercialCreditSettings,
    );
    ridesService = new RidesService(
      prisma,
      fareService,
      auditService,
      dispatchService,
      notifications,
      events,
      promotionsService,
      new DomainEventBus(),
      identityVerificationService,
      commissionAccounts,
    );
    tripService = new RideTripService(
      prisma,
      auditService,
      notifications,
      events,
      new DomainEventBus(),
    );
    paymentService = new RidePaymentService(
      prisma,
      walletService,
      auditService,
      notifications,
      events,
      providers,
      new DomainEventBus(),
      commissionAccounts,
      new PlatformCommissionSettingsService(prisma, auditService),
    );
    ratingService = new RideRatingService(prisma, auditService);
    receiptService = new RideReceiptService(prisma);
    problemReportService = new RideProblemReportService(prisma, auditService);
  });

  beforeEach(() => {
    if (databaseAvailable) {
      events.publishToRide.mockClear();
      events.publishToDriver.mockClear();
    }
  });

  afterEach(async () => {
    // Each test dispatches against a fresh single-eligible-driver setup, so a
    // driver from an earlier test whose ride completed (freeing activeRideCount
    // back to 0) would tie with the next test's driver on identical coordinates
    // and could win dispatch instead — the same fixture-leak class documented in
    // ride-dispatch.service.spec.ts. Deactivate every driver created so far.
    if (databaseAvailable && createdDriverIds.length > 0) {
      await prisma.driverAvailability.updateMany({
        where: { driverId: { in: createdDriverIds } },
        data: { acceptingRides: false },
      });
    }
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.rideRating.deleteMany({ where: { rideId: { in: createdRideIds } } });
      await prisma.rideProblemReport.deleteMany({ where: { rideId: { in: createdRideIds } } });
      await prisma.ridePaymentTransaction.deleteMany({ where: { rideId: { in: createdRideIds } } });
      await prisma.rideOffer.deleteMany({ where: { rideId: { in: createdRideIds } } });
      await prisma.ride.deleteMany({ where: { id: { in: createdRideIds } } });
      await prisma.walletLedgerEntry.deleteMany({
        where: { wallet: { ownerId: { in: [...createdUserIds, PLATFORM_WALLET_OWNER_ID] } } },
      });
      await prisma.wallet
        .deleteMany({ where: { ownerId: { in: [...createdUserIds, PLATFORM_WALLET_OWNER_ID] } } })
        .catch(() => undefined);
      await prisma.driverAvailability
        .deleteMany({ where: { driverId: { in: createdUserIds } } })
        .catch(() => undefined);
      await prisma.driverProfile
        .deleteMany({ where: { userId: { in: createdUserIds } } })
        .catch(() => undefined);
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  async function createCustomer(): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `e2e-customer-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Ada',
        lastName: 'Passenger',
      },
    });
    createdUserIds.push(user.id);
    return user.id;
  }

  async function createEligibleDriver(
    location: { lat: number; lng: number } = NEAR_DRIVER,
  ): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `e2e-driver-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Musa',
        lastName: 'Driver',
        phone: `+234${String(Date.now() + Math.floor(Math.random() * 100_000)).slice(-9)}`,
      },
    });
    createdUserIds.push(user.id);
    createdDriverIds.push(user.id);
    await prisma.driverProfile.create({
      data: { userId: user.id, status: 'APPROVED', isApproved: true },
    });
    await prisma.driverAvailability.create({
      data: {
        driverId: user.id,
        online: true,
        acceptingRides: true,
        vehicleType: 'ECONOMY',
        latitude: location.lat,
        longitude: location.lng,
        // Dispatch ignores a driver whose position is older than
        // DRIVER_LOCATION_MAX_AGE_MS, so a fixture that omits this is
        // a driver who has not reported in — not an available one.
        locationUpdatedAt: new Date(),
      },
    });
    return user.id;
  }

  async function requestRide(customerId: string): Promise<RideDto> {
    const requested = await ridesService.requestRide(
      customerId,
      {
        rideType: 'ECONOMY',
        pickupLatitude: PICKUP.lat,
        pickupLongitude: PICKUP.lng,
        dropoffLatitude: DROPOFF.lat,
        dropoffLongitude: DROPOFF.lng,
      },
      {},
    );
    createdRideIds.push(requested.id);
    return requested;
  }

  // startTrip's GPS proximity gate (RIDE-002.10, locked in place of a
  // mandatory passenger OTP) requires the driver's last-known location to
  // be within 50m of pickup. In production this comes from the driver's
  // live location pings as they actually drive there; simulate that here
  // by snapping their recorded location to the pickup point once arrived.
  async function simulateArrivalAtPickup(driverId: string): Promise<void> {
    await prisma.driverAvailability.update({
      where: { driverId },
      data: { latitude: PICKUP.lat, longitude: PICKUP.lng },
    });
  }

  describe('Scenario 1 — happy path', () => {
    it('walks request -> dispatch -> accept -> trip -> payment -> tip -> ratings -> receipt -> report/resolve, notifying over the WebSocket port at every step and leaving every wallet reconciled', async () => {
      if (!databaseAvailable) return;

      const customerId = await createCustomer();
      const driverId = await createEligibleDriver();

      await walletService.credit({
        ownerType: WalletOwnerType.CUSTOMER,
        ownerId: customerId,
        amount: 10_000,
        description: 'e2e top-up',
      });

      const requested = await requestRide(customerId);
      expect(requested.status).toBe('SEARCHING');
      expect(events.publishToDriver).toHaveBeenCalledWith(driverId, 'ride:offered', {
        rideId: requested.id,
      });

      const offer = await prisma.rideOffer.findFirstOrThrow({
        where: { rideId: requested.id, driverId },
      });
      const assigned = await dispatchService.acceptOffer(driverId, offer.id, {});
      expect(assigned.status).toBe('DRIVER_ASSIGNED');
      expect(assigned.driverId).toBe(driverId);
      expect(events.publishToRide).toHaveBeenCalledWith(
        requested.id,
        'ride:status',
        expect.objectContaining({ status: 'DRIVER_ASSIGNED' }),
      );

      const arrived = await tripService.markArrived(driverId, requested.id, {});
      expect(arrived.status).toBe('ARRIVED');
      await simulateArrivalAtPickup(driverId);
      const started = await tripService.startTrip(driverId, requested.id, {});
      expect(started.status).toBe('IN_PROGRESS');
      const completed = await tripService.completeTrip(driverId, requested.id, {});
      expect(completed.status).toBe('COMPLETED');
      expect(events.publishToRide).toHaveBeenCalledWith(
        requested.id,
        'ride:status',
        expect.objectContaining({ status: 'COMPLETED' }),
      );
      const totalFare = completed.totalFare;

      // Wallet payment (also exercises Scenario 6 — wallet balance is
      // checked, debited, settled through the platform clearinghouse).
      const paid = await paymentService.initiatePayment(
        customerId,
        requested.id,
        'WALLET',
        undefined,
        {},
      );
      expect(paid.ride.paymentStatus).toBe('PAID');
      expect(paid.ride.driverEarning).not.toBeNull();
      expect(paid.ride.platformCommission).not.toBeNull();
      expect(events.publishToRide).toHaveBeenCalledWith(
        requested.id,
        'ride:payment',
        expect.objectContaining({ paymentStatus: 'PAID' }),
      );
      const driverEarning = paid.ride.driverEarning ?? 0;

      const tipped = await paymentService.tipDriver(customerId, requested.id, 200, {});
      expect(tipped.tipAmount).toBe(200);

      const driverRating = await ratingService.rateDriver(
        customerId,
        requested.id,
        { rating: 5, comment: 'Smooth ride', categoryRatings: { driving: 5, cleanliness: 5 } },
        {},
      );
      expect(driverRating.rateeId).toBe(driverId);
      const customerRating = await ratingService.rateCustomer(
        driverId,
        requested.id,
        { rating: 4, categoryRatings: { behaviour: 4, waitingTime: 5 } },
        {},
      );
      expect(customerRating.rateeId).toBe(customerId);

      const receipt = await receiptService.getReceipt(customerId, requested.id);
      expect(receipt.driver?.id).toBe(driverId);
      expect(receipt.fare.totalFare).toBe(totalFare);
      expect(receipt.fare.tipAmount).toBe(200);
      expect(receipt.paymentMethod).toBe('WALLET');
      expect(receipt.paymentStatus).toBe('PAID');

      // Scenario 8's built equivalent: report + admin resolution. SOS/
      // emergency/trip-sharing do not exist anywhere in this backend — see
      // docs/RIDE-002.9-E2E-VERIFICATION.md, not fabricated here.
      const report = await problemReportService.reportProblem(
        customerId,
        requested.id,
        { category: 'LOST_ITEM', description: 'Left a phone on the seat' },
        {},
      );
      expect(report.status).toBe('OPEN');
      const resolved = await problemReportService.resolveReport(report.id, randomUUID(), {});
      expect(resolved.status).toBe('RESOLVED');

      const customerWallet = await walletService.getWallet(WalletOwnerType.CUSTOMER, customerId);
      expect(customerWallet.availableBalance).toBeCloseTo(10_000 - totalFare - 200);

      const driverWallet = await walletService.getWallet(WalletOwnerType.DRIVER, driverId);
      expect(driverWallet.availableBalance).toBeCloseTo(driverEarning + 200);

      const platformReconciliation = await walletService.reconcileWallet(
        WalletOwnerType.PLATFORM,
        PLATFORM_WALLET_OWNER_ID,
      );
      expect(platformReconciliation.reconciled).toBe(true);
      expect(platformReconciliation.difference).toBe(0);

      const driverAvailability = await prisma.driverAvailability.findUniqueOrThrow({
        where: { driverId },
      });
      expect(driverAvailability.activeRideCount).toBe(0);
    });
  });

  describe('Scenario 2 — driver declines, dispatch reassigns', () => {
    it('reassigns to the next-nearest driver, who then completes the journey', async () => {
      if (!databaseAvailable) return;

      const customerId = await createCustomer();
      const nearDriverId = await createEligibleDriver(NEAR_DRIVER);
      const farDriverId = await createEligibleDriver(FAR_DRIVER);

      const requested = await requestRide(customerId);
      const firstOffer = await prisma.rideOffer.findFirstOrThrow({
        where: { rideId: requested.id },
      });
      expect(firstOffer.driverId).toBe(nearDriverId);

      await dispatchService.declineOffer(nearDriverId, firstOffer.id, {});

      const secondOffer = await prisma.rideOffer.findFirstOrThrow({
        where: { rideId: requested.id, driverId: farDriverId, status: 'PENDING' },
      });
      const assigned = await dispatchService.acceptOffer(farDriverId, secondOffer.id, {});
      expect(assigned.driverId).toBe(farDriverId);

      await tripService.markArrived(farDriverId, requested.id, {});
      await simulateArrivalAtPickup(farDriverId);
      await tripService.startTrip(farDriverId, requested.id, {});
      const completed = await tripService.completeTrip(farDriverId, requested.id, {});
      expect(completed.status).toBe('COMPLETED');

      const nearAvailability = await prisma.driverAvailability.findUniqueOrThrow({
        where: { driverId: nearDriverId },
      });
      expect(nearAvailability.activeRideCount).toBe(0);
    });
  });

  describe('Scenario 3 — offer times out, dispatch reassigns', () => {
    it('expires the ignored offer after the timeout and moves to the next-nearest driver', async () => {
      if (!databaseAvailable) return;

      const customerId = await createCustomer();
      const nearDriverId = await createEligibleDriver(NEAR_DRIVER);
      const farDriverId = await createEligibleDriver(FAR_DRIVER);

      const requested = await requestRide(customerId);
      const firstOffer = await prisma.rideOffer.findFirstOrThrow({
        where: { rideId: requested.id },
      });
      expect(firstOffer.driverId).toBe(nearDriverId);

      // The driver never responds — backdate the offer past its 15s window
      // instead of sleeping in the test, exactly as ride-dispatch.service.spec.ts does.
      await prisma.rideOffer.update({
        where: { id: firstOffer.id },
        data: { expiresAt: new Date(Date.now() - 1_000) },
      });
      const expiredCount = await dispatchService.expireStaleOffers();
      expect(expiredCount).toBeGreaterThanOrEqual(1);

      const expired = await prisma.rideOffer.findUniqueOrThrow({ where: { id: firstOffer.id } });
      expect(expired.status).toBe('EXPIRED');

      const secondOffer = await prisma.rideOffer.findFirstOrThrow({
        where: { rideId: requested.id, driverId: farDriverId, status: 'PENDING' },
      });
      const assigned = await dispatchService.acceptOffer(farDriverId, secondOffer.id, {});
      expect(assigned.driverId).toBe(farDriverId);
    });

    it('gives up and marks the ride NO_DRIVERS_FOUND once every eligible driver has declined or timed out', async () => {
      if (!databaseAvailable) return;

      const customerId = await createCustomer();
      const driverIds = await Promise.all(
        Array.from({ length: MAX_DISPATCH_ATTEMPTS }, () => createEligibleDriver(NEAR_DRIVER)),
      );

      const requested = await requestRide(customerId);
      let status = requested.status;
      let attempts = 0;
      while (status === 'SEARCHING' && attempts < driverIds.length) {
        const offer = await prisma.rideOffer.findFirstOrThrow({
          where: { rideId: requested.id, status: 'PENDING' },
        });
        await dispatchService.declineOffer(offer.driverId, offer.id, {});
        const refreshed = await prisma.ride.findUniqueOrThrow({ where: { id: requested.id } });
        status = refreshed.status;
        attempts += 1;
      }

      const finalRide = await prisma.ride.findUniqueOrThrow({ where: { id: requested.id } });
      expect(finalRide.status).toBe('NO_DRIVERS_FOUND');
    });
  });

  describe('Scenario 4 — cash payment', () => {
    it('settles without any wallet movement for the fare, and the tip is still recorded', async () => {
      if (!databaseAvailable) return;

      const customerId = await createCustomer();
      const driverId = await createEligibleDriver();

      const requested = await requestRide(customerId);
      const offer = await prisma.rideOffer.findFirstOrThrow({
        where: { rideId: requested.id, driverId },
      });
      await dispatchService.acceptOffer(driverId, offer.id, {});
      await tripService.markArrived(driverId, requested.id, {});
      await simulateArrivalAtPickup(driverId);
      await tripService.startTrip(driverId, requested.id, {});
      await tripService.completeTrip(driverId, requested.id, {});

      await paymentService.initiatePayment(customerId, requested.id, 'CASH', undefined, {});
      const driverWalletBeforeConfirm = await walletService.getWallet(
        WalletOwnerType.DRIVER,
        driverId,
      );
      const confirmed = await paymentService.confirmCash(driverId, requested.id, {});
      expect(confirmed.paymentStatus).toBe('PAID');

      const driverWalletAfterConfirm = await walletService.getWallet(
        WalletOwnerType.DRIVER,
        driverId,
      );
      expect(driverWalletAfterConfirm.availableBalance).toBe(
        driverWalletBeforeConfirm.availableBalance,
      );

      const tipped = await paymentService.tipDriver(customerId, requested.id, 100, {});
      expect(tipped.tipAmount).toBe(100);
      const driverWalletAfterTip = await walletService.getWallet(WalletOwnerType.DRIVER, driverId);
      expect(driverWalletAfterTip.availableBalance).toBe(driverWalletAfterConfirm.availableBalance);

      const receipt = await receiptService.getReceipt(customerId, requested.id);
      expect(receipt.paymentMethod).toBe('CASH');
      expect(receipt.fare.tipAmount).toBe(100);
    });
  });

  describe('Scenario 5 — OPay safe-disabled', () => {
    // Founder decision (DPX-DRIVER-013 §G): OPay is removed from customer-selectable
    // ride gateways until a real OpayProvider adapter exists. An OPAY ride request
    // must be rejected cleanly at initiation (validation error) rather than reaching
    // the not-yet-implemented adapter and 501-ing in production.
    it('rejects an OPay ride payment at initiation (no adapter registered)', async () => {
      if (!databaseAvailable) return;

      const customerId = await createCustomer();
      const driverId = await createEligibleDriver();

      const requested = await requestRide(customerId);
      const offer = await prisma.rideOffer.findFirstOrThrow({
        where: { rideId: requested.id, driverId },
      });
      await dispatchService.acceptOffer(driverId, offer.id, {});
      await tripService.markArrived(driverId, requested.id, {});
      await simulateArrivalAtPickup(driverId);
      await tripService.startTrip(driverId, requested.id, {});
      await tripService.completeTrip(driverId, requested.id, {});

      await expect(
        paymentService.initiatePayment(customerId, requested.id, 'OPAY', undefined, {}),
      ).rejects.toThrow('Unsupported ride payment method: OPAY');

      const receipt = await receiptService.getReceipt(customerId, requested.id);
      expect(receipt.paymentStatus).not.toBe('PAID');
    });
  });

  describe('Scenario 7 — cancellation rules', () => {
    it('lets the customer cancel before a driver is assigned', async () => {
      if (!databaseAvailable) return;

      const customerId = await createCustomer();
      // An eligible driver exists and is offered, but hasn't accepted yet ->
      // the ride sits in SEARCHING, not yet DRIVER_ASSIGNED.
      await createEligibleDriver();
      const requested = await requestRide(customerId);
      expect(requested.status).toBe('SEARCHING');

      const cancelled = await ridesService.cancelRide(customerId, requested.id, {}, {});
      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.cancelledBy).toBe('CUSTOMER');
    });

    it('lets the customer cancel after a driver is assigned, freeing the driver', async () => {
      if (!databaseAvailable) return;

      const customerId = await createCustomer();
      const driverId = await createEligibleDriver();
      const requested = await requestRide(customerId);
      const offer = await prisma.rideOffer.findFirstOrThrow({
        where: { rideId: requested.id, driverId },
      });
      await dispatchService.acceptOffer(driverId, offer.id, {});

      const cancelled = await ridesService.cancelRide(customerId, requested.id, {}, {});
      expect(cancelled.status).toBe('CANCELLED');

      const availability = await prisma.driverAvailability.findUniqueOrThrow({
        where: { driverId },
      });
      expect(availability.activeRideCount).toBe(0);
    });

    it('lets the driver cancel before pickup (DRIVER_ASSIGNED), freeing their own availability', async () => {
      if (!databaseAvailable) return;

      const customerId = await createCustomer();
      const driverId = await createEligibleDriver();
      const requested = await requestRide(customerId);
      const offer = await prisma.rideOffer.findFirstOrThrow({
        where: { rideId: requested.id, driverId },
      });
      await dispatchService.acceptOffer(driverId, offer.id, {});

      const cancelled = await tripService.cancelByDriver(
        driverId,
        requested.id,
        'vehicle trouble',
        {},
      );
      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.cancelledBy).toBe('DRIVER');

      const availability = await prisma.driverAvailability.findUniqueOrThrow({
        where: { driverId },
      });
      expect(availability.activeRideCount).toBe(0);
    });

    it('lets the driver cancel after arriving but before the trip starts', async () => {
      if (!databaseAvailable) return;

      const customerId = await createCustomer();
      const driverId = await createEligibleDriver();
      const requested = await requestRide(customerId);
      const offer = await prisma.rideOffer.findFirstOrThrow({
        where: { rideId: requested.id, driverId },
      });
      await dispatchService.acceptOffer(driverId, offer.id, {});
      await tripService.markArrived(driverId, requested.id, {});

      const cancelled = await tripService.cancelByDriver(driverId, requested.id, undefined, {});
      expect(cancelled.status).toBe('CANCELLED');
    });

    it('rejects cancellation once the trip is already in progress, for both sides', async () => {
      if (!databaseAvailable) return;

      const customerId = await createCustomer();
      const driverId = await createEligibleDriver();
      const requested = await requestRide(customerId);
      const offer = await prisma.rideOffer.findFirstOrThrow({
        where: { rideId: requested.id, driverId },
      });
      await dispatchService.acceptOffer(driverId, offer.id, {});
      await tripService.markArrived(driverId, requested.id, {});
      await simulateArrivalAtPickup(driverId);
      await tripService.startTrip(driverId, requested.id, {});

      await expect(ridesService.cancelRide(customerId, requested.id, {}, {})).rejects.toThrow(
        'Ride cannot be cancelled from status IN_PROGRESS',
      );
      await expect(
        tripService.cancelByDriver(driverId, requested.id, undefined, {}),
      ).rejects.toThrow('Ride cannot be cancelled by the driver from status IN_PROGRESS');

      // Clean up so the trip doesn't leak an active ride into other tests.
      await tripService.completeTrip(driverId, requested.id, {});
    });
  });
});
