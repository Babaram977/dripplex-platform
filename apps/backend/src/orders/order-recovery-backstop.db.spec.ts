import { randomUUID } from 'node:crypto';

import {
  FulfillmentType,
  OrderExceptionStatus,
  OrderExceptionType,
  OrderPaymentMethod,
  OrderRecoveryActionOutcome,
  OrderRecoveryActionType,
  OrderRecoveryFinancialOutcome,
  OrderRecoveryStatus,
  OrderRecoveryTrigger,
  OrderStatus,
  PaymentStatus,
  PrismaClient,
  WalletOwnerType,
} from '@prisma/client';

import { WalletService } from '../wallet/wallet.service';

import { OrderRecoverySweepService } from './order-recovery-sweep.service';
import { OrderRecoveryService } from './order-recovery.service';
import { ORDER_WALLET_REFERENCE_TYPE, resolveRecoveryActivationAt } from './order.constants';
import { PrismaOrderRecoveryRepository } from './repositories/prisma-order-recovery.repository';
import { PrismaOrdersRepository } from './repositories/prisma-orders.repository';

import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl = process.env['DATABASE_URL'] ?? '';
const suite = databaseUrl === '' ? describe.skip : describe;

const HOUR = 60 * 60 * 1000;

/**
 * DPX-ORDER-8D-RECOVERY Increment 4 — the 24-hour automatic backstop.
 *
 * THE ELIGIBILITY PREDICATE IS THE SAFETY MECHANISM, so every condition in it
 * gets an owning test here, and each of those tests is individually falsified
 * by mutating its condition. A predicate nobody can break is a predicate nobody
 * has tested.
 *
 * The conditions, each with a test that fails if it is removed:
 *   • activation boundary   BAK-003, BAK-004  (and BAK-001/002 for fail-closed)
 *   • ≥24h in CONFIRMED     BAK-005
 *   • status CONFIRMED      BAK-006
 *   • exception still OPEN  BAK-007
 *   • not a historical case BAK-008
 *   • no existing case      BAK-009
 */
suite('DPX-ORDER-8D-RECOVERY · automatic backstop', () => {
  let prisma: PrismaClient;
  let recoveries: PrismaOrderRecoveryRepository;

  const userIds: string[] = [];
  const merchantIds: string[] = [];
  const orderIds: string[] = [];
  const walletIds: string[] = [];

  /** Every order in this file stalled AFTER this instant, so the boundary is
   * satisfied by default and each test can break exactly one condition. */
  const ACTIVATION = new Date(Date.now() - 30 * 24 * HOUR);

  const sent: string[] = [];

  function service(): OrderRecoveryService {
    const wallet = new WalletService(
      prisma as unknown as PrismaService,
      { record: jest.fn() } as never,
      { emit: jest.fn(), emitAsync: jest.fn() } as never,
    );
    const notifications = {
      send: jest.fn(async (dto: { userId: string; title: string; body: string }) => {
        sent.push(dto.body);
        const notification = await prisma.notification.create({
          data: {
            userId: dto.userId,
            category: 'MARKETPLACE',
            channel: 'IN_APP',
            type: 'REFUND',
            title: dto.title,
            body: dto.body,
          },
        });
        return { notification, skipped: false };
      }),
    } as never;
    return new OrderRecoveryService(
      recoveries,
      new PrismaOrdersRepository(prisma as unknown as PrismaService),
      { record: jest.fn() } as never,
      wallet,
      notifications,
    );
  }

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
    recoveries = new PrismaOrderRecoveryRepository(prisma as unknown as PrismaService);
  }, 60_000);

  afterAll(async () => {
    await prisma.orderRecoveryAction.deleteMany({
      where: { recovery: { orderId: { in: orderIds } } },
    });
    await prisma.orderRecovery.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderException.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.walletLedgerEntry.deleteMany({ where: { walletId: { in: walletIds } } });
    await prisma.wallet.deleteMany({ where: { id: { in: walletIds } } });
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.merchantProfile.deleteMany({ where: { id: { in: merchantIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }, 60_000);

  beforeEach(() => {
    sent.length = 0;
  });

  async function anOrder(
    over: {
      confirmedHoursAgo?: number;
      detectedAt?: Date;
      exceptionStatus?: OrderExceptionStatus;
      status?: OrderStatus;
      paymentMethod?: OrderPaymentMethod;
      paymentStatus?: PaymentStatus;
      walletBalance?: number;
    } = {},
  ): Promise<{ orderId: string; orderNumber: string; customerId: string; walletId: string }> {
    const owner = await prisma.user.create({
      data: {
        email: `m-${randomUUID()}@dpx.test`,
        passwordHash: 'x',
        firstName: 'M',
        lastName: 'O',
      },
    });
    userIds.push(owner.id);
    const merchant = await prisma.merchantProfile.create({ data: { userId: owner.id } });
    merchantIds.push(merchant.id);
    const customer = await prisma.user.create({
      data: {
        email: `c-${randomUUID()}@dpx.test`,
        passwordHash: 'x',
        firstName: 'C',
        lastName: 'B',
      },
    });
    userIds.push(customer.id);
    const wallet = await prisma.wallet.create({
      data: {
        ownerType: WalletOwnerType.CUSTOMER,
        ownerId: customer.id,
        currency: 'NGN',
        availableBalance: over.walletBalance ?? 0,
      },
    });
    walletIds.push(wallet.id);

    const confirmedAt = new Date(Date.now() - (over.confirmedHoursAgo ?? 48) * HOUR);
    const orderNumber = `DPX-R4-${randomUUID().slice(0, 8).toUpperCase()}`;
    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        merchantId: merchant.id,
        status: over.status ?? OrderStatus.CONFIRMED,
        paymentStatus: over.paymentStatus ?? PaymentStatus.PENDING,
        paymentMethod: over.paymentMethod ?? OrderPaymentMethod.CASH,
        fulfillmentType: FulfillmentType.DELIVERY,
        subtotal: 1000,
        discount: 0,
        tax: 0,
        deliveryFee: 0,
        total: 1000,
        currency: 'NGN',
        confirmedAt,
      },
    });
    orderIds.push(order.id);
    await prisma.orderException.create({
      data: {
        orderId: order.id,
        type: OrderExceptionType.STALLED_CONFIRMED,
        status: over.exceptionStatus ?? OrderExceptionStatus.OPEN,
        waitedMinutes: 1500,
        detectedAt: over.detectedAt ?? new Date(Date.now() - 24 * HOUR),
      },
    });
    return { orderId: order.id, orderNumber, customerId: customer.id, walletId: wallet.id };
  }

  function eligible(activationAt: Date = ACTIVATION): Promise<{ id: string }[]> {
    return recoveries.findBackstopEligibleOrders({
      activationAt,
      backstopBefore: new Date(Date.now() - 24 * HOUR),
      limit: 100,
    });
  }

  async function isEligible(orderId: string, activationAt: Date = ACTIVATION): Promise<boolean> {
    return (await eligible(activationAt)).some((order) => order.id === orderId);
  }

  // ── Fail-closed activation boundary ─────────────────────────────────────

  it('BAK-001 · an unset or malformed activation boundary resolves to null', () => {
    // All three must behave identically. A boundary that cannot be resolved is
    // not a boundary, and the sweep must treat it as "do nothing" rather than
    // letting a null reach a comparison.
    expect(resolveRecoveryActivationAt(null)).toBeNull();
    expect(resolveRecoveryActivationAt('')).toBeNull();
    expect(resolveRecoveryActivationAt('   ')).toBeNull();
    expect(resolveRecoveryActivationAt('not-a-timestamp')).toBeNull();
    expect(resolveRecoveryActivationAt('2026-13-45T99:99:99Z')).toBeNull();

    expect(resolveRecoveryActivationAt('2026-09-16T00:00:00Z')).toEqual(
      new Date('2026-09-16T00:00:00Z'),
    );
  });

  it('BAK-002 · the sweep performs ZERO recovery actions while unactivated', async () => {
    const { orderId } = await anOrder();

    // THE SHIPPING STATE. RECOVERY_ACTIVATION_AT is null until the founder sets
    // it, so deploying this increment must cancel nothing. If this ever fails,
    // a deployment alone starts cancelling live orders.
    const sweep = new OrderRecoverySweepService(service());
    const result = await sweep.runSweep();

    expect(result.inactive).toBe(true);
    expect(result.recovered).toBe(0);
    expect(result.considered).toBe(0);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe(OrderStatus.CONFIRMED);
    expect(await prisma.orderRecovery.count({ where: { orderId } })).toBe(0);
  }, 60_000);

  // ── Every eligibility condition, one test each ──────────────────────────

  it('BAK-003 · an exception detected BEFORE the boundary is never eligible', async () => {
    // The protection that does not depend on a case existing — and therefore
    // the one that actually covers DPX-20260911-F7GK1S.
    const { orderId } = await anOrder({
      confirmedHoursAgo: 24 * 40,
      detectedAt: new Date(ACTIVATION.getTime() - HOUR),
    });

    expect(await isEligible(orderId)).toBe(false);
  }, 60_000);

  it('BAK-004 · an exception detected AT the boundary is eligible', async () => {
    // The comparison is >=, not >. An exception detected at the exact instant
    // of activation belongs to the new regime.
    const { orderId } = await anOrder({ confirmedHoursAgo: 48, detectedAt: ACTIVATION });

    expect(await isEligible(orderId)).toBe(true);
  }, 60_000);

  it('BAK-005 · an order under 24 hours in CONFIRMED is not eligible', async () => {
    const young = await anOrder({ confirmedHoursAgo: 23 });
    const old = await anOrder({ confirmedHoursAgo: 25 });

    expect(await isEligible(young.orderId)).toBe(false);
    expect(await isEligible(old.orderId)).toBe(true);
  }, 60_000);

  it('BAK-006 · an order the merchant has advanced is not eligible', async () => {
    const { orderId } = await anOrder({ status: OrderStatus.PREPARING });

    expect(await isEligible(orderId)).toBe(false);
  }, 60_000);

  it('BAK-007 · an order whose exception has been resolved is not eligible', async () => {
    const { orderId } = await anOrder({ exceptionStatus: OrderExceptionStatus.RESOLVED });

    expect(await isEligible(orderId)).toBe(false);
  }, 60_000);

  it('BAK-008 · a historical case is never eligible for automatic recovery', async () => {
    const { orderId } = await anOrder();
    await prisma.orderRecovery.create({
      data: {
        orderId,
        trigger: OrderRecoveryTrigger.HISTORICAL,
        paymentStatusAtOpen: PaymentStatus.PENDING,
        predatesRecoveryImplementation: true,
      },
    });

    // Belt to the boundary's braces: even an order that somehow satisfies the
    // cutoff cannot be swept once it is recognised as historical.
    expect(await isEligible(orderId)).toBe(false);
  }, 60_000);

  it('BAK-009 · an order that already has a case is not selected again', async () => {
    const { orderId } = await anOrder();
    await prisma.orderRecovery.create({
      data: {
        orderId,
        trigger: OrderRecoveryTrigger.OPERATOR,
        paymentStatusAtOpen: PaymentStatus.PENDING,
      },
    });

    expect(await isEligible(orderId)).toBe(false);
  }, 60_000);

  // ── What the sweep actually does ────────────────────────────────────────

  it('BAK-010 · cancels a stalled CASH order as ADMIN, automatically, and moves no money', async () => {
    const { orderId, walletId } = await anOrder({ paymentMethod: OrderPaymentMethod.CASH });

    const outcome = await service().recoverAutomatically({ orderId });
    expect(outcome.acted).toBe(true);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe(OrderStatus.CANCELLED);
    // Founder ruling: ADMIN whoever acted. The human/automatic distinction
    // cannot live on the order, so it must live on the case and the action.
    expect(order.cancelledBy).toBe('ADMIN');

    const recovery = await prisma.orderRecovery.findFirstOrThrow({
      where: { orderId },
      include: { actions: true },
    });
    expect(recovery.trigger).toBe(OrderRecoveryTrigger.AUTOMATIC);
    expect(recovery.openedById).toBeNull();

    const cancel = recovery.actions.find((a) => a.type === OrderRecoveryActionType.CANCEL_ORDER);
    expect(cancel?.automatic).toBe(true);
    expect(cancel?.actorId).toBeNull();

    // CASH: nothing reached anyone, so nothing is owed back and the case closes.
    expect(recovery.financialOutcome).toBe(OrderRecoveryFinancialOutcome.NONE_DUE);
    expect(recovery.status).toBe(OrderRecoveryStatus.CLOSED);
    expect(
      await prisma.walletLedgerEntry.count({ where: { walletId, referenceId: orderId } }),
    ).toBe(0);
    expect(sent).toHaveLength(0);
  }, 60_000);

  it('BAK-011 · cancels AND reverses a stalled DX Wallet order', async () => {
    const { orderId, walletId } = await anOrder({
      paymentMethod: OrderPaymentMethod.WALLET,
      paymentStatus: PaymentStatus.PAID,
    });

    await service().recoverAutomatically({ orderId });

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe(OrderStatus.CANCELLED);
    expect(order.paymentStatus).toBe(PaymentStatus.REFUNDED);

    expect(
      await prisma.walletLedgerEntry.count({
        where: { walletId, referenceType: ORDER_WALLET_REFERENCE_TYPE, referenceId: orderId },
      }),
    ).toBe(1);
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { id: walletId } });
    expect(Number(wallet.availableBalance)).toBe(1000);

    const recovery = await prisma.orderRecovery.findFirstOrThrow({
      where: { orderId },
      include: { actions: true },
    });
    const reversal = recovery.actions.find(
      (a) => a.type === OrderRecoveryActionType.WALLET_REVERSAL,
    );
    expect(reversal?.outcome).toBe(OrderRecoveryActionOutcome.SUCCEEDED);
    expect(reversal?.automatic).toBe(true);
    expect(reversal?.actorId).toBeNull();
    expect(reversal?.walletLedgerEntryId).not.toBeNull();
    expect(sent).toHaveLength(1);
  }, 60_000);

  it('BAK-012 · a MERCHANT_DIRECT order is cancelled but its money is left to a human', async () => {
    const { orderId, walletId } = await anOrder({
      paymentMethod: OrderPaymentMethod.MERCHANT_DIRECT,
    });

    await service().recoverAutomatically({ orderId });

    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe(OrderStatus.CANCELLED);

    const recovery = await prisma.orderRecovery.findFirstOrThrow({ where: { orderId } });
    // PENDING is permanent for MERCHANT_DIRECT by design — the customer may well
    // have paid the merchant. Treating that as unpaid would be a false statement
    // about somebody's money, so a human establishes what happened.
    expect(recovery.financialOutcome).toBe(OrderRecoveryFinancialOutcome.MANUAL_REQUIRED);
    expect(recovery.status).toBe(OrderRecoveryStatus.AWAITING_INVESTIGATION);
    expect(
      await prisma.walletLedgerEntry.count({ where: { walletId, referenceId: orderId } }),
    ).toBe(0);
    expect(sent).toHaveLength(0);
  }, 60_000);

  it('BAK-013 · a gateway-paid order is cancelled but never automatically refunded', async () => {
    const { orderId, walletId } = await anOrder({
      paymentMethod: OrderPaymentMethod.PAYSTACK,
      paymentStatus: PaymentStatus.PAID,
    });

    await service().recoverAutomatically({ orderId });

    const recovery = await prisma.orderRecovery.findFirstOrThrow({ where: { orderId } });
    expect(recovery.financialOutcome).toBe(OrderRecoveryFinancialOutcome.MANUAL_REQUIRED);
    // No gateway refund adapter exists anywhere in this codebase, and this
    // increment does not invent one.
    expect(
      await prisma.walletLedgerEntry.count({ where: { walletId, referenceId: orderId } }),
    ).toBe(0);
    expect(sent).toHaveLength(0);
  }, 60_000);

  it('BAK-014 · revalidates immediately before mutating, not from the selection', async () => {
    const { orderId } = await anOrder();
    // The merchant accepts between selection and action — the exact window
    // OrderCompletionSweepService leaves open.
    await prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.PREPARING },
    });

    const outcome = await service().recoverAutomatically({ orderId });

    expect(outcome.acted).toBe(false);
    expect(outcome.reason).toBe('no_longer_stalled');
    expect(await prisma.orderRecovery.count({ where: { orderId } })).toBe(0);
  }, 60_000);

  it('BAK-015 · eight concurrent sweeps recover an order exactly once', async () => {
    const attempts = 8;
    const { orderId, walletId } = await anOrder({
      paymentMethod: OrderPaymentMethod.WALLET,
      paymentStatus: PaymentStatus.PAID,
    });

    const results = await Promise.allSettled(
      Array.from({ length: attempts }, () => service().recoverAutomatically({ orderId })),
    );

    const acted = results.filter((r) => r.status === 'fulfilled' && r.value.acted).length;
    const credits = await prisma.walletLedgerEntry.count({
      where: { walletId, referenceType: ORDER_WALLET_REFERENCE_TYPE, referenceId: orderId },
    });
    const cases = await prisma.orderRecovery.count({ where: { orderId } });

    // eslint-disable-next-line no-console
    console.log(
      `BAK-015 ratio · ${String(attempts)} concurrent sweeps → ${String(acted)} acted, ` +
        `${String(cases)} case(s), ${String(credits)} ledger credit(s)`,
    );

    // The DB claim, not an in-process flag. This is what survives two replicas.
    expect(acted).toBe(1);
    expect(cases).toBe(1);
    expect(credits).toBe(1);
  }, 120_000);
});
