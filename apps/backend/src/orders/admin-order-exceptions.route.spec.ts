import { randomUUID } from 'node:crypto';

import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import {
  FulfillmentType,
  OrderExceptionStatus,
  OrderExceptionType,
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
 * DPX-ORDER-8D-C ops visibility — is `GET admin/orders/exceptions` REACHABLE?
 *
 * CLAUDE.md §5: "mapped is not reachable". `AdminOrdersController` already
 * declares `@Get(':id')` with a ParseUUIDPipe. Declared after it, `/exceptions`
 * is swallowed: Nest still logs the route as `Mapped`, the startup table still
 * lists it, and every request answers 400 because `'exceptions'` is not a UUID.
 * That is the exact defect class that shipped past a full green suite before.
 *
 * So this boots the real application on a real socket and reads the response
 * BODY to see which handler answered:
 *
 *   • the exceptions handler  → 200 with a `{ items, meta }` paginated envelope
 *   • `:id` having swallowed it → 400, uuid validation failure
 *
 * A status code alone would not separate them either, which is why the
 * assertions are on the body's shape.
 *
 * Note the guard/pipe ordering, because it rules out the cheaper test: Nest
 * runs guards BEFORE pipes, and both routes carry the same
 * `@RequirePermissions(ADMIN_READ)`. An unauthenticated probe therefore returns
 * 401 whichever route matched, and proves nothing at all. The request has to be
 * genuinely authorised, which is why this file builds a real user, a real role
 * grant and a real session rather than stubbing the guard.
 */
suite('DPX-ORDER-8D-C · admin/orders/exceptions reachability', () => {
  let app: INestApplication;
  let baseUrl: string;
  let prisma: PrismaClient;
  let token: string;

  const userIds: string[] = [];
  const orderIds: string[] = [];
  const merchantIds: string[] = [];
  const roleName = `ops-8dc-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();

    const { AppModule } = await import('../app.module');
    // No provider overrides, and in particular no stubbed guard: overriding the
    // auth pipeline would prove a request path that does not exist in
    // production, which is the failure this file exists to catch.
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication({ bufferLogs: true });
    const config = app.get(AppConfigService);
    app.setGlobalPrefix(config.apiGlobalPrefix);
    // Port 0 — the OS picks a free one, so this never collides with a dev
    // server or a parallel worker.
    await app.listen(0);
    const url = await app.getUrl();
    baseUrl = `${url.replace('[::1]', '127.0.0.1')}/${config.apiGlobalPrefix}`;

    // A role that holds exactly the permission the endpoint demands. The guard
    // reads permissions from the DATABASE via findByIdWithRbac, not from the
    // token, so the grant has to be real.
    // Read first, create only if genuinely absent, and treat a unique
    // violation as "someone else just created it".
    //
    // NOT an upsert: `prisma-migration-seed.spec.ts` runs seed-rbac, which
    // upserts this very permission code, and Prisma's upsert is a read
    // followed by a write rather than one atomic statement. Two of them racing
    // on the same unique key can raise P2002 in either suite. On a seeded
    // database this path now performs no write at all.
    const permission =
      (await prisma.permission.findUnique({ where: { code: 'admin:orders:read' } })) ??
      (await prisma.permission
        .create({ data: { code: 'admin:orders:read', description: 'Read orders (admin)' } })
        .catch(
          async () =>
            await prisma.permission.findUniqueOrThrow({ where: { code: 'admin:orders:read' } }),
        ));
    const role = await prisma.role.create({
      data: {
        name: roleName,
        description: '8D-C ops visibility route spec',
        permissions: { create: [{ permissionId: permission.id }] },
      },
    });

    const user = await prisma.user.create({
      data: {
        email: `ops-8dc-${randomUUID()}@dripplex.test`,
        passwordHash: 'x',
        firstName: 'Ops',
        lastName: 'Reader',
        status: UserStatus.ACTIVE,
        roles: { create: [{ roleId: role.id }] },
      },
    });
    userIds.push(user.id);

    // The JWT strategy insists on a live, unrevoked, unexpired session whose
    // portal matches the token's. 'operations' maps to OPERATIONS_CONSOLE —
    // this endpoint's actual caller.
    const session = await prisma.authSession.create({
      data: {
        userId: user.id,
        portal: RegistrationChannel.OPERATIONS_CONSOLE,
        expiresAt: new Date(Date.now() + 60 * 60_000),
      },
    });

    token = await app
      .get(JwtService)
      .signAsync(
        { sub: user.id, sid: session.id, role: roleName, portal: 'operations', typ: 'access' },
        { secret: config.jwtAccessSecret, expiresIn: '1h' },
      );
  }, 180_000);

  afterAll(async () => {
    await prisma.orderException.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.merchantProfile.deleteMany({ where: { id: { in: merchantIds } } });
    await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.role.deleteMany({ where: { name: roleName } });
    await app.close();
    await prisma.$disconnect();
  }, 60_000);

  async function get(path: string): Promise<{ status: number; body: Record<string, unknown> }> {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
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
        email: `m-8dc-${randomUUID()}@dripplex.test`,
        passwordHash: 'x',
        firstName: 'M',
        lastName: 'Owner',
      },
    });
    userIds.push(owner.id);
    const merchant = await prisma.merchantProfile.create({
      data: { userId: owner.id },
    });
    merchantIds.push(merchant.id);

    const customer = await prisma.user.create({
      data: {
        email: `c-8dc-${randomUUID()}@dripplex.test`,
        passwordHash: 'x',
        firstName: 'C',
        lastName: 'Buyer',
      },
    });
    userIds.push(customer.id);

    const confirmedAt = new Date(Date.now() - 90 * 60_000);
    const orderNumber = `DPX-8DC-${randomUUID().slice(0, 8).toUpperCase()}`;
    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        merchantId: merchant.id,
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PENDING,
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
        status: OrderExceptionStatus.OPEN,
        waitedMinutes: 90,
        detectedAt: new Date(),
      },
    });

    return { orderId: order.id, orderNumber };
  }

  it('AOE-001 · the route is reachable — :id does not swallow /exceptions', async () => {
    const result = await get('/admin/orders/exceptions');

    // THE ASSERTION THIS FILE EXISTS FOR. 400 here would mean ParseUUIDPipe
    // rejected the literal string 'exceptions' — i.e. the :id handler answered
    // and this endpoint is unreachable despite being Mapped.
    expect(result.status).not.toBe(400);
    expect(result.status).toBe(200);

    // And the BODY says which handler answered: a paginated envelope can only
    // have come from listOrderExceptions. getOrder returns a bare OrderDto.
    const data = result.body['data'] as { items?: unknown; meta?: unknown };
    expect(Array.isArray(data.items)).toBe(true);
    expect(data.meta).toEqual(
      expect.objectContaining({ page: 1, limit: 20, total: expect.any(Number) }),
    );
  }, 60_000);

  it('AOE-002 · returns a raised exception with its order inlined', async () => {
    const { orderId, orderNumber } = await aStalledOrder();

    const result = await get('/admin/orders/exceptions?status=OPEN&pageSize=100');

    expect(result.status).toBe(200);
    const items = (result.body['data'] as { items: Record<string, unknown>[] }).items;
    const mine = items.find((item) => item['orderId'] === orderId);
    expect(mine).toBeDefined();
    expect(mine?.['type']).toBe('STALLED_CONFIRMED');
    expect(mine?.['status']).toBe('OPEN');
    expect(mine?.['waitedMinutes']).toBe(90);
    // Inlined order, so the queue is triageable without a second request.
    const order = mine?.['order'] as Record<string, unknown>;
    expect(order['orderNumber']).toBe(orderNumber);
    expect(order['status']).toBe('CONFIRMED');
    expect(order['total']).toBe(1000);
  }, 60_000);

  it('AOE-003 · :id still answers for a real order id — the fix did not break it', async () => {
    const { orderId, orderNumber } = await aStalledOrder();

    // Declaring a literal above a parameterised route can shadow the wrong
    // things. This proves the ORIGINAL endpoint is intact.
    const result = await get(`/admin/orders/${orderId}`);

    expect(result.status).toBe(200);
    expect((result.body['data'] as Record<string, unknown>)['orderNumber']).toBe(orderNumber);
  }, 60_000);

  it('AOE-004 · an unknown filter value is rejected, not silently ignored', async () => {
    // A filter that quietly does nothing is worse than one that errors: the
    // operator believes they are looking at a filtered queue.
    const result = await get('/admin/orders/exceptions?status=NONSENSE');

    expect(result.status).toBe(400);
    // The MESSAGE, not just the status. Moving this route below `:id` also
    // produces a 400 — from ParseUUIDPipe rejecting the word 'exceptions' —
    // so asserting the code alone passes while the endpoint is unreachable.
    // Verified: that mutation leaves this test green unless the reason is
    // checked.
    const detail = JSON.stringify(result.body);
    expect(detail).toContain('OPEN, RESOLVED');
    expect(detail).not.toContain('uuid is expected');
  }, 60_000);

  it('AOE-005 · reading the queue mutates no exception and no order', async () => {
    const { orderId } = await aStalledOrder();
    const before = await prisma.orderException.findFirstOrThrow({ where: { orderId } });
    const orderBefore = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });

    // Asserted, because a read that 400s mutates nothing either — this test
    // would otherwise pass vacuously against an unreachable endpoint.
    const first = await get('/admin/orders/exceptions?status=OPEN&pageSize=100');
    const second = await get('/admin/orders/exceptions?status=OPEN&pageSize=100');
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const after = await prisma.orderException.findFirstOrThrow({ where: { orderId } });
    const orderAfter = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });

    // The founder constraint for this increment: it reads, and does nothing
    // else. An operator opening the queue must not resolve, re-notify or
    // otherwise move what they are looking at.
    expect(after.status).toBe(before.status);
    expect(after.notifiedAt).toEqual(before.notifiedAt);
    expect(after.resolvedAt).toBeNull();
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
    expect(orderAfter.status).toBe(orderBefore.status);
    expect(orderAfter.updatedAt.getTime()).toBe(orderBefore.updatedAt.getTime());
  }, 60_000);
});
