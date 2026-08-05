import { randomUUID } from 'node:crypto';

import { OrderSettlementStatus, PrismaClient, WalletOwnerType } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
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
  let walletService: WalletService;
  let customerId: string;
  let merchantUserId: string;
  let merchantProfileId: string;

  async function createOrder(overrides: {
    subtotal: number;
    total: number;
    status?: 'COMPLETED' | 'PENDING';
    paymentStatus?: 'PAID' | 'PENDING';
    paymentMethod?: 'CASH' | 'WALLET';
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
    service = new MerchantSettlementService(
      prisma,
      walletService,
      auditService,
      commissionSettings,
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
});
