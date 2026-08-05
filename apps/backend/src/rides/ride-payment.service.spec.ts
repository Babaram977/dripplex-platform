import { randomUUID } from 'node:crypto';

import { PrismaClient, WalletOwnerType } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { CommercialCreditSettingsService } from '../commercial/commercial-credit-settings.service';
import { CommissionAccountService } from '../commercial/commission-account.service';
import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../events/domain-events';
import { PLATFORM_WALLET_OWNER_ID } from '../wallet/wallet.constants';
import { WalletService } from '../wallet/wallet.service';

import { RidePaymentService } from './ride-payment.service';
import { RIDE_PLATFORM_COMMISSION_RATE } from './ride.constants';

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

    paystackAdapter = fakeAdapter('PAYSTACK');
    const flutterwaveAdapter = fakeAdapter('FLUTTERWAVE');
    const opayAdapter = fakeAdapter('OPAY');

    eventBus = new DomainEventBus();
    const commercialCreditSettings = new CommercialCreditSettingsService(prisma, auditService);
    commissionAccounts = new CommissionAccountService(
      prisma,
      auditService,
      commercialCreditSettings,
    );
    service = new RidePaymentService(
      prisma,
      walletService,
      auditService,
      notifications,
      events,
      [paystackAdapter, flutterwaveAdapter, opayAdapter],
      eventBus,
      commissionAccounts,
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

  async function createCompletedRide(totalFare = 1000): Promise<Ride> {
    const ride = await prisma.ride.create({
      data: {
        customerId,
        driverId,
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
    expect(driverWallet.availableBalance).toBeCloseTo(850);
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
});
