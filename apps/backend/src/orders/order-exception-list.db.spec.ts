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

const databaseUrl = process.env['DATABASE_URL'] ?? '';
const suite = databaseUrl === '' ? describe.skip : describe;

/**
 * DPX-ORDER-8D-C ops visibility — the exception read path against real Postgres.
 *
 * Filtering, ordering and pagination are database behaviour, so they are proven
 * against a database. A mocked Prisma would only assert that the arguments this
 * file already knows about were passed along, which proves the query was
 * written, not that it answers correctly.
 */
suite('PrismaOrdersRepository.listExceptions', () => {
  let prisma: PrismaClient;
  let repository: PrismaOrdersRepository;

  const userIds: string[] = [];
  const merchantIds: string[] = [];
  const orderIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
    repository = new PrismaOrdersRepository(prisma as unknown as PrismaService);
  }, 60_000);

  afterAll(async () => {
    await prisma.orderException.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.merchantProfile.deleteMany({ where: { id: { in: merchantIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  }, 60_000);

  async function anException(over: {
    status?: OrderExceptionStatus;
    detectedAt?: Date;
    waitedMinutes?: number;
  }): Promise<{ exceptionId: string; orderId: string }> {
    const owner = await prisma.user.create({
      data: {
        email: `o-${randomUUID()}@dripplex.test`,
        passwordHash: 'x',
        firstName: 'O',
        lastName: 'W',
      },
    });
    userIds.push(owner.id);
    const merchant = await prisma.merchantProfile.create({
      data: { userId: owner.id },
    });
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

    const order = await prisma.order.create({
      data: {
        orderNumber: `DPX-LST-${randomUUID().slice(0, 8).toUpperCase()}`,
        customerId: customer.id,
        merchantId: merchant.id,
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PENDING,
        fulfillmentType: FulfillmentType.DELIVERY,
        subtotal: 500,
        discount: 0,
        tax: 0,
        deliveryFee: 0,
        total: 500,
        currency: 'NGN',
        confirmedAt: new Date(Date.now() - 60 * 60_000),
      },
    });
    orderIds.push(order.id);

    const exception = await prisma.orderException.create({
      data: {
        orderId: order.id,
        type: OrderExceptionType.STALLED_CONFIRMED,
        status: over.status ?? OrderExceptionStatus.OPEN,
        waitedMinutes: over.waitedMinutes ?? 60,
        detectedAt: over.detectedAt ?? new Date(),
      },
    });

    return { exceptionId: exception.id, orderId: order.id };
  }

  /** Only the rows this test created — the table is shared with other suites. */
  function mine<T extends { orderId: string }>(items: T[]): T[] {
    return items.filter((item) => orderIds.includes(item.orderId));
  }

  it('OEL-001 · returns an exception with its order joined', async () => {
    const { orderId } = await anException({});

    const result = await repository.listExceptions({ skip: 0, take: 100 });
    const found = result.items.find((item) => item.orderId === orderId);

    expect(found).toBeDefined();
    // The join is the point: an operations queue that returns bare foreign keys
    // makes the console fetch every order one at a time to render one page.
    expect(found?.order.id).toBe(orderId);
    expect(found?.order.status).toBe(OrderStatus.CONFIRMED);
  });

  it('OEL-002 · filters by status', async () => {
    const open = await anException({ status: OrderExceptionStatus.OPEN });
    const resolved = await anException({ status: OrderExceptionStatus.RESOLVED });

    const result = await repository.listExceptions({
      status: OrderExceptionStatus.OPEN,
      skip: 0,
      take: 100,
    });
    const ids = mine(result.items).map((item) => item.orderId);

    expect(ids).toContain(open.orderId);
    expect(ids).not.toContain(resolved.orderId);
  });

  it('OEL-003 · filters by type', async () => {
    const { orderId } = await anException({});

    const result = await repository.listExceptions({
      type: OrderExceptionType.STALLED_CONFIRMED,
      skip: 0,
      take: 100,
    });

    expect(mine(result.items).map((item) => item.orderId)).toContain(orderId);
  });

  it('OEL-004 · newest escalation first', async () => {
    const older = await anException({ detectedAt: new Date(Date.now() - 4 * 60 * 60_000) });
    const newer = await anException({ detectedAt: new Date(Date.now() - 1 * 60 * 60_000) });

    const result = await repository.listExceptions({ skip: 0, take: 100 });
    const ids = mine(result.items).map((item) => item.orderId);

    // A queue is worked from the top, and the freshest escalation is the one
    // nobody has looked at yet.
    expect(ids.indexOf(newer.orderId)).toBeLessThan(ids.indexOf(older.orderId));
  });

  it('OEL-005 · total counts every match, not just the returned page', async () => {
    await anException({});
    await anException({});

    const page = await repository.listExceptions({ skip: 0, take: 1 });

    expect(page.items).toHaveLength(1);
    // Otherwise the console renders "1 of 1" over a queue with a backlog in it.
    expect(page.total).toBeGreaterThanOrEqual(2);
  });

  it('OEL-006 · paging does not drop or repeat a row when detectedAt ties', async () => {
    // Same instant on purpose. Without the `id` tiebreak, Postgres may order
    // equal keys differently per query, and a row can appear on both pages or
    // on neither — an operator silently never sees it.
    const tie = new Date();
    const a = await anException({ detectedAt: tie });
    const b = await anException({ detectedAt: tie });
    const c = await anException({ detectedAt: tie });

    const seen: string[] = [];
    for (let skip = 0; skip < 60; skip += 1) {
      const page = await repository.listExceptions({ skip, take: 1 });
      seen.push(...page.items.map((item) => item.orderId));
    }

    for (const created of [a, b, c]) {
      expect(seen.filter((id) => id === created.orderId)).toHaveLength(1);
    }
  }, 60_000);

  it('OEL-007 · reading changes nothing', async () => {
    const { orderId, exceptionId } = await anException({});
    const before = await prisma.orderException.findUniqueOrThrow({ where: { id: exceptionId } });
    const orderBefore = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });

    await repository.listExceptions({ skip: 0, take: 100 });
    await repository.listExceptions({ status: OrderExceptionStatus.OPEN, skip: 0, take: 100 });

    const after = await prisma.orderException.findUniqueOrThrow({ where: { id: exceptionId } });
    const orderAfter = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });

    expect(after).toEqual(before);
    expect(orderAfter).toEqual(orderBefore);
  });
});
