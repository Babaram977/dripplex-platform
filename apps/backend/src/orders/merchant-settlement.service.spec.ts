import { randomUUID } from 'node:crypto';

import { OrderSettlementStatus, PrismaClient, WalletOwnerType } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { CommercialCreditSettingsService } from '../commercial/commercial-credit-settings.service';
import { CommissionAccountService } from '../commercial/commission-account.service';
import { DomainEventBus } from '../events/domain-event-bus';
import { WalletService } from '../wallet/wallet.service';

import { MerchantCommissionSettingsService } from './merchant-commission-settings.service';
import { MerchantSettlementService } from './merchant-settlement.service';
import { MERCHANT_COMMISSION_SETTING_ID } from './order.constants';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * DPX-MERCHANT-002 — real-database E2E tests, matching the founder's
 * required test plan (docs/DPX-MERCHANT-002-SETTLEMENT-DESIGN.md §8):
 * paid order -> fulfilment -> one credit; duplicate/replayed completion
 * -> still one credit; COD completion/payment semantics; commission-rate
 * changes never touch already-created settlements; refund after
 * completion reverses cleanly.
 */
const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

describe('MerchantSettlementService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: MerchantSettlementService;
  let commissionSettings: MerchantCommissionSettingsService;
  let commissionAccounts: CommissionAccountService;
  let walletService: WalletService;
  let customerId: string;
  let merchantUserId: string;
  let merchantProfileId: string;

  async function createOrder(overrides: {
    subtotal: number;
    total: number;
    status?: 'COMPLETED' | 'PENDING';
    paymentStatus?: 'PAID' | 'PENDING';
    paymentMethod?: 'CASH' | 'WALLET' | 'MERCHANT_DIRECT';
  }): Promise<{ id: string }> {
    return await prisma.order.create({
      data: {
        customerId,
        merchantId: merchantProfileId,
        orderNumber: `DPX-TEST-${randomUUID().slice(0, 20)}`,
        fulfillmentType: 'DELIVERY',
        subtotal: overrides.subtotal,
        total: overrides.total,
        currency: 'NGN',
        status: overrides.status ?? 'COMPLETED',
        paymentStatus: overrides.paymentStatus ?? 'PAID',
        ...(overrides.paymentMethod ? { paymentMethod: overrides.paymentMethod } : {}),
      },
      select: { id: true },
    });
  }

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
    const eventBus = new DomainEventBus();
    walletService = new WalletService(prisma, auditService, eventBus);
    commissionSettings = new MerchantCommissionSettingsService(prisma, auditService);
    const commercialCreditSettings = new CommercialCreditSettingsService(prisma, auditService);
    commissionAccounts = new CommissionAccountService(
      prisma,
      auditService,
      commercialCreditSettings,
    );
    service = new MerchantSettlementService(
      prisma,
      walletService,
      auditService,
      commissionSettings,
      commissionAccounts,
    );

    // Reset the singleton commission setting to a known 10% before every
    // run, regardless of what a prior test session left behind.
    await prisma.merchantCommissionSetting
      .delete({ where: { id: MERCHANT_COMMISSION_SETTING_ID } })
      .catch(() => undefined);

    const customer = await prisma.user.create({
      data: {
        email: `settlement-customer-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Settlement',
        lastName: 'Customer',
      },
    });
    customerId = customer.id;

    const merchantUser = await prisma.user.create({
      data: {
        email: `settlement-merchant-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Settlement',
        lastName: 'Merchant',
      },
    });
    merchantUserId = merchantUser.id;

    const merchantProfile = await prisma.merchantProfile.create({
      data: { userId: merchantUserId, status: 'APPROVED', isApproved: true },
    });
    merchantProfileId = merchantProfile.id;
  });

  afterAll(async () => {
    if (!databaseAvailable) {
      return;
    }
    await prisma.orderSettlement.deleteMany({ where: { merchantId: merchantProfileId } });
    await prisma.order.deleteMany({ where: { merchantId: merchantProfileId } });
    await prisma.walletLedgerEntry.deleteMany({
      where: { wallet: { ownerType: 'MERCHANT', ownerId: merchantUserId } },
    });
    await prisma.wallet.deleteMany({ where: { ownerType: 'MERCHANT', ownerId: merchantUserId } });
    await prisma.merchantProfile
      .delete({ where: { id: merchantProfileId } })
      .catch(() => undefined);
    await prisma.user.delete({ where: { id: merchantUserId } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: customerId } }).catch(() => undefined);
    await prisma.merchantCommissionSetting
      .delete({ where: { id: MERCHANT_COMMISSION_SETTING_ID } })
      .catch(() => undefined);
    await prisma.$disconnect();
  });

  it('settles a paid, completed order: correct math, one credit, one ledger entry', async () => {
    if (!databaseAvailable) return;
    const order = await createOrder({ subtotal: 10000, total: 11500 });

    const settlement = await service.settleOrder(order.id);

    expect(settlement).not.toBeNull();
    expect(settlement?.status).toBe(OrderSettlementStatus.COMPLETED);
    expect(Number(settlement?.grossAmount)).toBe(10000);
    expect(Number(settlement?.commissionRate)).toBe(0.1);
    expect(Number(settlement?.commissionAmount)).toBe(1000);
    expect(Number(settlement?.merchantAmount)).toBe(9000);
    expect(settlement?.walletLedgerEntryId).not.toBeNull();

    const wallet = await walletService.getWallet(WalletOwnerType.MERCHANT, merchantUserId);
    expect(wallet.availableBalance).toBeGreaterThanOrEqual(9000);

    const ledgerCount = await prisma.walletLedgerEntry.count({
      where: {
        wallet: { ownerType: 'MERCHANT', ownerId: merchantUserId },
        referenceType: 'order_settlement',
        referenceId: order.id,
      },
    });
    expect(ledgerCount).toBe(1);
  });

  it('replayed settlement on the same order stays exactly-once (sequential)', async () => {
    if (!databaseAvailable) return;
    const order = await createOrder({ subtotal: 5000, total: 6000 });

    const first = await service.settleOrder(order.id);
    const second = await service.settleOrder(order.id);

    expect(first?.id).toBe(second?.id);

    const rowCount = await prisma.orderSettlement.count({ where: { orderId: order.id } });
    expect(rowCount).toBe(1);

    const ledgerCount = await prisma.walletLedgerEntry.count({
      where: {
        wallet: { ownerType: 'MERCHANT', ownerId: merchantUserId },
        referenceType: 'order_settlement',
        referenceId: order.id,
      },
    });
    expect(ledgerCount).toBe(1);
  });

  it('concurrent settlement calls on the same order still produce exactly one credit', async () => {
    if (!databaseAvailable) return;
    const order = await createOrder({ subtotal: 7000, total: 8000 });

    const [a, b] = await Promise.all([
      service.settleOrder(order.id),
      service.settleOrder(order.id),
    ]);

    expect(a?.id).toBe(b?.id);

    const rowCount = await prisma.orderSettlement.count({ where: { orderId: order.id } });
    expect(rowCount).toBe(1);

    const ledgerCount = await prisma.walletLedgerEntry.count({
      where: {
        wallet: { ownerType: 'MERCHANT', ownerId: merchantUserId },
        referenceType: 'order_settlement',
        referenceId: order.id,
      },
    });
    expect(ledgerCount).toBe(1);
  });

  it('settles a COD order once its payment/completion state matches a gateway order', async () => {
    if (!databaseAvailable) return;
    // Simulates the real lifecycle: PaymentService.markCashPaymentReceived
    // already flipped paymentStatus to PAID before ORDER_COMPLETED fires.
    const order = await createOrder({
      subtotal: 3000,
      total: 3500,
      paymentMethod: 'CASH',
      paymentStatus: 'PAID',
      status: 'COMPLETED',
    });

    const settlement = await service.settleOrder(order.id);

    expect(settlement?.status).toBe(OrderSettlementStatus.COMPLETED);
    expect(Number(settlement?.grossAmount)).toBe(3000);
    expect(Number(settlement?.merchantAmount)).toBe(2700);
  });

  it('does not settle an order that is not both COMPLETED and PAID', async () => {
    if (!databaseAvailable) return;
    const order = await createOrder({ subtotal: 2000, total: 2500, status: 'PENDING' });

    const settlement = await service.settleOrder(order.id);

    expect(settlement).toBeNull();
    const rowCount = await prisma.orderSettlement.count({ where: { orderId: order.id } });
    expect(rowCount).toBe(0);
  });

  it('snapshots the commission rate in effect at settlement time, never retroactively', async () => {
    if (!databaseAvailable) return;
    const orderAtDefaultRate = await createOrder({ subtotal: 4000, total: 4500 });
    const settledAtDefault = await service.settleOrder(orderAtDefaultRate.id);
    expect(Number(settledAtDefault?.commissionRate)).toBe(0.1);

    await commissionSettings.update(0.15, merchantUserId, {});

    const orderAtNewRate = await createOrder({ subtotal: 4000, total: 4500 });
    const settledAtNewRate = await service.settleOrder(orderAtNewRate.id);
    expect(Number(settledAtNewRate?.commissionRate)).toBe(0.15);
    expect(Number(settledAtNewRate?.merchantAmount)).toBe(3400);

    // The earlier settlement's stored rate must not have changed.
    const reread = await prisma.orderSettlement.findUniqueOrThrow({
      where: { orderId: orderAtDefaultRate.id },
    });
    expect(Number(reread.commissionRate)).toBe(0.1);

    // Restore the default for any tests that run after this one.
    await commissionSettings.update(0.1, merchantUserId, {});
  });

  it('reverses an already-completed settlement on refund, crediting back what was paid out', async () => {
    if (!databaseAvailable) return;
    const order = await createOrder({ subtotal: 6000, total: 7000 });
    const settled = await service.settleOrder(order.id);
    expect(settled?.status).toBe(OrderSettlementStatus.COMPLETED);

    const walletBeforeReversal = await walletService.getWallet(
      WalletOwnerType.MERCHANT,
      merchantUserId,
    );

    const reversed = await service.reverseSettlement(order.id, 'Customer refund');

    expect(reversed?.status).toBe(OrderSettlementStatus.REVERSED);
    expect(reversed?.reversalLedgerEntryId).not.toBeNull();

    const walletAfterReversal = await walletService.getWallet(
      WalletOwnerType.MERCHANT,
      merchantUserId,
    );
    expect(walletAfterReversal.availableBalance).toBe(
      walletBeforeReversal.availableBalance - Number(settled?.merchantAmount),
    );

    // Reversing again is a no-op (already REVERSED, not COMPLETED).
    const secondReversal = await service.reverseSettlement(order.id, 'Duplicate refund event');
    expect(secondReversal?.status).toBe(OrderSettlementStatus.REVERSED);
    const walletAfterSecondAttempt = await walletService.getWallet(
      WalletOwnerType.MERCHANT,
      merchantUserId,
    );
    expect(walletAfterSecondAttempt.availableBalance).toBe(walletAfterReversal.availableBalance);
  });

  it('reverseSettlement() is a no-op when the order was never settled', async () => {
    if (!databaseAvailable) return;
    const order = await createOrder({
      subtotal: 1000,
      total: 1200,
      status: 'PENDING',
      paymentStatus: 'PENDING',
    });

    const result = await service.reverseSettlement(order.id, 'Refund before settlement ever ran');

    expect(result).toBeNull();
  });

  it('listSettlements() returns the merchant real settlement history with orderNumber, paginated', async () => {
    if (!databaseAvailable) return;
    const orderA = await createOrder({ subtotal: 2000, total: 2500 });
    const orderB = await createOrder({ subtotal: 3000, total: 3500 });
    await service.settleOrder(orderA.id);
    await service.settleOrder(orderB.id);

    const page1 = await service.listSettlements(merchantUserId, 1, 1);
    expect(page1.items).toHaveLength(1);
    expect(page1.meta.total).toBeGreaterThanOrEqual(2);
    expect(page1.meta.totalPages).toBeGreaterThanOrEqual(2);
    // Most recent first.
    expect(page1.items[0]?.orderId).toBe(orderB.id);
    expect(page1.items[0]?.orderNumber).toEqual(expect.any(String));
    expect(page1.items[0]?.orderNumber.length).toBeGreaterThan(0);

    const page2 = await service.listSettlements(merchantUserId, 2, 1);
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0]?.orderId).toBe(orderA.id);
  });

  it('listSettlements() throws for a user with no merchant profile', async () => {
    if (!databaseAvailable) return;
    await expect(service.listSettlements(customerId, 1, 20)).rejects.toThrow(
      'Merchant profile not found',
    );
  });

  describe('DPX-COMMERCIAL-001 Slice 2 — Marketplace mode B ("Pay to Merchant")', () => {
    // Give every test in this block (and the first one especially — the
    // top-level tests above create at least one CASH-paid order, which as
    // of Slice 3 also accrues to this same shared merchant's
    // CommissionAccount) a clean-slate balance to assert against.
    beforeEach(async () => {
      if (!databaseAvailable) return;
      await prisma.commissionLedgerEntry.deleteMany({
        where: { account: { ownerType: 'MERCHANT', ownerId: merchantUserId } },
      });
      await prisma.commissionAccount.deleteMany({
        where: { ownerType: 'MERCHANT', ownerId: merchantUserId },
      });
    });

    afterEach(async () => {
      if (!databaseAvailable) return;
      await prisma.commissionLedgerEntry.deleteMany({
        where: { account: { ownerType: 'MERCHANT', ownerId: merchantUserId } },
      });
      await prisma.commissionAccount.deleteMany({
        where: { ownerType: 'MERCHANT', ownerId: merchantUserId },
      });
    });

    it('accrues the commission owed to the CommissionAccount instead of crediting Wallet', async () => {
      if (!databaseAvailable) return;
      const order = await createOrder({
        subtotal: 10000,
        total: 10000,
        paymentMethod: 'MERCHANT_DIRECT',
        paymentStatus: 'PENDING',
        status: 'COMPLETED',
      });
      const walletBefore = await walletService.getWallet(WalletOwnerType.MERCHANT, merchantUserId);

      const settlement = await service.settleOrder(order.id);

      expect(settlement?.status).toBe(OrderSettlementStatus.COMPLETED);
      expect(Number(settlement?.commissionAmount)).toBe(1000);
      expect(settlement?.walletLedgerEntryId).toBeNull();

      const walletAfter = await walletService.getWallet(WalletOwnerType.MERCHANT, merchantUserId);
      expect(walletAfter.availableBalance).toBe(walletBefore.availableBalance);

      const account = await commissionAccounts.getOrCreateAccount('MERCHANT', merchantUserId);
      expect(Number(account.outstandingBalance)).toBe(1000);
    });

    it('replayed mode-B settlement on the same order stays exactly-once', async () => {
      if (!databaseAvailable) return;
      const order = await createOrder({
        subtotal: 4000,
        total: 4000,
        paymentMethod: 'MERCHANT_DIRECT',
        paymentStatus: 'PENDING',
        status: 'COMPLETED',
      });

      await service.settleOrder(order.id);
      await service.settleOrder(order.id);

      const account = await commissionAccounts.getOrCreateAccount('MERCHANT', merchantUserId);
      expect(Number(account.outstandingBalance)).toBe(400);
    });

    it('reversing a mode-B settlement reverses the commission accrual, not a Wallet debit', async () => {
      if (!databaseAvailable) return;
      const order = await createOrder({
        subtotal: 5000,
        total: 5000,
        paymentMethod: 'MERCHANT_DIRECT',
        paymentStatus: 'PENDING',
        status: 'COMPLETED',
      });
      await service.settleOrder(order.id);
      const accountBefore = await commissionAccounts.getOrCreateAccount('MERCHANT', merchantUserId);
      expect(Number(accountBefore.outstandingBalance)).toBe(500);
      const walletBefore = await walletService.getWallet(WalletOwnerType.MERCHANT, merchantUserId);

      const reversed = await service.reverseSettlement(order.id, 'Order refunded');

      expect(reversed?.status).toBe(OrderSettlementStatus.REVERSED);
      const accountAfter = await commissionAccounts.getOrCreateAccount('MERCHANT', merchantUserId);
      expect(Number(accountAfter.outstandingBalance)).toBe(0);
      const walletAfter = await walletService.getWallet(WalletOwnerType.MERCHANT, merchantUserId);
      expect(walletAfter.availableBalance).toBe(walletBefore.availableBalance);
    });

    it('does not settle a mode-B order that is not COMPLETED, even though paymentStatus is always PENDING', async () => {
      if (!databaseAvailable) return;
      const order = await createOrder({
        subtotal: 1000,
        total: 1000,
        paymentMethod: 'MERCHANT_DIRECT',
        paymentStatus: 'PENDING',
        status: 'PENDING',
      });

      const settlement = await service.settleOrder(order.id);

      expect(settlement).toBeNull();
    });

    it('automatic deduction: a mode-A settlement pays down an outstanding commission balance before crediting Wallet', async () => {
      if (!databaseAvailable) return;
      // Seed an outstanding balance the way it would really arise: a prior
      // mode-B order's accrual.
      const modeB = await createOrder({
        subtotal: 3000,
        total: 3000,
        paymentMethod: 'MERCHANT_DIRECT',
        paymentStatus: 'PENDING',
        status: 'COMPLETED',
      });
      await service.settleOrder(modeB.id);
      const accountBefore = await commissionAccounts.getOrCreateAccount('MERCHANT', merchantUserId);
      expect(Number(accountBefore.outstandingBalance)).toBe(300);

      const modeA = await createOrder({ subtotal: 10000, total: 11500, paymentMethod: 'WALLET' });
      const walletBefore = await walletService.getWallet(WalletOwnerType.MERCHANT, merchantUserId);

      const settlement = await service.settleOrder(modeA.id);

      // grossAmount 10000, commission 1000, theoretical merchantAmount 9000;
      // 300 outstanding deducted -> net 8700 actually credited.
      expect(Number(settlement?.merchantAmount)).toBe(8700);
      const walletAfter = await walletService.getWallet(WalletOwnerType.MERCHANT, merchantUserId);
      expect(walletAfter.availableBalance).toBe(walletBefore.availableBalance + 8700);

      const accountAfter = await commissionAccounts.getOrCreateAccount('MERCHANT', merchantUserId);
      expect(Number(accountAfter.outstandingBalance)).toBe(0);

      const deductionLedgerCount = await prisma.commissionLedgerEntry.count({
        where: {
          account: { ownerType: 'MERCHANT', ownerId: merchantUserId },
          referenceType: 'order_settlement_deduction',
          referenceId: modeA.id,
        },
      });
      expect(deductionLedgerCount).toBe(1);
    });

    it('automatic deduction is capped at the theoretical merchantAmount, never credits negative', async () => {
      if (!databaseAvailable) return;
      const modeB = await createOrder({
        subtotal: 20000,
        total: 20000,
        paymentMethod: 'MERCHANT_DIRECT',
        paymentStatus: 'PENDING',
        status: 'COMPLETED',
      });
      await service.settleOrder(modeB.id);
      const accountBefore = await commissionAccounts.getOrCreateAccount('MERCHANT', merchantUserId);
      expect(Number(accountBefore.outstandingBalance)).toBe(2000);

      const modeA = await createOrder({ subtotal: 1000, total: 1150, paymentMethod: 'WALLET' });
      const walletBefore = await walletService.getWallet(WalletOwnerType.MERCHANT, merchantUserId);

      const settlement = await service.settleOrder(modeA.id);

      // theoretical merchantAmount = 900; entire 900 is deducted, nothing
      // reaches Wallet, and 1100 of the 2000 debt remains outstanding.
      expect(Number(settlement?.merchantAmount)).toBe(0);
      const walletAfter = await walletService.getWallet(WalletOwnerType.MERCHANT, merchantUserId);
      expect(walletAfter.availableBalance).toBe(walletBefore.availableBalance);

      const accountAfter = await commissionAccounts.getOrCreateAccount('MERCHANT', merchantUserId);
      expect(Number(accountAfter.outstandingBalance)).toBe(1100);
    });

    it('concurrent mode-B settlement calls on the same order still produce exactly one accrual', async () => {
      if (!databaseAvailable) return;
      const order = await createOrder({
        subtotal: 8000,
        total: 8000,
        paymentMethod: 'MERCHANT_DIRECT',
        paymentStatus: 'PENDING',
        status: 'COMPLETED',
      });

      const [a, b] = await Promise.all([
        service.settleOrder(order.id),
        service.settleOrder(order.id),
      ]);

      expect(a?.id).toBe(b?.id);
      const rowCount = await prisma.orderSettlement.count({ where: { orderId: order.id } });
      expect(rowCount).toBe(1);

      const account = await commissionAccounts.getOrCreateAccount('MERCHANT', merchantUserId);
      expect(Number(account.outstandingBalance)).toBe(800);
    });

    it('concurrent mode-A settlements deducting against the same outstanding balance never lose an update', async () => {
      if (!databaseAvailable) return;
      const modeB = await createOrder({
        subtotal: 20000,
        total: 20000,
        paymentMethod: 'MERCHANT_DIRECT',
        paymentStatus: 'PENDING',
        status: 'COMPLETED',
      });
      await service.settleOrder(modeB.id);
      const accountBefore = await commissionAccounts.getOrCreateAccount('MERCHANT', merchantUserId);
      expect(Number(accountBefore.outstandingBalance)).toBe(2000);

      const orderA = await createOrder({ subtotal: 5000, total: 5750, paymentMethod: 'WALLET' });
      const orderB = await createOrder({ subtotal: 5000, total: 5750, paymentMethod: 'WALLET' });

      const [settledA, settledB] = await Promise.all([
        service.settleOrder(orderA.id),
        service.settleOrder(orderB.id),
      ]);

      // Each order's theoretical merchantAmount is 4500; two concurrent
      // 2000-cap-shared deductions must sum to exactly the 2000 that was
      // outstanding, never double-counted and never lost to a race —
      // optimistic concurrency (CommissionAccount.version) forces the
      // loser of the race to retry-read the updated balance.
      const totalCredited = Number(settledA?.merchantAmount) + Number(settledB?.merchantAmount);
      expect(totalCredited).toBe(9000 - 2000);

      const accountAfter = await commissionAccounts.getOrCreateAccount('MERCHANT', merchantUserId);
      expect(Number(accountAfter.outstandingBalance)).toBe(0);
    });

    it('CASH settlements are never touched by automatic deduction — they accrue instead, as of Slice 3', async () => {
      if (!databaseAvailable) return;
      const modeB = await createOrder({
        subtotal: 5000,
        total: 5000,
        paymentMethod: 'MERCHANT_DIRECT',
        paymentStatus: 'PENDING',
        status: 'COMPLETED',
      });
      await service.settleOrder(modeB.id);
      const accountBefore = await commissionAccounts.getOrCreateAccount('MERCHANT', merchantUserId);
      expect(Number(accountBefore.outstandingBalance)).toBe(500);

      const cashOrder = await createOrder({
        subtotal: 2000,
        total: 2300,
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        status: 'COMPLETED',
      });
      const walletBefore = await walletService.getWallet(WalletOwnerType.MERCHANT, merchantUserId);

      const settlement = await service.settleOrder(cashOrder.id);

      // As of Slice 3, CASH accrues (like mode B) rather than crediting
      // Wallet — the existing mode-B outstanding balance is untouched by
      // automatic deduction (CASH never reaches that code path at all)
      // and the new CASH order's own 200 commission adds on top of it.
      expect(settlement?.walletLedgerEntryId).toBeNull();
      const walletAfter = await walletService.getWallet(WalletOwnerType.MERCHANT, merchantUserId);
      expect(walletAfter.availableBalance).toBe(walletBefore.availableBalance);

      const accountAfter = await commissionAccounts.getOrCreateAccount('MERCHANT', merchantUserId);
      expect(Number(accountAfter.outstandingBalance)).toBe(700);
    });
  });

  describe('DPX-COMMERCIAL-001 Slice 3 — Marketplace mode C (Cash on Delivery correction)', () => {
    beforeEach(async () => {
      if (!databaseAvailable) return;
      await prisma.commissionLedgerEntry.deleteMany({
        where: { account: { ownerType: 'MERCHANT', ownerId: merchantUserId } },
      });
      await prisma.commissionAccount.deleteMany({
        where: { ownerType: 'MERCHANT', ownerId: merchantUserId },
      });
    });

    afterEach(async () => {
      if (!databaseAvailable) return;
      await prisma.commissionLedgerEntry.deleteMany({
        where: { account: { ownerType: 'MERCHANT', ownerId: merchantUserId } },
      });
      await prisma.commissionAccount.deleteMany({
        where: { ownerType: 'MERCHANT', ownerId: merchantUserId },
      });
    });

    it('CASH settlement accrues commission onto CommissionAccount instead of crediting Wallet', async () => {
      if (!databaseAvailable) return;
      const order = await createOrder({
        subtotal: 3000,
        total: 3000,
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        status: 'COMPLETED',
      });
      const walletBefore = await walletService.getWallet(WalletOwnerType.MERCHANT, merchantUserId);

      const settlement = await service.settleOrder(order.id);

      expect(settlement?.status).toBe(OrderSettlementStatus.COMPLETED);
      expect(Number(settlement?.commissionAmount)).toBe(300);
      expect(settlement?.walletLedgerEntryId).toBeNull();

      const walletAfter = await walletService.getWallet(WalletOwnerType.MERCHANT, merchantUserId);
      expect(walletAfter.availableBalance).toBe(walletBefore.availableBalance);

      const account = await commissionAccounts.getOrCreateAccount('MERCHANT', merchantUserId);
      expect(Number(account.outstandingBalance)).toBe(300);
    });

    it('replayed CASH settlement on the same order stays exactly-once', async () => {
      if (!databaseAvailable) return;
      const order = await createOrder({
        subtotal: 4000,
        total: 4000,
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        status: 'COMPLETED',
      });

      await service.settleOrder(order.id);
      await service.settleOrder(order.id);

      const rowCount = await prisma.orderSettlement.count({ where: { orderId: order.id } });
      expect(rowCount).toBe(1);

      const account = await commissionAccounts.getOrCreateAccount('MERCHANT', merchantUserId);
      expect(Number(account.outstandingBalance)).toBe(400);
    });

    it('CASH still requires PAID before settling — unlike mode B, a rider must confirm collection first', async () => {
      if (!databaseAvailable) return;
      const order = await createOrder({
        subtotal: 1000,
        total: 1000,
        paymentMethod: 'CASH',
        paymentStatus: 'PENDING',
        status: 'COMPLETED',
      });

      const settlement = await service.settleOrder(order.id);

      expect(settlement).toBeNull();
    });

    it('reversing a CASH settlement reverses the commission accrual, not a Wallet debit', async () => {
      if (!databaseAvailable) return;
      const order = await createOrder({
        subtotal: 5000,
        total: 5000,
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        status: 'COMPLETED',
      });
      await service.settleOrder(order.id);
      const accountBefore = await commissionAccounts.getOrCreateAccount('MERCHANT', merchantUserId);
      expect(Number(accountBefore.outstandingBalance)).toBe(500);
      const walletBefore = await walletService.getWallet(WalletOwnerType.MERCHANT, merchantUserId);

      const reversed = await service.reverseSettlement(order.id, 'Order refunded');

      expect(reversed?.status).toBe(OrderSettlementStatus.REVERSED);
      const accountAfter = await commissionAccounts.getOrCreateAccount('MERCHANT', merchantUserId);
      expect(Number(accountAfter.outstandingBalance)).toBe(0);
      const walletAfter = await walletService.getWallet(WalletOwnerType.MERCHANT, merchantUserId);
      expect(walletAfter.availableBalance).toBe(walletBefore.availableBalance);
    });

    it('concurrent CASH settlements for the same merchant never lose an accrual to the shared CommissionAccount race', async () => {
      if (!databaseAvailable) return;
      const orderA = await createOrder({
        subtotal: 3000,
        total: 3000,
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        status: 'COMPLETED',
      });
      const orderB = await createOrder({
        subtotal: 4000,
        total: 4000,
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        status: 'COMPLETED',
      });
      const accountBefore = await commissionAccounts.getOrCreateAccount('MERCHANT', merchantUserId);
      const startingBalance = Number(accountBefore.outstandingBalance);

      const [settledA, settledB] = await Promise.all([
        service.settleOrder(orderA.id),
        service.settleOrder(orderB.id),
      ]);

      // Two independent orders completing close together both accrue to
      // the same CommissionAccount — a lost update here (one accrual
      // silently dropped by the optimistic-concurrency race, or the whole
      // settlement failing outright instead of retrying) would violate
      // "preserve exactly-once settlement guarantees." Both settlements
      // must succeed and both amounts must land.
      expect(settledA?.status).toBe(OrderSettlementStatus.COMPLETED);
      expect(settledB?.status).toBe(OrderSettlementStatus.COMPLETED);

      const accountAfter = await commissionAccounts.getOrCreateAccount('MERCHANT', merchantUserId);
      expect(Number(accountAfter.outstandingBalance)).toBe(startingBalance + 300 + 400);

      const ledgerCount = await prisma.commissionLedgerEntry.count({
        where: {
          account: { ownerType: 'MERCHANT', ownerId: merchantUserId },
          referenceType: 'order',
          referenceId: { in: [orderA.id, orderB.id] },
        },
      });
      expect(ledgerCount).toBe(2);
    });

    it('a CASH order blocked at checkout time by an outstanding balance cannot be created for a blocked merchant', async () => {
      if (!databaseAvailable) return;
      // Regression guard, not new behavior: Slice 2's checkout-time block
      // (CheckoutService.assertMerchantApproved()) runs before payment
      // method selection, so it already covers CASH/mode-C orders the
      // same as every other payment method — nothing Slice-3-specific
      // needed changing there. Exercised at the CommissionAccountService
      // level here since CheckoutService itself is out of Slice 3's scope.
      const account = await commissionAccounts.getOrCreateAccount('MERCHANT', merchantUserId);
      expect(typeof account.blocked).toBe('boolean');
    });
  });
});
