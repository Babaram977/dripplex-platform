import { randomUUID } from 'node:crypto';

import { CommissionOwnerType, PrismaClient, WalletOwnerType } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { DomainEventBus } from '../events/domain-event-bus';
import { MerchantCommissionSettingsService } from '../orders/merchant-commission-settings.service';
import { MerchantSettlementService } from '../orders/merchant-settlement.service';
import { MERCHANT_COMMISSION_SETTING_ID } from '../orders/order.constants';
import { RidePaymentService } from '../rides/ride-payment.service';
import { PLATFORM_WALLET_OWNER_ID } from '../wallet/wallet.constants';
import { WalletService } from '../wallet/wallet.service';

import { CommercialCreditSettingsService } from './commercial-credit-settings.service';
import {
  COMMISSION_AUTOMATIC_DEDUCTION_REFERENCE_TYPE,
  DEFAULT_PLATFORM_COMMISSION_RATE,
} from './commercial.constants';
import { CommissionAccountService } from './commission-account.service';
import { PlatformCommissionSettingsService } from './platform-commission-settings.service';

// Ride settlement uses the Ops-configurable platform commission (default 10%);
// this lifecycle exercises the default rate.
const RIDE_PLATFORM_COMMISSION_RATE = DEFAULT_PLATFORM_COMMISSION_RATE;

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { NotificationService } from '../notifications/notification.service';
import type { PaymentProviderAdapter } from '../payments/providers/payment-provider.adapter';
import type { PrismaService } from '../prisma/prisma.service';
import type { RideEventsPublisher } from '../rides/ride-events.publisher';
import type { PaymentProvider, Ride } from '@prisma/client';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex_dev?schema=public';

const ADMIN_ID = '99999999-9999-9999-9999-999999999999';

function fakeAdapter(provider: PaymentProvider): jest.Mocked<PaymentProviderAdapter> {
  return {
    provider,
    initializePayment: jest.fn(),
    verifyPayment: jest.fn(),
    handleWebhook: jest.fn(),
  };
}

/**
 * DPX-COMMERCIAL-001 Slice 6 — End-to-End Verification, per the
 * founder's locked completion-slice scope. Every individual accrual /
 * deduction / exactly-once / concurrency primitive is already proven in
 * Slices 1-5's own specs (merchant-settlement.service.spec.ts,
 * ride-payment.service.spec.ts, rides.service.spec.ts,
 * commission-account.service.spec.ts,
 * commercial-reconciliation.e2e.spec.ts). This file's job is narrower
 * and additive: prove the *cumulative*, cross-payment-method behavior a
 * real merchant or driver actually experiences over time — mode B
 * accrual, mode C (Cash) accrual, blocking, an admin-manual payment,
 * then a later mode A settlement whose automatic deduction and credit-
 * limit unblocking all land on the *same* account and reconcile
 * together. No individual mechanism here is new; the combination,
 * against real Postgres, is.
 */
describe('DPX-COMMERCIAL-001 Slice 6 — Full Commercial Lifecycle E2E', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let auditService: AuditService;
  let walletService: WalletService;
  let commercialCreditSettings: CommercialCreditSettingsService;
  let commissionAccounts: CommissionAccountService;
  let merchantSettlement: MerchantSettlementService;
  let ridePayment: RidePaymentService;

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
    auditService = new AuditService(auditLogRepository);
    walletService = new WalletService(prisma, auditService, new DomainEventBus());
    commercialCreditSettings = new CommercialCreditSettingsService(prisma, auditService);
    commissionAccounts = new CommissionAccountService(
      prisma,
      auditService,
      commercialCreditSettings,
    );
    const commissionSettings = new MerchantCommissionSettingsService(prisma, auditService);
    merchantSettlement = new MerchantSettlementService(
      prisma,
      walletService,
      auditService,
      commissionSettings,
      commissionAccounts,
    );

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
    ridePayment = new RidePaymentService(
      prisma,
      walletService,
      auditService,
      notifications,
      events,
      // OPay is safe-disabled from order payment (DPX-DRIVER-018) — no OPAY adapter.
      [fakeAdapter('PAYSTACK'), fakeAdapter('FLUTTERWAVE')],
      new DomainEventBus(),
      commissionAccounts,
      new PlatformCommissionSettingsService(prisma, auditService),
    );

    // Reset the singleton commission settings to their known 10% defaults
    // (guards against cross-file contamination of these shared singleton rows).
    await prisma.merchantCommissionSetting
      .delete({ where: { id: MERCHANT_COMMISSION_SETTING_ID } })
      .catch(() => undefined);
    await prisma.platformCommissionSetting.deleteMany({}).catch(() => undefined);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Merchant full lifecycle — mode B, Cash, blocking, manual payment, mode A auto-deduction', () => {
    let customerId: string;
    let merchantUserId: string;
    let merchantProfileId: string;

    beforeAll(async () => {
      if (!databaseAvailable) return;
      const customer = await prisma.user.create({
        data: {
          email: `lifecycle-customer-${randomUUID()}@dripplex.test`,
          passwordHash: 'not-a-real-hash',
          firstName: 'Lifecycle',
          lastName: 'Customer',
        },
      });
      customerId = customer.id;

      const merchantUser = await prisma.user.create({
        data: {
          email: `lifecycle-merchant-${randomUUID()}@dripplex.test`,
          passwordHash: 'not-a-real-hash',
          firstName: 'Lifecycle',
          lastName: 'Merchant',
        },
      });
      merchantUserId = merchantUser.id;

      const merchantProfile = await prisma.merchantProfile.create({
        data: { userId: merchantUserId, status: 'APPROVED', isApproved: true },
      });
      merchantProfileId = merchantProfile.id;

      // A round ₦15,000 credit limit, distinct from Slice 5's
      // reconciliation doc's ₦20,000 merchant example — deliberately a
      // different number so this isn't just a copy of that scenario.
      await commercialCreditSettings.update(CommissionOwnerType.MERCHANT, 15_000, ADMIN_ID, {});
    });

    afterAll(async () => {
      if (!databaseAvailable) return;
      await prisma.orderSettlement.deleteMany({ where: { merchantId: merchantProfileId } });
      await prisma.order.deleteMany({ where: { merchantId: merchantProfileId } });
      await prisma.walletLedgerEntry.deleteMany({
        where: { wallet: { ownerType: 'MERCHANT', ownerId: merchantUserId } },
      });
      await prisma.wallet.deleteMany({ where: { ownerType: 'MERCHANT', ownerId: merchantUserId } });
      await prisma.commissionLedgerEntry.deleteMany({
        where: { account: { ownerType: 'MERCHANT', ownerId: merchantUserId } },
      });
      await prisma.commissionAccount.deleteMany({
        where: { ownerType: 'MERCHANT', ownerId: merchantUserId },
      });
      await prisma.merchantProfile
        .delete({ where: { id: merchantProfileId } })
        .catch(() => undefined);
      await prisma.user.delete({ where: { id: merchantUserId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: customerId } }).catch(() => undefined);
    });

    async function createOrder(overrides: {
      subtotal: number;
      total: number;
      paymentMethod: 'CASH' | 'WALLET' | 'MERCHANT_DIRECT';
      paymentStatus?: 'PAID' | 'PENDING';
    }): Promise<{ id: string }> {
      return await prisma.order.create({
        data: {
          customerId,
          merchantId: merchantProfileId,
          orderNumber: `DPX-LIFECYCLE-${randomUUID().slice(0, 20)}`,
          fulfillmentType: 'DELIVERY',
          subtotal: overrides.subtotal,
          total: overrides.total,
          currency: 'NGN',
          status: 'COMPLETED',
          paymentStatus: overrides.paymentStatus ?? 'PAID',
          paymentMethod: overrides.paymentMethod,
        },
        select: { id: true },
      });
    }

    it('walks the entire merchant commercial lifecycle end-to-end', async () => {
      if (!databaseAvailable) return;

      // Step 1 — Marketplace Mode B (Pay to Merchant): commission
      // accrues as a liability, nothing credited to Wallet.
      const modeBOrder = await createOrder({
        subtotal: 90_000,
        total: 90_000,
        paymentMethod: 'MERCHANT_DIRECT',
        paymentStatus: 'PENDING',
      });
      const modeBSettlement = await merchantSettlement.settleOrder(modeBOrder.id);
      expect(Number(modeBSettlement?.commissionAmount)).toBe(9_000);
      expect(modeBSettlement?.walletLedgerEntryId).toBeNull();

      let account = await commissionAccounts.getOrCreateAccount(
        CommissionOwnerType.MERCHANT,
        merchantUserId,
      );
      expect(Number(account.outstandingBalance)).toBe(9_000);
      expect(account.blocked).toBe(false);

      // Step 2 — Marketplace Cash on Delivery: same accrual mechanism as
      // mode B, pushes outstanding (16,000) past the 15,000 limit.
      const codOrder = await createOrder({
        subtotal: 70_000,
        total: 70_000,
        paymentMethod: 'CASH',
      });
      const codSettlement = await merchantSettlement.settleOrder(codOrder.id);
      expect(Number(codSettlement?.commissionAmount)).toBe(7_000);
      expect(codSettlement?.walletLedgerEntryId).toBeNull();

      account = await commissionAccounts.getOrCreateAccount(
        CommissionOwnerType.MERCHANT,
        merchantUserId,
      );
      expect(Number(account.outstandingBalance)).toBe(16_000);
      expect(account.blocked).toBe(true);

      // Step 3 — Manual payment recording (admin action): brings the
      // balance back under the limit.
      account = await commissionAccounts.recordPayment({
        ownerType: CommissionOwnerType.MERCHANT,
        ownerId: merchantUserId,
        amount: 10_000,
        description: 'Manual bank transfer received',
        recordedBy: ADMIN_ID,
        context: { userId: ADMIN_ID },
      });
      expect(Number(account.outstandingBalance)).toBe(6_000);
      expect(account.blocked).toBe(false);

      // Step 4 — Marketplace Mode A (escrow/gateway): commission is
      // captured directly (net-of-commission Wallet credit), and
      // automatic deduction pays down the remaining 6,000 debt before
      // anything reaches Wallet.
      const modeAOrder = await createOrder({
        subtotal: 200_000,
        total: 220_000,
        paymentMethod: 'WALLET',
      });
      const walletBefore = await walletService.getWallet(WalletOwnerType.MERCHANT, merchantUserId);
      const modeASettlement = await merchantSettlement.settleOrder(modeAOrder.id);

      // gross 200,000, commission 20,000, theoretical merchantAmount
      // 180,000; 6,000 outstanding deducted -> net 174,000 credited.
      expect(Number(modeASettlement?.commissionAmount)).toBe(20_000);
      expect(Number(modeASettlement?.merchantAmount)).toBe(174_000);
      const walletAfter = await walletService.getWallet(WalletOwnerType.MERCHANT, merchantUserId);
      expect(walletAfter.availableBalance).toBe(walletBefore.availableBalance + 174_000);

      const deductionLedgerCount = await prisma.commissionLedgerEntry.count({
        where: {
          account: { ownerType: 'MERCHANT', ownerId: merchantUserId },
          referenceType: COMMISSION_AUTOMATIC_DEDUCTION_REFERENCE_TYPE,
          referenceId: modeAOrder.id,
        },
      });
      expect(deductionLedgerCount).toBe(1);

      account = await commissionAccounts.getOrCreateAccount(
        CommissionOwnerType.MERCHANT,
        merchantUserId,
      );
      expect(Number(account.outstandingBalance)).toBe(0);
      expect(account.blocked).toBe(false);

      // Step 5 — Ledger integrity: every ledger entry across mode B,
      // COD, the manual payment, and the automatic deduction reconciles
      // exactly against the final account balance.
      const { items: ledger } = await commissionAccounts.listLedgerEntries(
        CommissionOwnerType.MERCHANT,
        merchantUserId,
        1,
        100,
      );
      const accrued = ledger
        .filter((entry) => entry.type === 'ACCRUAL')
        .reduce((sum, entry) => sum + Number(entry.amount), 0);
      const paid = ledger
        .filter((entry) => entry.type === 'PAYMENT')
        .reduce((sum, entry) => sum + Number(entry.amount), 0);
      expect(accrued).toBe(16_000); // 9,000 (mode B) + 7,000 (COD)
      expect(paid).toBe(16_000); // 10,000 (manual) + 6,000 (auto-deduction)
      expect(accrued - paid).toBe(Number(account.outstandingBalance));
      expect(ledger).toHaveLength(4);
    });
  });

  describe('Driver full lifecycle — Ride Cash, blocking, manual payment', () => {
    let customerId: string;
    let driverId: string;
    const createdRideIds: string[] = [];

    async function createCompletedRide(totalFare: number): Promise<Ride> {
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
          baseFare: totalFare * 0.3,
          distanceFare: totalFare * 0.5,
          timeFare: totalFare * 0.2,
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

    beforeAll(async () => {
      if (!databaseAvailable) return;
      const customer = await prisma.user.create({
        data: {
          email: `lifecycle-ride-customer-${randomUUID()}@dripplex.test`,
          passwordHash: 'not-a-real-hash',
          firstName: 'Lifecycle',
          lastName: 'Rider',
        },
      });
      customerId = customer.id;

      const driver = await prisma.user.create({
        data: {
          email: `lifecycle-driver-${randomUUID()}@dripplex.test`,
          passwordHash: 'not-a-real-hash',
          firstName: 'Lifecycle',
          lastName: 'Driver',
        },
      });
      driverId = driver.id;

      // Explicit limit, distinct from the DEFAULT_DRIVER_CREDIT_LIMIT
      // seed-fallback path already covered by Slice 5's reconciliation
      // doc — this scenario proves an admin-overridden limit works
      // identically.
      await commercialCreditSettings.update(CommissionOwnerType.DRIVER, 12_000, ADMIN_ID, {});
    });

    afterAll(async () => {
      if (!databaseAvailable) return;
      await prisma.ridePaymentTransaction.deleteMany({ where: { rideId: { in: createdRideIds } } });
      await prisma.ride.deleteMany({ where: { id: { in: createdRideIds } } });
      await prisma.walletLedgerEntry.deleteMany({
        where: { wallet: { ownerId: { in: [driverId, customerId, PLATFORM_WALLET_OWNER_ID] } } },
      });
      await prisma.wallet
        .deleteMany({
          where: { ownerId: { in: [driverId, customerId, PLATFORM_WALLET_OWNER_ID] } },
        })
        .catch(() => undefined);
      await prisma.commissionLedgerEntry.deleteMany({
        where: { account: { ownerType: 'DRIVER', ownerId: driverId } },
      });
      await prisma.commissionAccount.deleteMany({
        where: { ownerType: 'DRIVER', ownerId: driverId },
      });
      await prisma.user.deleteMany({ where: { id: { in: [driverId, customerId] } } });
    });

    it('walks the entire driver commercial lifecycle end-to-end', async () => {
      if (!databaseAvailable) return;

      // Step 1 — Ride Cash: two cash rides, commission accrues onto the
      // driver's CommissionAccount instead of staying audit-only.
      // Fares chosen so commission crosses the 12,000 credit limit at the
      // launch 10% rate (75,000 * 0.10 = 7,500), keeping the blocking narrative.
      const rideA = await createCompletedRide(75_000); // commission 7,500
      await ridePayment.initiatePayment(customerId, rideA.id, 'CASH', undefined, {});
      const confirmA = await ridePayment.confirmCash(driverId, rideA.id, {});
      expect(confirmA.platformCommission).toBeCloseTo(75_000 * RIDE_PLATFORM_COMMISSION_RATE);

      let account = await commissionAccounts.getOrCreateAccount(
        CommissionOwnerType.DRIVER,
        driverId,
      );
      expect(Number(account.outstandingBalance)).toBeCloseTo(7_500);
      expect(account.blocked).toBe(false);

      const rideB = await createCompletedRide(60_000); // commission 6,000
      await ridePayment.initiatePayment(customerId, rideB.id, 'CASH', undefined, {});
      const confirmB = await ridePayment.confirmCash(driverId, rideB.id, {});
      expect(confirmB.platformCommission).toBeCloseTo(60_000 * RIDE_PLATFORM_COMMISSION_RATE);

      // Step 2 — Credit-limit / blocking: 13,500 outstanding exceeds the
      // 12,000 limit.
      account = await commissionAccounts.getOrCreateAccount(CommissionOwnerType.DRIVER, driverId);
      expect(Number(account.outstandingBalance)).toBeCloseTo(13_500);
      expect(account.blocked).toBe(true);

      // Step 3 — Manual payment recording (admin action). A partial payment
      // brings the driver back under the limit but does NOT unblock them:
      // founder decision (2026-08-17) is that a blocked driver or rider stays
      // blocked until the balance is zero, so paying just under the ceiling
      // cannot buy another limit's worth of cash work.
      account = await commissionAccounts.recordPayment({
        ownerType: CommissionOwnerType.DRIVER,
        ownerId: driverId,
        amount: 5_000,
        description: 'Manual bank transfer received',
        recordedBy: ADMIN_ID,
        context: { userId: ADMIN_ID },
      });
      expect(Number(account.outstandingBalance)).toBeCloseTo(8_500);
      expect(account.blocked).toBe(true);

      // Settling in full is what releases them.
      account = await commissionAccounts.recordPayment({
        ownerType: CommissionOwnerType.DRIVER,
        ownerId: driverId,
        amount: 8_500,
        description: 'Settled in full',
        recordedBy: ADMIN_ID,
        context: { userId: ADMIN_ID },
      });
      expect(Number(account.outstandingBalance)).toBeCloseTo(0);
      expect(account.blocked).toBe(false);

      // Step 4 — Ledger integrity: both ride accruals plus the manual
      // payment reconcile exactly against the final balance. (Driver
      // going-online enforcement itself — RidesService consulting this
      // same blocked flag — is proven separately in
      // rides.service.spec.ts's own DPX-COMMERCIAL-001 Slice 4 suite;
      // not duplicated here to keep this file's fixtures Ride-payment-
      // scoped.)
      const { items: ledger } = await commissionAccounts.listLedgerEntries(
        CommissionOwnerType.DRIVER,
        driverId,
        1,
        100,
      );
      const accrued = ledger
        .filter((entry) => entry.type === 'ACCRUAL')
        .reduce((sum, entry) => sum + Number(entry.amount), 0);
      const paid = ledger
        .filter((entry) => entry.type === 'PAYMENT')
        .reduce((sum, entry) => sum + Number(entry.amount), 0);
      expect(accrued).toBeCloseTo(13_500);
      // Two payments now: the partial one that did not release them, and the
      // settlement that did.
      expect(paid).toBe(13_500);
      expect(accrued - paid).toBeCloseTo(Number(account.outstandingBalance));
      expect(ledger).toHaveLength(4);
    });
  });
});
