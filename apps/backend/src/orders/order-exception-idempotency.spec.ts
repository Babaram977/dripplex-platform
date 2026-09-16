import { randomUUID } from 'node:crypto';

import {
  FulfillmentType,
  OrderExceptionStatus,
  OrderExceptionType,
  OrderStatus,
  PaymentStatus,
  PrismaClient,
} from '@prisma/client';

import { PrismaOrdersRepository } from './repositories/prisma-orders.repository';

import type { PrismaService } from '../prisma/prisma.service';

/**
 * DPX-ORDER-8D-C — the guarantees that live in Postgres, proven in Postgres.
 *
 * The ruling asks for idempotent exception creation and protection against
 * repeated notifications. Both rest on `@@unique([orderId, type])`, and a mocked
 * repository cannot prove a database constraint — it can only prove that the
 * service believes whatever the mock says. So these run against a real database.
 *
 * Also pins auto-resolution, which lives in `transition()` — the one method
 * every status change passes through, chosen so no future path can advance an
 * order and leave a stale exception behind claiming it is still stalled.
 */

const databaseUrl = process.env['DATABASE_URL'] ?? '';
const suite = databaseUrl === '' ? describe.skip : describe;

suite('OrderException — the database guarantees', () => {
  const prisma = new PrismaClient();
  const repository = new PrismaOrdersRepository(prisma as unknown as PrismaService);

  let merchantUserId: string;
  let merchantProfileId: string;
  let customerId: string;
  const createdOrderIds: string[] = [];

  beforeAll(async () => {
    const suffix = randomUUID().slice(0, 8);

    const customer = await prisma.user.create({
      data: {
        email: `exc-customer-${suffix}@dripplex.test`,
        phone: `+234700${String(Date.now() % 10_000_000)}`,
        passwordHash: 'x',
        firstName: 'Exception',
        lastName: 'Fixture',
      },
    });
    customerId = customer.id;

    const merchantUser = await prisma.user.create({
      data: {
        email: `exc-merchant-${suffix}@dripplex.test`,
        phone: `+234701${String(Date.now() % 10_000_000)}`,
        passwordHash: 'x',
        firstName: 'Exception',
        lastName: 'Fixture',
      },
    });
    merchantUserId = merchantUser.id;

    const profile = await prisma.merchantProfile.create({
      data: { userId: merchantUserId },
    });
    merchantProfileId = profile.id;
  }, 60_000);

  afterAll(async () => {
    await prisma.orderException.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    await prisma.merchantProfile.deleteMany({ where: { id: merchantProfileId } });
    await prisma.user.deleteMany({ where: { id: { in: [merchantUserId, customerId] } } });
    await prisma.$disconnect();
  });

  const makeOrder = async (minutesAgo: number): Promise<string> => {
    const at = new Date(Date.now() - minutesAgo * 60_000);
    const order = await prisma.order.create({
      data: {
        orderNumber: `DPX-EXC-${randomUUID().slice(0, 8)}`,
        customerId,
        merchantId: merchantProfileId,
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PENDING,
        fulfillmentType: FulfillmentType.DELIVERY,
        subtotal: 1000,
        total: 1000,
        currency: 'NGN',
        confirmedAt: at,
        createdAt: at,
      },
    });
    createdOrderIds.push(order.id);
    return order.id;
  };

  it('OEI-001 · raising the same exception twice creates one row', async () => {
    const orderId = await makeOrder(45);

    const first = await repository.raiseStalledException({
      orderId,
      waitedMinutes: 45,
      detectedAt: new Date(),
    });
    const second = await repository.raiseStalledException({
      orderId,
      waitedMinutes: 60,
      detectedAt: new Date(),
    });

    expect(first.raised).toBe(true);
    // The second is refused by the unique constraint, not by bookkeeping the
    // sweep has to remember. This is the every-fifteen-minutes case.
    expect(second.raised).toBe(false);

    const rows = await prisma.orderException.findMany({ where: { orderId } });
    expect(rows).toHaveLength(1);
    // The first detection's figure survives; the re-detection does not overwrite
    // it with a larger one.
    expect(rows[0]?.waitedMinutes).toBe(45);
  });

  it('OEI-002 · concurrent raises still produce exactly one row', async () => {
    const orderId = await makeOrder(45);

    // Two sweeps racing — the guard is the constraint, not ordering.
    const results = await Promise.all([
      repository.raiseStalledException({ orderId, waitedMinutes: 45, detectedAt: new Date() }),
      repository.raiseStalledException({ orderId, waitedMinutes: 45, detectedAt: new Date() }),
    ]);

    expect(results.filter((r) => r.raised)).toHaveLength(1);
    expect(await prisma.orderException.count({ where: { orderId } })).toBe(1);
  });

  it('OEI-003 · the stalled query finds an order past the threshold', async () => {
    const orderId = await makeOrder(45);
    const cutoff = new Date(Date.now() - 30 * 60_000);

    const found = await repository.findStalledConfirmedOrders(cutoff);

    expect(found.map((o) => o.id)).toContain(orderId);
  });

  it('OEI-004 · an order with an OPEN exception is not returned again', async () => {
    const orderId = await makeOrder(45);
    await repository.raiseStalledException({ orderId, waitedMinutes: 45, detectedAt: new Date() });

    const found = await repository.findStalledConfirmedOrders(new Date(Date.now() - 30 * 60_000));

    // Belt to the constraint's braces: the sweep does not re-read orders it has
    // already raised, so a long-lived exception costs no work every quarter hour.
    expect(found.map((o) => o.id)).not.toContain(orderId);
  });

  it('OEI-005 · a recent order is not stalled', async () => {
    const orderId = await makeOrder(5);

    const found = await repository.findStalledConfirmedOrders(new Date(Date.now() - 30 * 60_000));

    expect(found.map((o) => o.id)).not.toContain(orderId);
  });

  it('OEI-006 · a PICKUP order is never stalled by this definition', async () => {
    const at = new Date(Date.now() - 45 * 60_000);
    const order = await prisma.order.create({
      data: {
        orderNumber: `DPX-EXC-${randomUUID().slice(0, 8)}`,
        customerId,
        merchantId: merchantProfileId,
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PENDING,
        fulfillmentType: FulfillmentType.PICKUP,
        subtotal: 1000,
        total: 1000,
        currency: 'NGN',
        confirmedAt: at,
        createdAt: at,
      },
    });
    createdOrderIds.push(order.id);

    const found = await repository.findStalledConfirmedOrders(new Date(Date.now() - 30 * 60_000));

    // A pickup order waits for the customer, not a rider, and never gets a
    // DeliveryJob by design. Counting it would inflate the population with
    // orders that are behaving correctly.
    expect(found.map((o) => o.id)).not.toContain(order.id);
  });

  it('OEI-007 · accepting the order resolves its exception', async () => {
    const orderId = await makeOrder(45);
    await repository.raiseStalledException({ orderId, waitedMinutes: 45, detectedAt: new Date() });

    await repository.transition(orderId, { status: OrderStatus.PREPARING });

    const row = await prisma.orderException.findFirst({ where: { orderId } });
    expect(row?.status).toBe(OrderExceptionStatus.RESOLVED);
    expect(row?.resolvedAt).not.toBeNull();
    // The resolving status is kept, so metrics can tell a recovered order from
    // an abandoned one.
    expect(row?.resolvedStatus).toBe(OrderStatus.PREPARING);
  });

  it('OEI-008 · cancelling the order also resolves it, and records that it was cancelled', async () => {
    const orderId = await makeOrder(45);
    await repository.raiseStalledException({ orderId, waitedMinutes: 45, detectedAt: new Date() });

    await repository.transition(orderId, { status: OrderStatus.CANCELLED });

    const row = await prisma.orderException.findFirst({ where: { orderId } });
    expect(row?.status).toBe(OrderExceptionStatus.RESOLVED);
    expect(row?.resolvedStatus).toBe(OrderStatus.CANCELLED);
  });

  it('OEI-009 · a payment-only transition leaves the exception open', async () => {
    const orderId = await makeOrder(45);
    await repository.raiseStalledException({ orderId, waitedMinutes: 45, detectedAt: new Date() });

    // markCashPaymentReceived passes the order's existing status through and
    // flips only paymentStatus. The order has NOT been advanced, so the
    // exception must survive — closing it here would hide a still-stalled order.
    await repository.transition(orderId, {
      status: OrderStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PAID,
    });

    const row = await prisma.orderException.findFirst({ where: { orderId } });
    expect(row?.status).toBe(OrderExceptionStatus.OPEN);
    expect(row?.resolvedAt).toBeNull();
  });

  it('OEI-010 · a resolved order can stall again without a duplicate row', async () => {
    const orderId = await makeOrder(45);
    await repository.raiseStalledException({ orderId, waitedMinutes: 45, detectedAt: new Date() });
    await repository.transition(orderId, { status: OrderStatus.PREPARING });

    // The (orderId, type) pair is still taken by the RESOLVED row, so a later
    // raise is refused rather than creating a second. Recorded because it is a
    // real consequence of the constraint: an order that stalls, recovers and
    // stalls again is counted once. Changing that would mean widening the
    // constraint, which is a decision, not an oversight.
    const again = await repository.raiseStalledException({
      orderId,
      waitedMinutes: 120,
      detectedAt: new Date(),
    });

    expect(again.raised).toBe(false);
    expect(await prisma.orderException.count({ where: { orderId } })).toBe(1);
  });

  it('OEI-013 · a new exception starts unnotified and is found by the pending query', async () => {
    const orderId = await makeOrder(45);
    await repository.raiseStalledException({ orderId, waitedMinutes: 45, detectedAt: new Date() });

    const pending = await repository.findUnnotifiedOpenExceptions();

    // The row is committed before any notification is sent, so a fresh one must
    // be visible to the retry query — otherwise a failed emit would leave a
    // stalled order permanently unannounced.
    expect(pending.map((p) => p.order.id)).toContain(orderId);
  });

  it('OEI-014 · once announced it drops out of the pending query', async () => {
    const orderId = await makeOrder(45);
    await repository.raiseStalledException({ orderId, waitedMinutes: 45, detectedAt: new Date() });
    const pending = await repository.findUnnotifiedOpenExceptions();
    const mine = pending.find((p) => p.order.id === orderId);

    await repository.markExceptionNotified(mine?.id ?? '');

    const after = await repository.findUnnotifiedOpenExceptions();
    // Announced once, not every fifteen minutes for as long as it sits there.
    expect(after.map((p) => p.order.id)).not.toContain(orderId);
  });

  it('OEI-015 · a resolved exception is never announced, even if it was never notified', async () => {
    const orderId = await makeOrder(45);
    await repository.raiseStalledException({ orderId, waitedMinutes: 45, detectedAt: new Date() });
    // The merchant acts before the warning ever goes out — a real race at the
    // 30-minute boundary. Warning them now would be worse than useless.
    await repository.transition(orderId, { status: OrderStatus.PREPARING });

    const pending = await repository.findUnnotifiedOpenExceptions();

    expect(pending.map((p) => p.order.id)).not.toContain(orderId);
  });

  it('OEI-011 · the exception type is the stalled one, and status starts OPEN', async () => {
    const orderId = await makeOrder(45);
    await repository.raiseStalledException({ orderId, waitedMinutes: 45, detectedAt: new Date() });

    const row = await prisma.orderException.findFirst({ where: { orderId } });
    expect(row?.type).toBe(OrderExceptionType.STALLED_CONFIRMED);
    expect(row?.status).toBe(OrderExceptionStatus.OPEN);
  });

  it('OEI-012 · raising an exception does not touch the order', async () => {
    const orderId = await makeOrder(45);
    const before = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });

    await repository.raiseStalledException({ orderId, waitedMinutes: 45, detectedAt: new Date() });

    const after = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    // Detection only. The ruling is explicit that the threshold escalates, it
    // does not cancel.
    expect(after.status).toBe(before.status);
    expect(after.paymentStatus).toBe(before.paymentStatus);
    expect(after.cancelledAt).toBeNull();
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
  });
});
