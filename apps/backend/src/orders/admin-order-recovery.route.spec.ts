import { randomUUID } from 'node:crypto';

import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import {
  FulfillmentType,
  OrderExceptionStatus,
  OrderExceptionType,
  OrderPaymentMethod,
  OrderStatus,
  PaymentStatus,
  PrismaClient,
  RegistrationChannel,
  UserStatus,
} from '@prisma/client';

import { AppConfigService } from '../config/app-config.service';

import type { INestApplication } from '@nestjs/common';

const databaseUrl = process.env['DATABASE_URL'] ?? '';
const suite = databaseUrl === '' ? describe.skip : describe;

/**
 * DPX-ORDER-8D-RECOVERY Increment 2 — the operator recovery routes over real
 * HTTP.
 *
 * CLAUDE.md §5: mapped is not reachable. These boot the application on a real
 * socket and read the response BODY, because a route table entry proves
 * nothing — this programme has already shipped one endpoint that Nest reported
 * as Mapped while an earlier parameterised route swallowed every request.
 *
 * The RBAC boundary is the other reason this exists. `admin:orders:read` must
 * NOT be enough to cancel somebody's order, and the only way to prove that is
 * to drive the real guard with a token that holds one permission and not the
 * other. A unit test asserting the decorator's metadata would pass even if the
 * guard were never wired.
 */
suite('DPX-ORDER-8D-RECOVERY · admin/order-recoveries over HTTP', () => {
  let app: INestApplication;
  let baseUrl: string;
  let prisma: PrismaClient;
  let readerToken: string;
  let operatorToken: string;

  const userIds: string[] = [];
  const merchantIds: string[] = [];
  const orderIds: string[] = [];
  const roleNames: string[] = [];

  async function permission(code: string, description: string): Promise<string> {
    // Read first, create only if absent, tolerate a concurrent create. NOT an
    // upsert: seed-rbac upserts these same codes, and Prisma's upsert is a read
    // then a write rather than one statement, so two racing on a unique key can
    // raise P2002 in either suite.
    const found = await prisma.permission.findUnique({ where: { code } });
    if (found) {
      return found.id;
    }
    const created = await prisma.permission
      .create({ data: { code, description } })
      .catch(async () => await prisma.permission.findUniqueOrThrow({ where: { code } }));
    return created.id;
  }

  async function tokenForRole(codes: string[]): Promise<string> {
    const roleName = `rec-${randomUUID().slice(0, 8)}`;
    roleNames.push(roleName);
    const permissionIds = await Promise.all(
      codes.map(async (code) => await permission(code, `${code} (recovery route spec)`)),
    );
    const role = await prisma.role.create({
      data: {
        name: roleName,
        description: 'recovery route spec',
        permissions: { create: permissionIds.map((permissionId) => ({ permissionId })) },
      },
    });
    const user = await prisma.user.create({
      data: {
        email: `ops-${randomUUID()}@dripplex.test`,
        passwordHash: 'x',
        firstName: 'Ops',
        lastName: 'User',
        status: UserStatus.ACTIVE,
        roles: { create: [{ roleId: role.id }] },
      },
    });
    userIds.push(user.id);
    const session = await prisma.authSession.create({
      data: {
        userId: user.id,
        portal: RegistrationChannel.OPERATIONS_CONSOLE,
        expiresAt: new Date(Date.now() + 60 * 60_000),
      },
    });
    const config = app.get(AppConfigService);
    return await app
      .get(JwtService)
      .signAsync(
        { sub: user.id, sid: session.id, role: roleName, portal: 'operations', typ: 'access' },
        { secret: config.jwtAccessSecret, expiresIn: '1h' },
      );
  }

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();

    const { AppModule } = await import('../app.module');
    // No provider overrides: stubbing the guard would prove an auth pipeline
    // that does not exist in production, which is the failure this file exists
    // to catch.
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    const config = app.get(AppConfigService);
    app.setGlobalPrefix(config.apiGlobalPrefix);
    await app.listen(0);
    const url = await app.getUrl();
    baseUrl = `${url.replace('[::1]', '127.0.0.1')}/${config.apiGlobalPrefix}`;

    readerToken = await tokenForRole(['admin:orders:read']);
    operatorToken = await tokenForRole(['admin:orders:read', 'admin:orders:recovery:manage']);
  }, 180_000);

  afterAll(async () => {
    await prisma.orderRecoveryAction.deleteMany({
      where: { recovery: { orderId: { in: orderIds } } },
    });
    await prisma.orderRecovery.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderException.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.merchantProfile.deleteMany({ where: { id: { in: merchantIds } } });
    await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.role.deleteMany({ where: { name: { in: roleNames } } });
    await app.close();
    await prisma.$disconnect();
  }, 60_000);

  async function call(
    method: 'GET' | 'POST',
    path: string,
    token: string,
    body?: unknown,
  ): Promise<{ status: number; body: Record<string, unknown> }> {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = { raw: text };
    }
    return { status: response.status, body: parsed };
  }

  async function aStalledOrder(): Promise<{ orderId: string; orderNumber: string }> {
    const owner = await prisma.user.create({
      data: {
        email: `m-${randomUUID()}@dripplex.test`,
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
        email: `c-${randomUUID()}@dripplex.test`,
        passwordHash: 'x',
        firstName: 'C',
        lastName: 'B',
      },
    });
    userIds.push(customer.id);

    const orderNumber = `DPX-R2-${randomUUID().slice(0, 8).toUpperCase()}`;
    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        merchantId: merchant.id,
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PENDING,
        paymentMethod: OrderPaymentMethod.CASH,
        fulfillmentType: FulfillmentType.DELIVERY,
        subtotal: 1000,
        discount: 0,
        tax: 0,
        deliveryFee: 0,
        total: 1000,
        currency: 'NGN',
        confirmedAt: new Date(Date.now() - 1500 * 60_000),
      },
    });
    orderIds.push(order.id);
    await prisma.orderException.create({
      data: {
        orderId: order.id,
        type: OrderExceptionType.STALLED_CONFIRMED,
        status: OrderExceptionStatus.OPEN,
        waitedMinutes: 1500,
        detectedAt: new Date(),
        notifiedAt: new Date(),
      },
    });
    return { orderId: order.id, orderNumber };
  }

  it('AOR-001 · the list route is reachable and answers a paginated envelope', async () => {
    const result = await call('GET', '/admin/order-recoveries', readerToken);

    expect(result.status).not.toBe(400);
    expect(result.status).toBe(200);
    const data = result.body['data'] as { items?: unknown; meta?: unknown };
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.meta).toEqual(
      expect.objectContaining({ page: 1, limit: 20, total: expect.any(Number) }),
    );
  }, 60_000);

  it('AOR-002 · reading a case needs only admin:orders:read', async () => {
    const { orderId } = await aStalledOrder();

    const result = await call('GET', `/admin/order-recoveries/${orderId}`, readerToken);

    expect(result.status).toBe(200);
    // No case opened yet, and asking is not an error.
    expect(result.body['data']).toBeNull();
  }, 60_000);

  it('AOR-003 · admin:orders:read alone CANNOT cancel an order', async () => {
    // THE RBAC BOUNDARY. Reading the queue must never confer the power to
    // cancel somebody's order.
    const { orderId } = await aStalledOrder();

    const result = await call('POST', `/admin/order-recoveries/${orderId}/cancel`, readerToken, {
      reason: 'should not be permitted',
    });

    expect(result.status).toBe(403);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe(OrderStatus.CONFIRMED);
    expect(order.cancelledAt).toBeNull();
  }, 60_000);

  it('AOR-004 · an operator with the recovery permission cancels, attributed to ADMIN', async () => {
    const { orderId } = await aStalledOrder();

    const result = await call('POST', `/admin/order-recoveries/${orderId}/cancel`, operatorToken, {
      reason: 'Merchant unreachable for 25 hours.',
    });

    expect(result.status).toBe(201);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe(OrderStatus.CANCELLED);
    // Founder ruling: ADMIN for operator AND automatic recovery alike.
    expect(order.cancelledBy).toBe('ADMIN');
    expect(order.cancellationReason).toBe('Merchant unreachable for 25 hours.');

    // …and because the order cannot say a HUMAN did it, the case must.
    const data = result.body['data'] as { actions: Record<string, unknown>[]; status: string };
    const cancelAction = data.actions.find((action) => action['type'] === 'CANCEL_ORDER');
    expect(cancelAction?.['automatic']).toBe(false);
    expect(cancelAction?.['actorId']).toEqual(expect.any(String));
    // CASH owes nothing and needs no investigation, so the case is done.
    expect(data.status).toBe('CLOSED');
  }, 60_000);

  it('AOR-005 · the exception resolves as a consequence of the order moving', async () => {
    const { orderId } = await aStalledOrder();

    await call('POST', `/admin/order-recoveries/${orderId}/cancel`, operatorToken, {
      reason: 'Cancelled under recovery.',
    });

    // Existing behaviour, deliberately not reimplemented: transition() closes
    // open exceptions whenever the target status is not CONFIRMED.
    const exception = await prisma.orderException.findFirstOrThrow({ where: { orderId } });
    expect(exception.status).toBe(OrderExceptionStatus.RESOLVED);
    expect(exception.resolvedStatus).toBe(OrderStatus.CANCELLED);
  }, 60_000);

  it('AOR-006 · cancelling twice is refused and cancels nothing a second time', async () => {
    const { orderId } = await aStalledOrder();

    const first = await call('POST', `/admin/order-recoveries/${orderId}/cancel`, operatorToken, {
      reason: 'first',
    });
    const second = await call('POST', `/admin/order-recoveries/${orderId}/cancel`, operatorToken, {
      reason: 'second',
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    // The first reason stands; the second attempt overwrote nothing.
    expect(order.cancellationReason).toBe('first');
    const actions = await prisma.orderRecoveryAction.count({
      where: { recovery: { orderId }, type: 'CANCEL_ORDER' },
    });
    expect(actions).toBe(1);
  }, 60_000);

  it('AOR-007 · an order that is no longer stalled is refused', async () => {
    // REVALIDATION. The merchant accepted between the operator opening the
    // queue and pressing cancel.
    const { orderId } = await aStalledOrder();
    await prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.PREPARING },
    });

    const result = await call('POST', `/admin/order-recoveries/${orderId}/cancel`, operatorToken, {
      reason: 'too late',
    });

    expect(result.status).toBe(409);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe(OrderStatus.PREPARING);
    expect(order.cancelledAt).toBeNull();
  }, 60_000);

  it('AOR-008 · an order with no open stalled exception is refused', async () => {
    const { orderId } = await aStalledOrder();
    await prisma.orderException.updateMany({
      where: { orderId },
      data: { status: OrderExceptionStatus.RESOLVED, resolvedAt: new Date() },
    });

    const result = await call('POST', `/admin/order-recoveries/${orderId}/cancel`, operatorToken, {
      reason: 'no exception',
    });

    expect(result.status).toBe(409);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe(
      OrderStatus.CONFIRMED,
    );
  }, 60_000);

  it('AOR-010 · a case predating the implementation cannot be cancelled from the queue', async () => {
    // Founder ruling: a pre-existing case reaches a recovery action only
    // through an explicitly authorised path. Recognition leaves the order
    // stalled and cancellable in every other respect, so without this guard an
    // operator opening the queue could cancel it as a side effect — which is
    // exactly what the ruling forbids for DPX-20260911-F7GK1S.
    const { orderId } = await aStalledOrder();
    await prisma.orderRecovery.create({
      data: {
        orderId,
        trigger: 'OPERATOR',
        paymentMethodAtOpen: OrderPaymentMethod.CASH,
        paymentStatusAtOpen: PaymentStatus.PENDING,
        predatesRecoveryImplementation: true,
      },
    });

    const result = await call('POST', `/admin/order-recoveries/${orderId}/cancel`, operatorToken, {
      reason: 'should need explicit authorisation',
    });

    expect(result.status).toBe(409);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe(OrderStatus.CONFIRMED);
    expect(order.cancelledAt).toBeNull();
  }, 60_000);

  it('AOR-009 · a cancellation without a reason is refused', async () => {
    const { orderId } = await aStalledOrder();

    const result = await call('POST', `/admin/order-recoveries/${orderId}/cancel`, operatorToken, {
      reason: '',
    });

    // The order is attributed to ADMIN, so an unexplained platform
    // cancellation would leave nobody able to say why it happened.
    expect(result.status).toBe(400);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe(
      OrderStatus.CONFIRMED,
    );
  }, 60_000);

  it('AOR-011 · admin:orders:read alone CANNOT reverse a wallet payment', async () => {
    const { orderId } = await aStalledOrder();

    const result = await call(
      'POST',
      `/admin/order-recoveries/${orderId}/reverse-wallet`,
      readerToken,
    );

    // The RBAC boundary on the route that moves money. Driven through the real
    // guard, because a decorator assertion would pass even if the guard were
    // never wired.
    expect(result.status).toBe(403);
    expect(
      await prisma.walletLedgerEntry.count({
        where: { referenceType: 'order_refund', referenceId: orderId },
      }),
    ).toBe(0);
  }, 60_000);

  it('AOR-012 · the reverse-wallet route is reachable and enforces cancel-first', async () => {
    const { orderId } = await aStalledOrder();
    // A case must exist for the cancel-first guard to be the one that answers;
    // without it the earlier "no recovery case" refusal fires instead. The
    // order itself is still CONFIRMED, which is what this asserts against.
    await prisma.orderRecovery.create({
      data: {
        orderId,
        trigger: 'OPERATOR',
        paymentMethodAtOpen: OrderPaymentMethod.WALLET,
        paymentStatusAtOpen: PaymentStatus.PAID,
      },
    });

    const result = await call(
      'POST',
      `/admin/order-recoveries/${orderId}/reverse-wallet`,
      operatorToken,
    );

    // MAPPED IS NOT REACHABLE. A literal segment swallowed by an earlier
    // parameterised route answers 400 with a UUID-parse body; this reads the
    // BODY to prove the recovery handler answered. The order here is still
    // CONFIRMED, so the correct answer is the cancel-first refusal — a 409
    // carrying that reason is proof of which handler ran.
    expect(result.status).toBe(409);
    expect(JSON.stringify(result.body)).toMatch(/must be cancelled through recovery/i);
    expect(JSON.stringify(result.body)).not.toMatch(/uuid/i);
  }, 60_000);

  it('AOR-013 · a historical case does NOT appear in the operator queue', async () => {
    const { orderId } = await aStalledOrder();
    await prisma.orderRecovery.create({
      data: {
        orderId,
        trigger: 'HISTORICAL',
        paymentMethodAtOpen: OrderPaymentMethod.CASH,
        paymentStatusAtOpen: PaymentStatus.PENDING,
        predatesRecoveryImplementation: true,
      },
    });

    // THE REGRESSION FOR THE INCREMENT 1 DEFECT, driven over the real filter
    // path rather than asserted against the enum. Historical recognition was
    // recorded as trigger = OPERATOR while leaving openedById null — one row
    // making two contradictory claims about who started the case — and this
    // filter is where it leaked into view. An operator reviewing their own
    // queue must not be shown migration bookkeeping.
    const operatorQueue = await call(
      'GET',
      '/admin/order-recoveries?trigger=OPERATOR&pageSize=100',
      readerToken,
    );
    expect(operatorQueue.status).toBe(200);
    const operatorItems = (operatorQueue.body['data'] as { items: { orderId: string }[] }).items;
    expect(operatorItems.some((item) => item.orderId === orderId)).toBe(false);

    // And it IS reachable under its own trigger, so recognising a case files it
    // rather than hiding it.
    const historicalQueue = await call(
      'GET',
      '/admin/order-recoveries?trigger=HISTORICAL&pageSize=100',
      readerToken,
    );
    expect(historicalQueue.status).toBe(200);
    const historicalItems = (historicalQueue.body['data'] as { items: { orderId: string }[] })
      .items;
    expect(historicalItems.some((item) => item.orderId === orderId)).toBe(true);
  }, 60_000);
});
