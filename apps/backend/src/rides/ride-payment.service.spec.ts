import { randomUUID } from 'node:crypto';

import { PrismaClient, WalletOwnerType } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { CommercialCreditSettingsService } from '../commercial/commercial-credit-settings.service';
import {
  DEFAULT_PLATFORM_COMMISSION_RATE,
  PLATFORM_COMMISSION_SETTING_ID,
} from '../commercial/commercial.constants';
import { CommissionAccountService } from '../commercial/commission-account.service';
import { PlatformCommissionSettingsService } from '../commercial/platform-commission-settings.service';
import { ConflictDomainException } from '../common/exceptions/domain.exception';
import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../events/domain-events';
import { PLATFORM_WALLET_OWNER_ID } from '../wallet/wallet.constants';
import { WalletService } from '../wallet/wallet.service';

import { RidePaymentService } from './ride-payment.service';

// The launch platform commission rate is the Ops-configurable default (10%).
// These tests exercise settlement/refund at the default rate; the dedicated
// platform-commission-settings spec covers changing it + historical snapshots.
const RIDE_PLATFORM_COMMISSION_RATE = DEFAULT_PLATFORM_COMMISSION_RATE;

import type { RideEventsPublisher } from './ride-events.publisher';
import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { NotificationService } from '../notifications/notification.service';
import type { PaymentProviderAdapter } from '../payments/providers/payment-provider.adapter';
import type { PrismaService } from '../prisma/prisma.service';
import type { PaymentProvider, Ride } from '@prisma/client';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

function fakeAdapter(provider: PaymentProvider): jest.Mocked<PaymentProviderAdapter> {
  return {
    provider,
    initializePayment: jest.fn(),
    verifyPayment: jest.fn(),
    handleWebhook: jest.fn(),
  };
}

describe('RidePaymentService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: RidePaymentService;
  let eventBus: DomainEventBus;
  let walletService: WalletService;
  let commissionAccounts: CommissionAccountService;
  let paystackAdapter: jest.Mocked<PaymentProviderAdapter>;
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
    const events: jest.Mocked<RideEventsPublisher> = {
      publishToRide: jest.fn(),
      publishToDriver: jest.fn(),
    };

    paystackAdapter = fakeAdapter('PAYSTACK');
    const flutterwaveAdapter = fakeAdapter('FLUTTERWAVE');
    // OPay is safe-disabled from ride selection (DPX-DRIVER-013 §G) — no OPAY
    // adapter is registered, matching production GATEWAY_METHODS.

    eventBus = new DomainEventBus();
    const commercialCreditSettings = new CommercialCreditSettingsService(prisma, auditService);
    commissionAccounts = new CommissionAccountService(
      prisma,
      auditService,
      commercialCreditSettings,
    );
    const platformCommissionSettings = new PlatformCommissionSettingsService(prisma, auditService);
    service = new RidePaymentService(
      prisma,
      walletService,
      auditService,
      notifications,
      events,
      [paystackAdapter, flutterwaveAdapter],
      eventBus,
      commissionAccounts,
      platformCommissionSettings,
    );

    const customer = await prisma.user.create({
      data: {
        email: `ride-payment-customer-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Customer',
      },
    });
    customerId = customer.id;
    createdUserIds.push(customerId);

    const driver = await prisma.user.create({
      data: {
        email: `ride-payment-driver-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Driver',
      },
    });
    driverId = driver.id;
    createdUserIds.push(driverId);
  });

  // DPX-COMMERCIAL-001 Slice 4 — every test in this file shares one
  // driverId; give commission-account-sensitive tests a clean slate,
  // same fix Slice 3 applied to merchant-settlement.service.spec.ts's
  // shared merchant fixture.
  afterEach(async () => {
    if (!databaseAvailable) return;
    await prisma.commissionLedgerEntry.deleteMany({
      where: { account: { ownerType: 'DRIVER', ownerId: driverId } },
    });
    await prisma.commissionAccount.deleteMany({
      where: { ownerType: 'DRIVER', ownerId: driverId },
    });
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.ridePaymentTransaction.deleteMany({ where: { rideId: { in: createdRideIds } } });
      await prisma.ride.deleteMany({ where: { id: { in: createdRideIds } } });
      await prisma.walletLedgerEntry.deleteMany({
        where: { wallet: { ownerId: { in: [...createdUserIds, PLATFORM_WALLET_OWNER_ID] } } },
      });
      await prisma.wallet
        .deleteMany({ where: { ownerId: { in: [...createdUserIds, PLATFORM_WALLET_OWNER_ID] } } })
        .catch(() => undefined);
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  async function createCompletedRide(totalFare = 1000, promoDiscount = 0): Promise<Ride> {
    const ride = await prisma.ride.create({
      data: {
        customerId,
        driverId,
        promoDiscount,
        rideType: 'ECONOMY',
        status: 'COMPLETED',
        pickupLatitude: 6.6,
        pickupLongitude: 3.35,
        dropoffLatitude: 6.62,
        dropoffLongitude: 3.37,
        estimatedDistanceMeters: 2000,
        estimatedDurationSeconds: 300,
        baseFare: 300,
        distanceFare: 200,
        timeFare: 50,
        totalFare,
        assignedAt: new Date(),
        arrivedAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });
    createdRideIds.push(ride.id);
    return ride;
  }

  it('settles a wallet payment: debits customer, credits driver net of commission', async () => {
    if (!databaseAvailable) return;

    await walletService.credit({
      ownerType: WalletOwnerType.CUSTOMER,
      ownerId: customerId,
      amount: 5000,
      description: 'test top-up',
    });

    const ride = await createCompletedRide(1000);

    const result = await service.initiatePayment(customerId, ride.id, 'WALLET', undefined, {});

    expect(result.ride.paymentStatus).toBe('PAID');
    expect(result.ride.paymentMethod).toBe('WALLET');
    expect(result.ride.platformCommission).toBeCloseTo(1000 * RIDE_PLATFORM_COMMISSION_RATE);
    expect(result.ride.driverEarning).toBeCloseTo(1000 * (1 - RIDE_PLATFORM_COMMISSION_RATE));

    const customerWallet = await walletService.getWallet(WalletOwnerType.CUSTOMER, customerId);
    expect(customerWallet.availableBalance).toBeCloseTo(4000);

    const driverWallet = await walletService.getWallet(WalletOwnerType.DRIVER, driverId);
    expect(driverWallet.availableBalance).toBeCloseTo(1000 * (1 - RIDE_PLATFORM_COMMISSION_RATE));
  });

  it('fails a wallet payment when the customer balance is insufficient', async () => {
    if (!databaseAvailable) return;

    const poorCustomer = await prisma.user.create({
      data: {
        email: `ride-payment-poor-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Poor',
        lastName: 'Customer',
      },
    });
    createdUserIds.push(poorCustomer.id);

    const ride = await prisma.ride.create({
      data: {
        customerId: poorCustomer.id,
        driverId,
        rideType: 'ECONOMY',
        status: 'COMPLETED',
        pickupLatitude: 6.6,
        pickupLongitude: 3.35,
        dropoffLatitude: 6.62,
        dropoffLongitude: 3.37,
        totalFare: 1000,
      },
    });
    createdRideIds.push(ride.id);

    await expect(
      service.initiatePayment(poorCustomer.id, ride.id, 'WALLET', undefined, {}),
    ).rejects.toThrow('Insufficient wallet balance');

    const updated = await prisma.ride.findUniqueOrThrow({ where: { id: ride.id } });
    expect(updated.paymentStatus).toBe('FAILED');
  });

  it('confirms a cash ride without moving any wallet balances', async () => {
    if (!databaseAvailable) return;

    const ride = await createCompletedRide(800);
    await service.initiatePayment(customerId, ride.id, 'CASH', undefined, {});

    const driverWalletBefore = await walletService.getWallet(WalletOwnerType.DRIVER, driverId);
    const emitSpy = jest.spyOn(eventBus, 'emit');

    const result = await service.confirmCash(driverId, ride.id, {});

    expect(result.paymentStatus).toBe('PAID');
    expect(result.paymentMethod).toBe('CASH');
    expect(result.driverEarning).toBeCloseTo(800 * (1 - RIDE_PLATFORM_COMMISSION_RATE));

    const driverWalletAfter = await walletService.getWallet(WalletOwnerType.DRIVER, driverId);
    expect(driverWalletAfter.availableBalance).toBe(driverWalletBefore.availableBalance);

    expect(emitSpy).toHaveBeenCalledWith(
      DOMAIN_EVENTS.RIDE_CASH_CONFIRMED,
      expect.objectContaining({ driverId, rideId: ride.id }),
    );
  });

  it('rejects cash confirmation from a driver who is not assigned to the ride', async () => {
    if (!databaseAvailable) return;

    const ride = await createCompletedRide(500);
    await service.initiatePayment(customerId, ride.id, 'CASH', undefined, {});

    await expect(service.confirmCash(randomUUID(), ride.id, {})).rejects.toThrow('Ride not found');
  });

  describe('DPX-COMMERCIAL-001 Slice 4 — driver commission accrual on cash confirmation', () => {
    it('accrues the platform commission onto the driver CommissionAccount instead of leaving it audit-only', async () => {
      if (!databaseAvailable) return;

      const ride = await createCompletedRide(1000);
      await service.initiatePayment(customerId, ride.id, 'CASH', undefined, {});

      const result = await service.confirmCash(driverId, ride.id, {});

      const expectedCommission = 1000 * RIDE_PLATFORM_COMMISSION_RATE;
      expect(result.platformCommission).toBeCloseTo(expectedCommission);

      const account = await commissionAccounts.getOrCreateAccount('DRIVER', driverId);
      expect(Number(account.outstandingBalance)).toBeCloseTo(expectedCommission);

      const ledgerCount = await prisma.commissionLedgerEntry.count({
        where: {
          account: { ownerType: 'DRIVER', ownerId: driverId },
          referenceType: 'ride',
          referenceId: ride.id,
        },
      });
      expect(ledgerCount).toBe(1);
    });

    it('replayed confirmCash on the same ride never double-accrues (ride.paymentStatus already gates it)', async () => {
      if (!databaseAvailable) return;

      const ride = await createCompletedRide(600);
      await service.initiatePayment(customerId, ride.id, 'CASH', undefined, {});

      await service.confirmCash(driverId, ride.id, {});
      await expect(service.confirmCash(driverId, ride.id, {})).rejects.toThrow(
        'Ride has already been paid',
      );

      const account = await commissionAccounts.getOrCreateAccount('DRIVER', driverId);
      expect(Number(account.outstandingBalance)).toBeCloseTo(600 * RIDE_PLATFORM_COMMISSION_RATE);
    });

    it('concurrent cash confirmations for two different rides by the same driver never lose an accrual to the shared CommissionAccount race', async () => {
      if (!databaseAvailable) return;

      const rideA = await createCompletedRide(700);
      const rideB = await createCompletedRide(900);
      await service.initiatePayment(customerId, rideA.id, 'CASH', undefined, {});
      await service.initiatePayment(customerId, rideB.id, 'CASH', undefined, {});

      const accountBefore = await commissionAccounts.getOrCreateAccount('DRIVER', driverId);
      const startingBalance = Number(accountBefore.outstandingBalance);

      const [resultA, resultB] = await Promise.all([
        service.confirmCash(driverId, rideA.id, {}),
        service.confirmCash(driverId, rideB.id, {}),
      ]);

      expect(resultA.paymentStatus).toBe('PAID');
      expect(resultB.paymentStatus).toBe('PAID');

      const accountAfter = await commissionAccounts.getOrCreateAccount('DRIVER', driverId);
      const expectedTotal =
        startingBalance + 700 * RIDE_PLATFORM_COMMISSION_RATE + 900 * RIDE_PLATFORM_COMMISSION_RATE;
      expect(Number(accountAfter.outstandingBalance)).toBeCloseTo(expectedTotal);

      const ledgerCount = await prisma.commissionLedgerEntry.count({
        where: {
          account: { ownerType: 'DRIVER', ownerId: driverId },
          referenceType: 'ride',
          referenceId: { in: [rideA.id, rideB.id] },
        },
      });
      expect(ledgerCount).toBe(2);
    });
  });

  describe('D7 — ride settlement atomicity (concurrent cash confirmation on the SAME ride)', () => {
    it('lets exactly one of two concurrent confirmCash() calls settle the ride; the duplicate is safely rejected, with exactly one settlement and one commission entry', async () => {
      if (!databaseAvailable) return;

      const ride = await createCompletedRide(2000);
      await service.initiatePayment(customerId, ride.id, 'CASH', undefined, {});
      const expectedCommission = 2000 * RIDE_PLATFORM_COMMISSION_RATE;

      // Pre-establish the driver's CommissionAccount so this test isolates the
      // RIDE-LEVEL settlement race that D7 fixes. The separate first-touch
      // account/credit-settings check-then-create race (two concurrent accruals
      // both CREATE-ing a not-yet-existing account) is an orthogonal, documented
      // commission-service follow-up deliberately out of D7's scope — the same
      // reason the Slice 4 concurrency test above pre-creates the account too.
      await commissionAccounts.getOrCreateAccount('DRIVER', driverId);

      const emitSpy = jest.spyOn(eventBus, 'emit');

      // Two confirmations for the SAME ride race. Before D7 both could pass the
      // unlocked paymentStatus read and both settle; the atomic PAID transition
      // now guarantees exactly one winner.
      const settled = await Promise.allSettled([
        service.confirmCash(driverId, ride.id, {}),
        service.confirmCash(driverId, ride.id, {}),
      ]);

      const fulfilled = settled.filter((r) => r.status === 'fulfilled');
      const rejected = settled.filter((r) => r.status === 'rejected');

      // Proof 1 + 2: exactly one succeeds; the duplicate is safely rejected.
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      const rejection = rejected[0];
      expect(rejection?.status).toBe('rejected');
      if (rejection?.status === 'rejected') {
        expect(rejection.reason).toBeInstanceOf(ConflictDomainException);
      }

      // Proof 3: exactly one settlement — the ride is PAID with the correct split.
      const persisted = await prisma.ride.findUniqueOrThrow({ where: { id: ride.id } });
      expect(persisted.paymentStatus).toBe('PAID');
      expect(persisted.paymentMethod).toBe('CASH');
      expect(Number(persisted.platformCommission)).toBeCloseTo(expectedCommission);

      // Proof 4: exactly one commission ledger entry for this ride.
      const ledgerCount = await prisma.commissionLedgerEntry.count({
        where: {
          account: { ownerType: 'DRIVER', ownerId: driverId },
          referenceType: 'ride',
          referenceId: ride.id,
        },
      });
      expect(ledgerCount).toBe(1);

      // Proof 5: no duplicated money movement — the driver's commission liability
      // is a single ride's commission, not double.
      const account = await commissionAccounts.getOrCreateAccount('DRIVER', driverId);
      expect(Number(account.outstandingBalance)).toBeCloseTo(expectedCommission);

      // The settlement event fires exactly once (only the winner emits it).
      const cashConfirmedEmits = emitSpy.mock.calls.filter(
        ([name]) => name === DOMAIN_EVENTS.RIDE_CASH_CONFIRMED,
      );
      expect(cashConfirmedEmits).toHaveLength(1);
      emitSpy.mockRestore();
    });

    it('a failure during the PAID transition leaves a consistent, recoverable state — retry converges without duplicating money (proof 6)', async () => {
      if (!databaseAvailable) return;

      const ride = await createCompletedRide(1200);
      await service.initiatePayment(customerId, ride.id, 'CASH', undefined, {});
      const expectedCommission = 1200 * RIDE_PLATFORM_COMMISSION_RATE;

      // Force the atomic PAID transition to fail once (simulating a DB error
      // mid-settlement), after the commission accrual has already committed.
      const updateManySpy = jest
        .spyOn(prisma.ride, 'updateMany')
        .mockRejectedValueOnce(new Error('simulated DB failure during PAID transition'));

      await expect(service.confirmCash(driverId, ride.id, {})).rejects.toThrow(
        'simulated DB failure during PAID transition',
      );
      updateManySpy.mockRestore();

      // Consistent state: the failed transition left the ride NOT PAID (the
      // single-statement updateMany is atomic — no half-written PAID row).
      const afterFailure = await prisma.ride.findUniqueOrThrow({ where: { id: ride.id } });
      expect(afterFailure.paymentStatus).not.toBe('PAID');

      // The commission accrual that ran before the failure is present exactly once.
      const ledgerAfterFailure = await prisma.commissionLedgerEntry.count({
        where: {
          account: { ownerType: 'DRIVER', ownerId: driverId },
          referenceType: 'ride',
          referenceId: ride.id,
        },
      });
      expect(ledgerAfterFailure).toBe(1);

      // Retry converges: the ride settles, and the commission entry is NOT
      // duplicated (the (accountId, 'ride', rideId) ledger guard dedupes it).
      const recovered = await service.confirmCash(driverId, ride.id, {});
      expect(recovered.paymentStatus).toBe('PAID');

      const ledgerAfterRecovery = await prisma.commissionLedgerEntry.count({
        where: {
          account: { ownerType: 'DRIVER', ownerId: driverId },
          referenceType: 'ride',
          referenceId: ride.id,
        },
      });
      expect(ledgerAfterRecovery).toBe(1);

      const account = await commissionAccounts.getOrCreateAccount('DRIVER', driverId);
      expect(Number(account.outstandingBalance)).toBeCloseTo(expectedCommission);
    });
  });

  it('initiates a gateway payment and settles on successful verification', async () => {
    if (!databaseAvailable) return;

    const ride = await createCompletedRide(1200);

    paystackAdapter.initializePayment.mockResolvedValueOnce({
      provider: 'PAYSTACK',
      reference: `test-ref-${ride.id}`,
      authorizationUrl: 'https://checkout.paystack.com/test',
    });

    const initiated = await service.initiatePayment(customerId, ride.id, 'PAYSTACK', undefined, {});
    expect(initiated.authorizationUrl).toBe('https://checkout.paystack.com/test');
    expect(initiated.ride.paymentStatus).toBe('PENDING');

    paystackAdapter.verifyPayment.mockResolvedValueOnce({
      success: true,
      reference: initiated.reference ?? '',
      paidAt: new Date(),
    });

    const verified = await service.verifyPayment(customerId, ride.id, initiated.reference, {});
    expect(verified.paymentStatus).toBe('PAID');
    expect(verified.driverEarning).toBeCloseTo(1200 * (1 - RIDE_PLATFORM_COMMISSION_RATE));
  });

  it('marks the ride payment failed when gateway verification fails', async () => {
    if (!databaseAvailable) return;

    const ride = await createCompletedRide(600);
    paystackAdapter.initializePayment.mockResolvedValueOnce({
      provider: 'PAYSTACK',
      reference: `test-ref-fail-${ride.id}`,
      authorizationUrl: 'https://checkout.paystack.com/test-fail',
    });
    const initiated = await service.initiatePayment(customerId, ride.id, 'PAYSTACK', undefined, {});

    paystackAdapter.verifyPayment.mockResolvedValueOnce({
      success: false,
      reference: initiated.reference ?? '',
    });

    await expect(
      service.verifyPayment(customerId, ride.id, initiated.reference, {}),
    ).rejects.toThrow('Payment verification failed');

    const updated = await prisma.ride.findUniqueOrThrow({ where: { id: ride.id } });
    expect(updated.paymentStatus).toBe('FAILED');
  });

  it('rejects paying a ride that is not yet completed', async () => {
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
        totalFare: 500,
      },
    });
    createdRideIds.push(ride.id);

    await expect(
      service.initiatePayment(customerId, ride.id, 'WALLET', undefined, {}),
    ).rejects.toThrow('Ride is not awaiting payment');
  });

  it('rejects paying a ride that has already been paid', async () => {
    if (!databaseAvailable) return;

    await walletService.credit({
      ownerType: WalletOwnerType.CUSTOMER,
      ownerId: customerId,
      amount: 5000,
      description: 'test top-up',
    });
    const ride = await createCompletedRide(700);
    await service.initiatePayment(customerId, ride.id, 'WALLET', undefined, {});

    await expect(
      service.initiatePayment(customerId, ride.id, 'WALLET', undefined, {}),
    ).rejects.toThrow('Ride has already been paid');
  });

  it('leaves the platform wallet ledger reconciled after mixed wallet and gateway settlements', async () => {
    if (!databaseAvailable) return;

    await walletService.credit({
      ownerType: WalletOwnerType.CUSTOMER,
      ownerId: customerId,
      amount: 10_000,
      description: 'test top-up',
    });

    const walletRide = await createCompletedRide(1000);
    await service.initiatePayment(customerId, walletRide.id, 'WALLET', undefined, {});

    const gatewayRide = await createCompletedRide(2000);
    paystackAdapter.initializePayment.mockResolvedValueOnce({
      provider: 'PAYSTACK',
      reference: `reconcile-ref-${gatewayRide.id}`,
      authorizationUrl: 'https://checkout.paystack.com/reconcile',
    });
    const initiated = await service.initiatePayment(
      customerId,
      gatewayRide.id,
      'PAYSTACK',
      undefined,
      {},
    );
    paystackAdapter.verifyPayment.mockResolvedValueOnce({
      success: true,
      reference: initiated.reference ?? '',
      paidAt: new Date(),
    });
    await service.verifyPayment(customerId, gatewayRide.id, initiated.reference, {});

    const reconciliation = await walletService.reconcileWallet(
      WalletOwnerType.PLATFORM,
      PLATFORM_WALLET_OWNER_ID,
    );

    expect(reconciliation.reconciled).toBe(true);
    expect(reconciliation.difference).toBe(0);
  });

  it('tips the driver 100% with no platform commission on a wallet-paid ride', async () => {
    if (!databaseAvailable) return;

    await walletService.credit({
      ownerType: WalletOwnerType.CUSTOMER,
      ownerId: customerId,
      amount: 5000,
      description: 'test top-up',
    });

    const ride = await createCompletedRide(1000);
    await service.initiatePayment(customerId, ride.id, 'WALLET', undefined, {});

    const driverWalletBefore = await walletService.getWallet(WalletOwnerType.DRIVER, driverId);
    const customerWalletBefore = await walletService.getWallet(
      WalletOwnerType.CUSTOMER,
      customerId,
    );
    const platformWalletBefore = await walletService.getWallet(
      WalletOwnerType.PLATFORM,
      PLATFORM_WALLET_OWNER_ID,
    );

    const result = await service.tipDriver(customerId, ride.id, 200, {});
    expect(result.tipAmount).toBe(200);

    const driverWalletAfter = await walletService.getWallet(WalletOwnerType.DRIVER, driverId);
    expect(driverWalletAfter.availableBalance).toBeCloseTo(
      driverWalletBefore.availableBalance + 200,
    );

    const customerWalletAfter = await walletService.getWallet(WalletOwnerType.CUSTOMER, customerId);
    expect(customerWalletAfter.availableBalance).toBeCloseTo(
      customerWalletBefore.availableBalance - 200,
    );

    const platformWalletAfter = await walletService.getWallet(
      WalletOwnerType.PLATFORM,
      PLATFORM_WALLET_OWNER_ID,
    );
    expect(platformWalletAfter.availableBalance).toBeCloseTo(platformWalletBefore.availableBalance);
  });

  it('records a cash tip without moving any wallet balances', async () => {
    if (!databaseAvailable) return;

    const ride = await createCompletedRide(900);
    await service.initiatePayment(customerId, ride.id, 'CASH', undefined, {});
    await service.confirmCash(driverId, ride.id, {});

    const driverWalletBefore = await walletService.getWallet(WalletOwnerType.DRIVER, driverId);

    const result = await service.tipDriver(customerId, ride.id, 100, {});
    expect(result.tipAmount).toBe(100);

    const driverWalletAfter = await walletService.getWallet(WalletOwnerType.DRIVER, driverId);
    expect(driverWalletAfter.availableBalance).toBe(driverWalletBefore.availableBalance);
  });

  it('rejects tipping a ride that has not been paid yet', async () => {
    if (!databaseAvailable) return;

    const ride = await createCompletedRide(500);

    await expect(service.tipDriver(customerId, ride.id, 100, {})).rejects.toThrow(
      'Ride must be paid before it can be tipped',
    );
  });

  it('rejects tipping the same ride twice', async () => {
    if (!databaseAvailable) return;

    await walletService.credit({
      ownerType: WalletOwnerType.CUSTOMER,
      ownerId: customerId,
      amount: 5000,
      description: 'test top-up',
    });

    const ride = await createCompletedRide(1000);
    await service.initiatePayment(customerId, ride.id, 'WALLET', undefined, {});
    await service.tipDriver(customerId, ride.id, 100, {});

    await expect(service.tipDriver(customerId, ride.id, 100, {})).rejects.toThrow(
      'Ride has already been tipped',
    );
  });

  describe('DPX-D4 — ride refunds (admin/operations-initiated, full)', () => {
    async function settleWalletRide(totalFare: number): Promise<Ride> {
      await walletService.credit({
        ownerType: WalletOwnerType.CUSTOMER,
        ownerId: customerId,
        amount: totalFare,
        description: 'top-up for ride',
      });
      const ride = await createCompletedRide(totalFare);
      await service.initiatePayment(customerId, ride.id, 'WALLET', undefined, {});
      return await prisma.ride.findUniqueOrThrow({ where: { id: ride.id } });
    }

    async function settleGatewayRide(totalFare: number): Promise<Ride> {
      const ride = await createCompletedRide(totalFare);
      paystackAdapter.initializePayment.mockResolvedValueOnce({
        provider: 'PAYSTACK',
        reference: `d4-ref-${ride.id}`,
        authorizationUrl: 'https://checkout.paystack.com/d4',
      });
      const initiated = await service.initiatePayment(
        customerId,
        ride.id,
        'PAYSTACK',
        undefined,
        {},
      );
      paystackAdapter.verifyPayment.mockResolvedValueOnce({
        success: true,
        reference: initiated.reference ?? '',
        paidAt: new Date(),
      });
      await service.verifyPayment(customerId, ride.id, initiated.reference, {});
      return await prisma.ride.findUniqueOrThrow({ where: { id: ride.id } });
    }

    async function settleCashRide(totalFare: number): Promise<Ride> {
      const ride = await createCompletedRide(totalFare);
      await service.initiatePayment(customerId, ride.id, 'CASH', undefined, {});
      await service.confirmCash(driverId, ride.id, {});
      return await prisma.ride.findUniqueOrThrow({ where: { id: ride.id } });
    }

    const balance = async (ownerType: WalletOwnerType, ownerId: string): Promise<number> =>
      (await walletService.getWallet(ownerType, ownerId)).availableBalance;

    it('D4-1: gateway-paid full refund credits the customer Dx wallet and marks the transaction REFUNDED', async () => {
      if (!databaseAvailable) return;
      const totalFare = 2000;
      const ride = await settleGatewayRide(totalFare);
      const earning = Number(ride.driverEarning);
      const custBefore = await balance(WalletOwnerType.CUSTOMER, customerId);
      const drvBefore = await balance(WalletOwnerType.DRIVER, driverId);

      const refunded = await service.refundRide('admin-user', ride.id, 'gateway refund', {});

      expect(refunded.paymentStatus).toBe('REFUNDED');
      expect((await balance(WalletOwnerType.CUSTOMER, customerId)) - custBefore).toBeCloseTo(
        totalFare,
      );
      expect(drvBefore - (await balance(WalletOwnerType.DRIVER, driverId))).toBeCloseTo(earning);

      const txn = await prisma.ridePaymentTransaction.findFirst({ where: { rideId: ride.id } });
      expect(txn?.status).toBe('REFUNDED');
    });

    it('D4-2: cash ride refund reverses only the driver commission, with no customer wallet movement', async () => {
      if (!databaseAvailable) return;
      const ride = await settleCashRide(1000);
      const commission = Number(ride.platformCommission);
      expect(
        Number(
          (await commissionAccounts.getOrCreateAccount('DRIVER', driverId)).outstandingBalance,
        ),
      ).toBeCloseTo(commission);
      const custBefore = await balance(WalletOwnerType.CUSTOMER, customerId);

      const refunded = await service.refundRide('admin-user', ride.id, 'cash refund', {});

      expect(refunded.paymentStatus).toBe('REFUNDED');
      expect(
        Number(
          (await commissionAccounts.getOrCreateAccount('DRIVER', driverId)).outstandingBalance,
        ),
      ).toBeCloseTo(0);
      expect(await balance(WalletOwnerType.CUSTOMER, customerId)).toBe(custBefore);
    });

    it('D4-3: wallet ride refund claws the driver earning back and the platform nets the commission it gave up', async () => {
      if (!databaseAvailable) return;
      const totalFare = 1500;
      const ride = await settleWalletRide(totalFare);
      const earning = Number(ride.driverEarning);
      const drvBefore = await balance(WalletOwnerType.DRIVER, driverId);
      const platBefore = await balance(WalletOwnerType.PLATFORM, PLATFORM_WALLET_OWNER_ID);

      await service.refundRide('admin-user', ride.id, 'wallet refund', {});

      expect(drvBefore - (await balance(WalletOwnerType.DRIVER, driverId))).toBeCloseTo(earning);
      // Platform releases the fare and receives the earning back → nets -commission.
      expect(
        platBefore - (await balance(WalletOwnerType.PLATFORM, PLATFORM_WALLET_OWNER_ID)),
      ).toBeCloseTo(totalFare - earning);
    });

    it('D4-4: an uncoverable clawback records a recoverable driver liability instead of silently failing', async () => {
      if (!databaseAvailable) return;
      const totalFare = 2000;
      const ride = await settleWalletRide(totalFare);
      const earning = Number(ride.driverEarning);

      // Drain the driver's wallet so the clawback cannot be taken.
      const drvBal = await balance(WalletOwnerType.DRIVER, driverId);
      if (drvBal > 0) {
        await walletService.debit({
          ownerType: WalletOwnerType.DRIVER,
          ownerId: driverId,
          amount: drvBal,
          referenceType: 'test_drain',
          referenceId: ride.id,
          description: 'drain driver wallet',
        });
      }
      // Platform operating buffer so it can still front the customer's refund.
      await walletService.credit({
        ownerType: WalletOwnerType.PLATFORM,
        ownerId: PLATFORM_WALLET_OWNER_ID,
        amount: totalFare,
        description: 'platform operating buffer',
      });
      const custBefore = await balance(WalletOwnerType.CUSTOMER, customerId);

      const refunded = await service.refundRide('admin-user', ride.id, 'drained driver refund', {});
      expect(refunded.paymentStatus).toBe('REFUNDED');

      // Customer still fully refunded; driver wallet never driven negative.
      expect((await balance(WalletOwnerType.CUSTOMER, customerId)) - custBefore).toBeCloseTo(
        totalFare,
      );
      expect(await balance(WalletOwnerType.DRIVER, driverId)).toBe(0);

      // The unrecovered earning is a recoverable driver liability.
      expect(
        Number(
          (await commissionAccounts.getOrCreateAccount('DRIVER', driverId)).outstandingBalance,
        ),
      ).toBeCloseTo(earning);
      const debtEntry = await prisma.commissionLedgerEntry.findFirst({
        where: {
          account: { ownerType: 'DRIVER', ownerId: driverId },
          referenceType: 'ride_earning_clawback_debt',
          referenceId: ride.id,
        },
      });
      expect(debtEntry).not.toBeNull();
    });

    it('D4-5: a cash commission reversal is applied exactly once even when refund is attempted twice', async () => {
      if (!databaseAvailable) return;
      const ride = await settleCashRide(1200);
      await service.refundRide('admin-user', ride.id, 'first', {});
      await expect(service.refundRide('admin-user', ride.id, 'second', {})).rejects.toThrow(
        'already been refunded',
      );

      const reversalCount = await prisma.commissionLedgerEntry.count({
        where: {
          account: { ownerType: 'DRIVER', ownerId: driverId },
          referenceType: 'ride_commission_reversal',
          referenceId: ride.id,
        },
      });
      expect(reversalCount).toBe(1);
      expect(
        Number(
          (await commissionAccounts.getOrCreateAccount('DRIVER', driverId)).outstandingBalance,
        ),
      ).toBeCloseTo(0);
    });

    it('D4-6: a duplicate refund request is rejected and does not double-credit the customer', async () => {
      if (!databaseAvailable) return;
      const totalFare = 1000;
      const ride = await settleWalletRide(totalFare);
      const custBefore = await balance(WalletOwnerType.CUSTOMER, customerId);

      await service.refundRide('admin-user', ride.id, 'first', {});
      await expect(service.refundRide('admin-user', ride.id, 'dup', {})).rejects.toThrow(
        'already been refunded',
      );

      expect((await balance(WalletOwnerType.CUSTOMER, customerId)) - custBefore).toBeCloseTo(
        totalFare,
      );
    });

    it('D4-7: two concurrent refunds settle exactly once — one succeeds, one rejected, money moves once', async () => {
      if (!databaseAvailable) return;
      const totalFare = 1600;
      const ride = await settleWalletRide(totalFare);
      const earning = Number(ride.driverEarning);
      const custBefore = await balance(WalletOwnerType.CUSTOMER, customerId);
      const drvBefore = await balance(WalletOwnerType.DRIVER, driverId);

      const results = await Promise.allSettled([
        service.refundRide('admin-a', ride.id, 'concurrent-a', {}),
        service.refundRide('admin-b', ride.id, 'concurrent-b', {}),
      ]);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      const rej = rejected[0];
      expect(rej?.status).toBe('rejected');
      if (rej?.status === 'rejected') {
        expect(rej.reason).toBeInstanceOf(ConflictDomainException);
      }

      expect((await prisma.ride.findUniqueOrThrow({ where: { id: ride.id } })).paymentStatus).toBe(
        'REFUNDED',
      );
      expect((await balance(WalletOwnerType.CUSTOMER, customerId)) - custBefore).toBeCloseTo(
        totalFare,
      );
      expect(drvBefore - (await balance(WalletOwnerType.DRIVER, driverId))).toBeCloseTo(earning);

      const refundEntries = await prisma.walletLedgerEntry.count({
        where: {
          wallet: { ownerType: WalletOwnerType.CUSTOMER, ownerId: customerId },
          referenceType: 'ride_refund',
          referenceId: ride.id,
        },
      });
      expect(refundEntries).toBe(1);
    });

    it('D4-8: a refunded ride transitions to RidePaymentStatus.REFUNDED', async () => {
      if (!databaseAvailable) return;
      const ride = await settleCashRide(500);
      await service.refundRide('admin-user', ride.id, 'state check', {});
      expect((await prisma.ride.findUniqueOrThrow({ where: { id: ride.id } })).paymentStatus).toBe(
        'REFUNDED',
      );
    });

    it('D4-9: refunding emits the RIDE_REFUNDED event with the customer and ride ids', async () => {
      if (!databaseAvailable) return;
      const ride = await settleWalletRide(900);
      const emitSpy = jest.spyOn(eventBus, 'emit');
      await service.refundRide('admin-user', ride.id, 'event check', {});
      expect(emitSpy).toHaveBeenCalledWith(
        DOMAIN_EVENTS.RIDE_REFUNDED,
        expect.objectContaining({ rideId: ride.id, customerId }),
      );
      emitSpy.mockRestore();
    });

    it('D4-10: a failure mid-refund leaves the ride PAID and a retry converges without double movement', async () => {
      if (!databaseAvailable) return;
      const totalFare = 1400;
      const ride = await settleWalletRide(totalFare);
      const custBefore = await balance(WalletOwnerType.CUSTOMER, customerId);

      // Force the guarded REFUNDED transition to fail once, after money moves ran.
      const spy = jest
        .spyOn(prisma.ride, 'updateMany')
        .mockRejectedValueOnce(new Error('simulated failure during REFUNDED transition'));
      await expect(service.refundRide('admin-user', ride.id, 'boom', {})).rejects.toThrow(
        'simulated failure during REFUNDED transition',
      );
      spy.mockRestore();

      // The ride is not left half-settled — the transition never committed.
      expect((await prisma.ride.findUniqueOrThrow({ where: { id: ride.id } })).paymentStatus).toBe(
        'PAID',
      );

      // Retry converges to REFUNDED, crediting the customer exactly once.
      const refunded = await service.refundRide('admin-user', ride.id, 'retry', {});
      expect(refunded.paymentStatus).toBe('REFUNDED');
      expect((await balance(WalletOwnerType.CUSTOMER, customerId)) - custBefore).toBeCloseTo(
        totalFare,
      );

      const refundEntries = await prisma.walletLedgerEntry.count({
        where: {
          wallet: { ownerType: WalletOwnerType.CUSTOMER, ownerId: customerId },
          referenceType: 'ride_refund',
          referenceId: ride.id,
        },
      });
      expect(refundEntries).toBe(1);
    });
  });

  describe('Ops-configurable platform commission rate (launch: 10%, adjustable)', () => {
    async function setPlatformRate(rate: number): Promise<void> {
      await prisma.platformCommissionSetting.upsert({
        where: { id: PLATFORM_COMMISSION_SETTING_ID },
        create: { id: PLATFORM_COMMISSION_SETTING_ID, commissionRate: rate },
        update: { commissionRate: rate },
      });
    }

    afterEach(async () => {
      if (!databaseAvailable) return;
      // Restore the shared singleton to its seed-default (10%) so the rest of
      // this file — and other suites — settle at the default rate.
      await prisma.platformCommissionSetting.deleteMany({});
    });

    it('settles at the default 10% when the rate has never been changed', async () => {
      if (!databaseAvailable) return;
      const ride = await createCompletedRide(1000);
      await service.initiatePayment(customerId, ride.id, 'CASH', undefined, {});
      await service.confirmCash(driverId, ride.id, {});
      const settled = await prisma.ride.findUniqueOrThrow({ where: { id: ride.id } });
      expect(Number(settled.platformCommission)).toBeCloseTo(100);
      expect(Number(settled.platformCommissionRate)).toBeCloseTo(0.1);
      expect(Number(settled.driverEarning)).toBeCloseTo(900);
    });

    it('settlement uses the active configured rate and snapshots it onto the ride', async () => {
      if (!databaseAvailable) return;
      await setPlatformRate(0.2);
      const ride = await createCompletedRide(1000);
      await service.initiatePayment(customerId, ride.id, 'CASH', undefined, {});
      await service.confirmCash(driverId, ride.id, {});
      const settled = await prisma.ride.findUniqueOrThrow({ where: { id: ride.id } });
      expect(Number(settled.platformCommission)).toBeCloseTo(200);
      expect(Number(settled.platformCommissionRate)).toBeCloseTo(0.2);
      expect(Number(settled.driverEarning)).toBeCloseTo(800);
    });

    it('a later rate change never rewrites an already-settled ride (historical rate preserved)', async () => {
      if (!databaseAvailable) return;
      // Settle at the default 10%.
      const ride = await createCompletedRide(1000);
      await service.initiatePayment(customerId, ride.id, 'CASH', undefined, {});
      await service.confirmCash(driverId, ride.id, {});

      // Change the rate afterwards — the settled ride must be untouched.
      await setPlatformRate(0.5);
      const reread = await prisma.ride.findUniqueOrThrow({ where: { id: ride.id } });
      expect(Number(reread.platformCommission)).toBeCloseTo(100);
      expect(Number(reread.platformCommissionRate)).toBeCloseTo(0.1);
    });

    it('refund reverses the historical settled commission, not the current rate', async () => {
      if (!databaseAvailable) return;
      // Settle a CASH ride at 20%: commission 200 accrues to the driver account.
      await setPlatformRate(0.2);
      const ride = await createCompletedRide(1000);
      await service.initiatePayment(customerId, ride.id, 'CASH', undefined, {});
      await service.confirmCash(driverId, ride.id, {});
      const outstandingAfterSettle = Number(
        (await commissionAccounts.getOrCreateAccount('DRIVER', driverId)).outstandingBalance,
      );
      expect(outstandingAfterSettle).toBeCloseTo(200);

      // Change the rate to 50% BEFORE refunding — the refund must reverse the
      // historical 200 (fully clearing the account), not 500.
      await setPlatformRate(0.5);
      const refunded = await service.refundRide('admin-user', ride.id, 'historical refund', {});
      expect(refunded.paymentStatus).toBe('REFUNDED');
      expect(
        Number(
          (await commissionAccounts.getOrCreateAccount('DRIVER', driverId)).outstandingBalance,
        ),
      ).toBeCloseTo(0);
    });
  });

  describe('DPX-PROMO-FUNDING — DrippleX funds its own coupons, not the driver', () => {
    const RATE = RIDE_PLATFORM_COMMISSION_RATE; // 10%

    const balance = async (ownerType: WalletOwnerType, ownerId: string): Promise<number> =>
      (await walletService.getWallet(ownerType, ownerId)).availableBalance;

    /** The platform pays out more than it captures on a discounted ride, so it
     * needs a float. Funding it explicitly keeps these tests independent of
     * whatever commission earlier specs happened to leave behind. */
    async function fundPlatform(amount: number): Promise<void> {
      await walletService.credit({
        ownerType: WalletOwnerType.PLATFORM,
        ownerId: PLATFORM_WALLET_OWNER_ID,
        amount,
        description: 'promo float for test',
      });
    }

    async function settleWalletRideWithCoupon(
      charged: number,
      promoDiscount: number,
    ): Promise<Ride> {
      await walletService.credit({
        ownerType: WalletOwnerType.CUSTOMER,
        ownerId: customerId,
        amount: charged,
        description: 'top-up for coupon ride',
      });
      const ride = await createCompletedRide(charged, promoDiscount);
      await service.initiatePayment(customerId, ride.id, 'WALLET', undefined, {});
      return await prisma.ride.findUniqueOrThrow({ where: { id: ride.id } });
    }

    async function settleCashRideWithCoupon(charged: number, promoDiscount: number): Promise<Ride> {
      const ride = await createCompletedRide(charged, promoDiscount);
      await service.initiatePayment(customerId, ride.id, 'CASH', undefined, {});
      await service.confirmCash(driverId, ride.id, {});
      return await prisma.ride.findUniqueOrThrow({ where: { id: ride.id } });
    }

    it('PF-1: the driver is paid on the gross fare — a coupon does not reduce their earning', async () => {
      if (!databaseAvailable) return;
      // ₦4,500 charged after a ₦500 coupon: gross ₦5,000.
      await fundPlatform(2000);
      const ride = await settleWalletRideWithCoupon(4500, 500);

      // Gross 5000, commission 500, driver 4500 — exactly what an undiscounted
      // ₦5,000 ride would pay. Before this change the driver got 90% of 4500 = 4050.
      expect(Number(ride.platformCommission)).toBeCloseTo(500);
      expect(Number(ride.driverEarning)).toBeCloseTo(4500);
      expect(Number(ride.driverEarning)).toBeGreaterThan(4500 * (1 - RATE));
    });

    it('PF-2: the platform, not the driver, absorbs the discount', async () => {
      if (!databaseAvailable) return;
      await fundPlatform(2000);
      const platformBefore = await balance(WalletOwnerType.PLATFORM, PLATFORM_WALLET_OWNER_ID);
      const driverBefore = await balance(WalletOwnerType.DRIVER, driverId);

      const ride = await settleWalletRideWithCoupon(4500, 500);

      // Platform captured 4500 and paid out 4500: net zero. Its entire ₦500
      // commission went into funding the coupon.
      expect(
        (await balance(WalletOwnerType.PLATFORM, PLATFORM_WALLET_OWNER_ID)) - platformBefore,
      ).toBeCloseTo(0);
      expect((await balance(WalletOwnerType.DRIVER, driverId)) - driverBefore).toBeCloseTo(
        Number(ride.driverEarning),
      );
    });

    it('PF-3: a discount larger than the commission is funded out of the platform float', async () => {
      if (!databaseAvailable) return;
      // ₦1,000 coupon on a ₦5,000 gross fare: commission is only ₦500, so the
      // platform is ₦500 out of pocket. This is the common case at a 10% rate.
      await fundPlatform(2000);
      const platformBefore = await balance(WalletOwnerType.PLATFORM, PLATFORM_WALLET_OWNER_ID);

      const ride = await settleWalletRideWithCoupon(4000, 1000);

      expect(Number(ride.driverEarning)).toBeCloseTo(4500);
      expect(
        (await balance(WalletOwnerType.PLATFORM, PLATFORM_WALLET_OWNER_ID)) - platformBefore,
      ).toBeCloseTo(-500);
    });

    it('PF-4: a cash driver is made whole for the coupon they never collected', async () => {
      if (!databaseAvailable) return;
      await fundPlatform(2000);
      const driverBefore = await balance(WalletOwnerType.DRIVER, driverId);
      const outstandingBefore = Number(
        (await commissionAccounts.getOrCreateAccount('DRIVER', driverId)).outstandingBalance,
      );

      // Driver is handed ₦4,500 in cash; gross was ₦5,000.
      const ride = await settleCashRideWithCoupon(4500, 500);

      // Commission accrues on the gross, and the ₦500 they were short in cash
      // arrives as a real wallet credit.
      expect(Number(ride.platformCommission)).toBeCloseTo(500);
      expect(
        Number(
          (await commissionAccounts.getOrCreateAccount('DRIVER', driverId)).outstandingBalance,
        ) - outstandingBefore,
      ).toBeCloseTo(500);
      expect((await balance(WalletOwnerType.DRIVER, driverId)) - driverBefore).toBeCloseTo(500);
    });

    it('PF-5: cash and wallet drivers end up identically paid for the same trip', async () => {
      if (!databaseAvailable) return;
      await fundPlatform(4000);

      const cashRide = await settleCashRideWithCoupon(4500, 500);
      // Cash driver's net = cash held + promo credit − commission owed.
      const cashNet = 4500 + Number(cashRide.promoDiscount) - Number(cashRide.platformCommission);

      const walletRide = await settleWalletRideWithCoupon(4500, 500);
      expect(cashNet).toBeCloseTo(Number(walletRide.driverEarning));
    });

    it('PF-6: a ride with no coupon is completely unaffected', async () => {
      if (!databaseAvailable) return;
      const ride = await settleWalletRideWithCoupon(1000, 0);

      expect(Number(ride.platformCommission)).toBeCloseTo(100);
      expect(Number(ride.driverEarning)).toBeCloseTo(900);

      // No promo ledger entries are written at all for an undiscounted ride.
      const promoEntries = await prisma.walletLedgerEntry.count({
        where: { referenceId: ride.id, referenceType: 'ride_promo_funding' },
      });
      expect(promoEntries).toBe(0);
    });

    it('PF-7: refunding a cash ride reclaims the promotion funding from the driver', async () => {
      if (!databaseAvailable) return;
      await fundPlatform(2000);
      const ride = await settleCashRideWithCoupon(4500, 500);
      const driverAfterSettle = await balance(WalletOwnerType.DRIVER, driverId);

      const refunded = await service.refundRide('admin-user', ride.id, 'promo refund', {});

      expect(refunded.paymentStatus).toBe('REFUNDED');
      // The ₦500 promotion credit goes back; the driver keeps nothing from a
      // refunded ride.
      expect(driverAfterSettle - (await balance(WalletOwnerType.DRIVER, driverId))).toBeCloseTo(
        500,
      );
      // And the commission accrued on the gross is fully reversed.
      expect(
        Number(
          (await commissionAccounts.getOrCreateAccount('DRIVER', driverId)).outstandingBalance,
        ),
      ).toBeCloseTo(0);
    });

    it('PF-8: funding a promotion is exactly-once under a duplicate cash confirmation', async () => {
      if (!databaseAvailable) return;
      await fundPlatform(2000);
      const driverBefore = await balance(WalletOwnerType.DRIVER, driverId);
      const ride = await createCompletedRide(4500, 500);
      await service.initiatePayment(customerId, ride.id, 'CASH', undefined, {});

      await service.confirmCash(driverId, ride.id, {});
      await expect(service.confirmCash(driverId, ride.id, {})).rejects.toThrow();

      // Credited once, not twice.
      expect((await balance(WalletOwnerType.DRIVER, driverId)) - driverBefore).toBeCloseTo(500);
      const promoEntries = await prisma.walletLedgerEntry.count({
        where: {
          referenceId: ride.id,
          referenceType: 'ride_promo_funding',
          wallet: { ownerType: WalletOwnerType.DRIVER, ownerId: driverId },
        },
      });
      expect(promoEntries).toBe(1);
    });

    it('PF-9: refunding a wallet ride with a coupon returns the platform to where it started', async () => {
      if (!databaseAvailable) return;
      await fundPlatform(2000);
      const platformBefore = await balance(WalletOwnerType.PLATFORM, PLATFORM_WALLET_OWNER_ID);
      const ride = await settleWalletRideWithCoupon(4000, 1000);

      await service.refundRide('admin-user', ride.id, 'coupon ride refund', {});

      // Settlement cost the platform ₦500; the refund recovers exactly that.
      expect(
        (await balance(WalletOwnerType.PLATFORM, PLATFORM_WALLET_OWNER_ID)) - platformBefore,
      ).toBeCloseTo(0);
    });
  });
});
