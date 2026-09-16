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
} from '@prisma/client';

import { OrderRecoveryService } from './order-recovery.service';
import { PrismaOrderRecoveryRepository } from './repositories/prisma-order-recovery.repository';

import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl = process.env['DATABASE_URL'] ?? '';
const suite = databaseUrl === '' ? describe.skip : describe;

/**
 * DPX-ORDER-8D-RECOVERY Increment 1 — the recovery case file, against real
 * Postgres.
 *
 * The two properties that matter most here are database invariants, so they are
 * proven against a database rather than a mock:
 *
 *   • UNIQUE(order_id) is the concurrency claim. A mocked Prisma would only
 *     confirm that a create was attempted, not that exactly one of two
 *     simultaneous creates wins.
 *   • The historical case must not make the order, the payment or the exception
 *     move. That is asserted by reading those rows back, not by trusting that
 *     the code never called a mutation.
 */
suite('DPX-ORDER-8D-RECOVERY · recovery case foundation', () => {
  let prisma: PrismaClient;
  let repository: PrismaOrderRecoveryRepository;
  let service: OrderRecoveryService;

  const userIds: string[] = [];
  const merchantIds: string[] = [];
  const orderIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
    repository = new PrismaOrderRecoveryRepository(prisma as unknown as PrismaService);
    // Increment 1's tests only exercise recognition, which touches neither the
    // orders repository nor audit — passing stubs keeps this spec focused on
    // the case file rather than re-testing increment 2's cancellation.
    service = new OrderRecoveryService(
      repository,
      { transition: jest.fn() } as never,
      { record: jest.fn() } as never,
    );
  }, 60_000);

  afterAll(async () => {
    await prisma.orderRecoveryAction.deleteMany({
      where: { recovery: { orderId: { in: orderIds } } },
    });
    await prisma.orderRecovery.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderException.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.merchantProfile.deleteMany({ where: { id: { in: merchantIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }, 60_000);

  async function aStalledOrder(
    over: { paymentMethod?: OrderPaymentMethod; paymentStatus?: PaymentStatus } = {},
  ): Promise<{ orderId: string; orderNumber: string; exceptionId: string }> {
    const owner = await prisma.user.create({
      data: {
        email: `o-${randomUUID()}@dripplex.test`,
        passwordHash: 'x',
        firstName: 'O',
        lastName: 'W',
      },
    });
    userIds.push(owner.id);
    const merchant = await prisma.merchantProfile.create({ data: { userId: owner.id } });
    merchantIds.push(merchant.id);
    const customer = await prisma.user.create({
      data: {
        email: `c-${randomUUID()}@dripplex.test`,
        passwordHash: 'x',
        firstName: 'C',
        lastName: 'B',
      },
    });
    userIds.push(customer.id);

    const orderNumber = `DPX-REC-${randomUUID().slice(0, 8).toUpperCase()}`;
    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        merchantId: merchant.id,
        status: OrderStatus.CONFIRMED,
        paymentStatus: over.paymentStatus ?? PaymentStatus.PENDING,
        paymentMethod: over.paymentMethod ?? OrderPaymentMethod.CASH,
        fulfillmentType: FulfillmentType.DELIVERY,
        subtotal: 1000,
        discount: 0,
        tax: 0,
        deliveryFee: 0,
        total: 1000,
        currency: 'NGN',
        confirmedAt: new Date(Date.now() - 6382 * 60_000),
      },
    });
    orderIds.push(order.id);

    const exception = await prisma.orderException.create({
      data: {
        orderId: order.id,
        type: OrderExceptionType.STALLED_CONFIRMED,
        status: OrderExceptionStatus.OPEN,
        waitedMinutes: 6382,
        detectedAt: new Date(),
        notifiedAt: new Date(),
      },
    });

    return { orderId: order.id, orderNumber, exceptionId: exception.id };
  }

  it('REC-001 · opens a case and returns it with its timeline and order', async () => {
    const { orderId, exceptionId } = await aStalledOrder();

    const opened = await repository.openCase({
      orderId,
      orderExceptionId: exceptionId,
      trigger: OrderRecoveryTrigger.OPERATOR,
      paymentMethodAtOpen: OrderPaymentMethod.CASH,
      paymentStatusAtOpen: PaymentStatus.PENDING,
    });

    expect(opened.opened).toBe(true);
    const detail = await repository.findByOrderId(orderId);
    expect(detail?.order.id).toBe(orderId);
    expect(detail?.actions).toEqual([]);
    expect(detail?.status).toBe(OrderRecoveryStatus.PENDING);
  });

  it('REC-002 · a second openCase does not create a second case', async () => {
    const { orderId } = await aStalledOrder();
    const base = {
      orderId,
      trigger: OrderRecoveryTrigger.OPERATOR,
      paymentMethodAtOpen: OrderPaymentMethod.CASH,
      paymentStatusAtOpen: PaymentStatus.PENDING,
    };

    const first = await repository.openCase(base);
    const second = await repository.openCase(base);

    expect(first.opened).toBe(true);
    // The loser is told it lost and handed the existing case, rather than
    // erroring — two workers arriving together is expected, not exceptional.
    expect(second.opened).toBe(false);
    expect(second.recovery.id).toBe(first.recovery.id);
    expect(await prisma.orderRecovery.count({ where: { orderId } })).toBe(1);
  });

  it('REC-003 · exactly one of eight simultaneous claims wins', async () => {
    // THE CONCURRENCY PROOF. The claim has to hold when the callers are truly
    // concurrent, not merely sequential — that is the case a second replica or
    // an operator racing the backstop actually produces.
    const { orderId } = await aStalledOrder();
    const base = {
      orderId,
      trigger: OrderRecoveryTrigger.AUTOMATIC,
      paymentMethodAtOpen: OrderPaymentMethod.CASH,
      paymentStatusAtOpen: PaymentStatus.PENDING,
    };

    const results = await Promise.all(Array.from({ length: 8 }, () => repository.openCase(base)));

    expect(results.filter((result) => result.opened)).toHaveLength(1);
    expect(await prisma.orderRecovery.count({ where: { orderId } })).toBe(1);
    // Every loser still receives the same case, so none of them is left without
    // a reference to work from.
    const ids = new Set(results.map((result) => result.recovery.id));
    expect(ids.size).toBe(1);
  }, 60_000);

  it('REC-004 · records an append-only action carrying typed references', async () => {
    const { orderId } = await aStalledOrder();
    const { recovery } = await repository.openCase({
      orderId,
      trigger: OrderRecoveryTrigger.OPERATOR,
      paymentMethodAtOpen: OrderPaymentMethod.CASH,
      paymentStatusAtOpen: PaymentStatus.PENDING,
    });

    await repository.recordAction({
      recoveryId: recovery.id,
      type: OrderRecoveryActionType.FINDING_RECORDED,
      outcome: OrderRecoveryActionOutcome.SUCCEEDED,
      automatic: true,
      detail: 'first',
    });
    await repository.recordAction({
      recoveryId: recovery.id,
      type: OrderRecoveryActionType.CUSTOMER_CONTACT,
      outcome: OrderRecoveryActionOutcome.SUCCEEDED,
      automatic: false,
      detail: 'second',
    });

    const detail = await repository.findByOrderId(orderId);
    expect(detail?.actions.map((action) => action.detail)).toEqual(['first', 'second']);
    // A money-moving action with no ledger entry is how a no-op is recorded;
    // the null FK is what later makes a false refund claim unreachable.
    expect(detail?.actions[0]?.walletLedgerEntryId).toBeNull();
  });

  it('REC-005 · human and automatic actions stay distinguishable', async () => {
    // Founder ruling: cancelledBy is ADMIN for BOTH operator and automatic
    // recovery, so the Order cannot carry this distinction. It has to survive
    // here or it is lost.
    const { orderId } = await aStalledOrder();
    const { recovery } = await repository.openCase({
      orderId,
      trigger: OrderRecoveryTrigger.AUTOMATIC,
      paymentMethodAtOpen: OrderPaymentMethod.CASH,
      paymentStatusAtOpen: PaymentStatus.PENDING,
    });

    const automatic = await repository.recordAction({
      recoveryId: recovery.id,
      type: OrderRecoveryActionType.FINDING_RECORDED,
      outcome: OrderRecoveryActionOutcome.SUCCEEDED,
      automatic: true,
    });

    expect(automatic.automatic).toBe(true);
    expect(automatic.actorId).toBeNull();
    expect(recovery.trigger).toBe(OrderRecoveryTrigger.AUTOMATIC);
    expect(recovery.openedById).toBeNull();
  });

  it('REC-006 · recognising a historical case mutates no order, payment or exception', async () => {
    // THE CONSTRAINT FOR THIS INCREMENT. DPX-20260911-F7GK1S must be recognised
    // without being touched.
    const { orderId, orderNumber, exceptionId } = await aStalledOrder();
    const orderBefore = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    const exceptionBefore = await prisma.orderException.findUniqueOrThrow({
      where: { id: exceptionId },
    });

    const result = await service.recognizeHistoricalCase({
      orderNumber,
      note: 'Predates the recovery implementation.',
    });

    expect(result.opened).toBe(true);
    expect(result.recovery.predatesRecoveryImplementation).toBe(true);

    const orderAfter = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    const exceptionAfter = await prisma.orderException.findUniqueOrThrow({
      where: { id: exceptionId },
    });

    expect(orderAfter.status).toBe(orderBefore.status);
    expect(orderAfter.paymentStatus).toBe(orderBefore.paymentStatus);
    expect(orderAfter.cancelledAt).toBeNull();
    expect(orderAfter.updatedAt.getTime()).toBe(orderBefore.updatedAt.getTime());
    expect(exceptionAfter.status).toBe(OrderExceptionStatus.OPEN);
    expect(exceptionAfter.resolvedAt).toBeNull();
    expect(exceptionAfter.updatedAt.getTime()).toBe(exceptionBefore.updatedAt.getTime());
  });

  it('REC-007 · a historical CASH case is NONE_DUE and needs no investigation', async () => {
    const { orderNumber } = await aStalledOrder({
      paymentMethod: OrderPaymentMethod.CASH,
      paymentStatus: PaymentStatus.PENDING,
    });

    const { recovery } = await service.recognizeHistoricalCase({ orderNumber, note: 'cash' });

    // Cash is collected on delivery and the delivery never happened, so no
    // money reached anyone.
    expect(recovery.financialOutcome).toBe(OrderRecoveryFinancialOutcome.NONE_DUE);
    expect(recovery.investigationStatus).toBe('NOT_REQUIRED');
  });

  it('REC-008 · a MERCHANT_DIRECT case at the same PENDING status is NOT treated as unpaid', async () => {
    // THE TRAP. Identical paymentStatus to REC-007, opposite treatment: for
    // MERCHANT_DIRECT, PENDING is permanent by design and the customer may
    // already have paid the merchant. Any branch on paymentStatus alone gets
    // this wrong and tells a paying customer no payment exists.
    const { orderNumber } = await aStalledOrder({
      paymentMethod: OrderPaymentMethod.MERCHANT_DIRECT,
      paymentStatus: PaymentStatus.PENDING,
    });

    const { recovery } = await service.recognizeHistoricalCase({ orderNumber, note: 'md' });

    expect(recovery.financialOutcome).toBe(OrderRecoveryFinancialOutcome.MANUAL_REQUIRED);
    expect(recovery.investigationStatus).toBe('OPEN');
  });

  it('REC-009 · a gateway-paid case requires a human, never an automatic refund', async () => {
    const { orderNumber } = await aStalledOrder({
      paymentMethod: OrderPaymentMethod.PAYSTACK,
      paymentStatus: PaymentStatus.PAID,
    });

    const { recovery } = await service.recognizeHistoricalCase({ orderNumber, note: 'gateway' });

    // No gateway refund integration exists anywhere in the codebase, and this
    // increment does not invent one.
    expect(recovery.financialOutcome).toBe(OrderRecoveryFinancialOutcome.MANUAL_REQUIRED);
    expect(recovery.investigationStatus).toBe('OPEN');
  });

  it('REC-010 · recognition is idempotent and appends no duplicate finding', async () => {
    const { orderNumber, orderId } = await aStalledOrder();

    const first = await service.recognizeHistoricalCase({ orderNumber, note: 'once' });
    const second = await service.recognizeHistoricalCase({ orderNumber, note: 'again' });

    expect(first.opened).toBe(true);
    expect(second.opened).toBe(false);
    expect(await prisma.orderRecovery.count({ where: { orderId } })).toBe(1);
    // Re-running recognition must not grow the case file.
    expect(second.recovery.actions).toHaveLength(1);
  });

  it('REC-011 · a historical case is excluded by the flag the sweep will filter on', async () => {
    const historical = await aStalledOrder();
    const fresh = await aStalledOrder();

    await service.recognizeHistoricalCase({ orderNumber: historical.orderNumber, note: 'old' });
    await repository.openCase({
      orderId: fresh.orderId,
      trigger: OrderRecoveryTrigger.AUTOMATIC,
      paymentMethodAtOpen: OrderPaymentMethod.CASH,
      paymentStatusAtOpen: PaymentStatus.PENDING,
    });

    const sweepable = await repository.list({
      predatesRecoveryImplementation: false,
      skip: 0,
      take: 100,
    });
    const ids = sweepable.items.map((item) => item.orderId);

    expect(ids).toContain(fresh.orderId);
    expect(ids).not.toContain(historical.orderId);
  });

  it('REC-012 · listing pages stably and counts every match', async () => {
    const a = await aStalledOrder();
    const b = await aStalledOrder();
    for (const created of [a, b]) {
      await repository.openCase({
        orderId: created.orderId,
        trigger: OrderRecoveryTrigger.OPERATOR,
        paymentMethodAtOpen: OrderPaymentMethod.CASH,
        paymentStatusAtOpen: PaymentStatus.PENDING,
      });
    }

    const page = await repository.list({ skip: 0, take: 1 });

    expect(page.items).toHaveLength(1);
    expect(page.total).toBeGreaterThanOrEqual(2);
  });

  it('REC-013 · recognising an unknown order number fails rather than inventing a case', async () => {
    await expect(
      service.recognizeHistoricalCase({ orderNumber: 'DPX-DOES-NOT-EXIST', note: 'x' }),
    ).rejects.toThrow(/not found/i);
  });
});
