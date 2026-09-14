import { randomUUID } from 'node:crypto';

import { Test } from '@nestjs/testing';
import { MerchantStatus, PrismaClient, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { AppConfigService } from '../config/app-config.service';

import { CONFLICT_TYPE } from './catalogue-ingestion.constants';
import { ACKNOWLEDGEMENT_TEXT } from './services/integration-conflicts.service';

import type { INestApplication } from '@nestjs/common';

/**
 * Merchant Connect increment 1 — the conflict reader and acknowledge-only
 * resolution, over real HTTP.
 *
 * `IntegrationConflict` had three writers and no reader. Catalogue ingestion,
 * inventory ingestion and order sync all recorded conflicts into a table
 * nothing could list, so a merchant whose catalogue arrived miscategorised was
 * told the sync COMPLETED and the one signal saying otherwise was written
 * somewhere they could never look.
 *
 * The load-bearing assertion here is MC-011: acknowledging changes the conflict
 * row and writes an audit record, and touches nothing else. Acknowledgement is
 * not remediation — what the right remedy is differs per conflict type and each
 * needs its own ruling.
 */

const databaseUrl = process.env['DATABASE_URL'] ?? '';
const suite = databaseUrl === '' ? describe.skip : describe;

/** The exact key set a merchant may see of a conflict. */
const CONFLICT_KEYS = [
  'id',
  'conflictType',
  'externalId',
  'dripplexValue',
  'externalValue',
  'status',
  'resolution',
  'resolvedAt',
  'createdAt',
].sort();

suite('Merchant Connect conflicts over HTTP (MC)', () => {
  let prisma: PrismaClient;
  let app: INestApplication;
  let baseUrl: string;

  const password = 'Password1!';
  const writeRoleName = `mc-rw-${randomUUID().slice(0, 8)}`;
  let writeRoleId = '';

  const userIds: string[] = [];
  const profileIds: string[] = [];
  const integrationIds: string[] = [];
  const productIds: string[] = [];

  let tokenA = '';
  let tokenB = '';
  let integrationA = '';
  let integrationB = '';

  let callerSeq = 0;
  const nextCaller = (): string =>
    `198.18.0.${String((callerSeq += 1) % 240)}:${String(callerSeq)}`;

  type Init = Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };
  const asMerchant = (token: string, path: string, init: Init = {}): Promise<Response> =>
    fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        'x-forwarded-for': nextCaller(),
        ...(init.headers ?? {}),
      },
    });

  async function makeMerchant(roleId: string): Promise<{ token: string; integrationId: string }> {
    const email = `mc-${randomUUID()}@example.com`;
    const merchantRole = await prisma.role.findUniqueOrThrow({ where: { name: 'merchant' } });
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 10),
        firstName: 'MC',
        lastName: 'Merchant',
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: new Date(),
        roles: { create: [{ roleId: merchantRole.id }, { roleId }] },
      },
    });
    userIds.push(user.id);
    const profile = await prisma.merchantProfile.create({
      data: { userId: user.id, status: MerchantStatus.APPROVED },
    });
    profileIds.push(profile.id);

    const login = await fetch(`${baseUrl}/auth/login/merchant`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': nextCaller() },
      body: JSON.stringify({ email, password }),
    });
    const body = (await login.json()) as { data?: { accessToken?: string } };
    if (login.status !== 200 || typeof body.data?.accessToken !== 'string') {
      throw new Error(`login failed: HTTP ${String(login.status)}`);
    }

    const integration = await prisma.merchantIntegration.create({
      data: {
        merchantId: user.id,
        integrationName: 'MC POS',
        posProvider: 'CUSTOM',
        vendorName: 'MC',
      },
    });
    integrationIds.push(integration.id);

    // Real state for MC-011 to protect. Without a product there is nothing an
    // errant acknowledgement could damage, and the assertion would pass
    // vacuously — which is exactly what a mutation caught it doing.
    const product = await prisma.product.create({
      data: {
        merchantId: profile.id,
        name: `MC Product ${randomUUID().slice(0, 6)}`,
        slug: `mc-product-${randomUUID().slice(0, 8)}`,
        basePrice: 2500,
        inventory: { create: { quantity: 20 } },
      },
    });
    productIds.push(product.id);
    await prisma.productSync.create({
      data: {
        integrationId: integration.id,
        externalSku: `MC-SKU-${randomUUID().slice(0, 6)}`,
        productId: product.id,
        mappingStatus: 'ACTIVE',
      },
    });

    return { token: body.data.accessToken, integrationId: integration.id };
  }

  const makeConflict = async (
    integrationId: string,
    type: string = CONFLICT_TYPE.CATEGORY_UNMAPPED,
  ): Promise<{ id: string }> =>
    await prisma.integrationConflict.create({
      data: {
        integrationId,
        conflictType: type,
        externalId: `SKU-${randomUUID().slice(0, 6)}`,
        dripplexValue: 'uncategorised',
        externalValue: 'Fast Food',
      },
    });

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();

    const { AppModule } = await import('../app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    const config = app.get(AppConfigService);
    app.setGlobalPrefix(config.apiGlobalPrefix);
    await app.listen(0);
    baseUrl = `${(await app.getUrl()).replace('[::1]', '127.0.0.1')}/${config.apiGlobalPrefix}`;

    const read = await prisma.permission.upsert({
      where: { code: 'integrations:read' },
      update: {},
      create: { code: 'integrations:read', description: 'MC proof' },
    });
    const write = await prisma.permission.upsert({
      where: { code: 'integrations:write' },
      update: {},
      create: { code: 'integrations:write', description: 'MC proof' },
    });
    await prisma.role.upsert({
      where: { name: 'merchant' },
      update: {},
      create: { name: 'merchant', description: 'MC proof' },
    });

    const rw = await prisma.role.create({ data: { name: writeRoleName, description: 'MC proof' } });
    writeRoleId = rw.id;
    await prisma.rolePermission.createMany({
      data: [
        { roleId: rw.id, permissionId: read.id },
        { roleId: rw.id, permissionId: write.id },
      ],
    });
    const a = await makeMerchant(writeRoleId);
    const b = await makeMerchant(writeRoleId);
    tokenA = a.token;
    integrationA = a.integrationId;
    tokenB = b.token;
    integrationB = b.integrationId;
  }, 180_000);

  afterAll(async () => {
    if (databaseUrl === '') return;
    const tidy = async (what: string, fn: () => Promise<unknown>): Promise<void> => {
      try {
        await fn();
      } catch (error) {
        console.warn(
          `cleanup: ${what} — ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    };
    await tidy('conflicts', () =>
      prisma.integrationConflict.deleteMany({ where: { integrationId: { in: integrationIds } } }),
    );
    await tidy('logs', () =>
      prisma.integrationLog.deleteMany({ where: { integrationId: { in: integrationIds } } }),
    );
    await tidy('productSyncs', () =>
      prisma.productSync.deleteMany({ where: { integrationId: { in: integrationIds } } }),
    );
    await tidy('products', () => prisma.product.deleteMany({ where: { id: { in: productIds } } }));
    await tidy('integrations', () =>
      prisma.merchantIntegration.deleteMany({ where: { id: { in: integrationIds } } }),
    );
    await tidy('profiles', () =>
      prisma.merchantProfile.deleteMany({ where: { userId: { in: userIds } } }),
    );
    await tidy('rolePermissions', () =>
      prisma.rolePermission.deleteMany({ where: { roleId: writeRoleId } }),
    );
    await tidy('userRoles', () =>
      prisma.userRole.deleteMany({ where: { userId: { in: userIds } } }),
    );
    await tidy('users', () => prisma.user.deleteMany({ where: { id: { in: userIds } } }));
    await tidy('roles', () => prisma.role.deleteMany({ where: { id: writeRoleId } }));
    await app.close();
    await prisma.$disconnect();
  }, 60_000);

  it('MC-001/002 · a merchant lists their own conflicts, in the ruled shape', async () => {
    await makeConflict(integrationA);
    const response = await asMerchant(tokenA, `/integrations/conflicts/${integrationA}`);
    const body = (await response.json()) as {
      data: { items: Record<string, unknown>[]; total: number };
    };

    expect(response.status).toBe(200);
    expect(body.data.items.length).toBeGreaterThan(0);
    // Equality, not presence: sourceId and integrationId are deliberately absent.
    expect(Object.keys(body.data.items[0] ?? {}).sort()).toEqual(CONFLICT_KEYS);
  });

  it('MC-003 · the status filter narrows the list', async () => {
    const response = await asMerchant(
      tokenA,
      `/integrations/conflicts/${integrationA}?status=RESOLVED`,
    );
    const body = (await response.json()) as { data: { items: { status: string }[] } };
    expect(response.status).toBe(200);
    expect(body.data.items.every((c) => c.status === 'RESOLVED')).toBe(true);
  });

  it('MC-004 · page size is capped', async () => {
    const response = await asMerchant(
      tokenA,
      `/integrations/conflicts/${integrationA}?pageSize=5000`,
    );
    const body = (await response.json()) as { data: { pageSize: number } };
    expect(body.data.pageSize).toBe(50);
  });

  it('MC-005/006 · another merchant cannot list, and is refused before any read', async () => {
    const response = await asMerchant(tokenB, `/integrations/conflicts/${integrationA}`);
    // 403, not an empty 200: ownership is checked before the query runs, so a
    // guessed integration id reveals nothing about whether it holds conflicts.
    expect(response.status).toBe(403);
  });

  it('MC-007/014 · acknowledging records the fixed text plus a bounded note', async () => {
    const conflict = await makeConflict(integrationA);
    const response = await asMerchant(
      tokenA,
      `/integrations/conflicts/${conflict.id}/acknowledge`,
      {
        method: 'PATCH',
        body: JSON.stringify({ note: 'Mapped Fast Food to Meals' }),
      },
    );
    const body = (await response.json()) as { data: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(body.data['status']).toBe('RESOLVED');
    expect(body.data['resolution']).toBe(`${ACKNOWLEDGEMENT_TEXT}: Mapped Fast Food to Meals`);
    expect(body.data['resolvedAt']).not.toBeNull();
  });

  it('MC-014b · with no note it is the fixed text alone', async () => {
    const conflict = await makeConflict(integrationA);
    const response = await asMerchant(
      tokenA,
      `/integrations/conflicts/${conflict.id}/acknowledge`,
      {
        method: 'PATCH',
        body: JSON.stringify({}),
      },
    );
    const body = (await response.json()) as { data: Record<string, unknown> };
    expect(body.data['resolution']).toBe(ACKNOWLEDGEMENT_TEXT);
  });

  it('MC-008 · acknowledging twice is a conflict', async () => {
    const conflict = await makeConflict(integrationA);
    const first = await asMerchant(tokenA, `/integrations/conflicts/${conflict.id}/acknowledge`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    });
    expect(first.status).toBe(200);

    const second = await asMerchant(tokenA, `/integrations/conflicts/${conflict.id}/acknowledge`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    });
    expect(second.status).toBe(409);
  });

  it('MC-009 · another merchant cannot acknowledge — a conflict id is not a capability', async () => {
    const conflict = await makeConflict(integrationA);
    const response = await asMerchant(
      tokenB,
      `/integrations/conflicts/${conflict.id}/acknowledge`,
      {
        method: 'PATCH',
        body: JSON.stringify({}),
      },
    );
    expect(response.status).toBe(403);

    const after = await prisma.integrationConflict.findUniqueOrThrow({
      where: { id: conflict.id },
    });
    expect(after.status).toBe('OPEN');
  });

  it('MC-010 · a principal without integrations:write cannot acknowledge', async () => {
    // NOT a "read-only merchant" — there is no such thing. The RBAC seed grants
    // the shared `merchant` role BOTH integrations:read and integrations:write,
    // and a user must hold that role to log into the merchant portal at all. An
    // earlier version of this test built a merchant with a read-only grant and
    // passed in isolation, then failed in a full run the moment another suite
    // seeded RBAC and the shared role handed it write. It was asserting a state
    // that cannot exist in production.
    //
    // What is real, and what the route actually depends on, is that a principal
    // lacking integrations:write is refused. A customer is one.
    const email = `mc-nonmerchant-${randomUUID()}@example.com`;
    const customerRole = await prisma.role.upsert({
      where: { name: 'customer' },
      update: {},
      create: { name: 'customer', description: 'MC proof precondition' },
    });
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 10),
        firstName: 'MC',
        lastName: 'Customer',
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: new Date(),
        roles: { create: [{ roleId: customerRole.id }] },
      },
    });
    userIds.push(user.id);

    const login = await fetch(`${baseUrl}/auth/login/customer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': nextCaller() },
      body: JSON.stringify({ email, password }),
    });
    const body = (await login.json()) as { data?: { accessToken?: string } };
    if (login.status !== 200 || typeof body.data?.accessToken !== 'string') {
      throw new Error(`customer login failed: HTTP ${String(login.status)}`);
    }

    const conflict = await makeConflict(integrationA);
    const response = await asMerchant(
      body.data.accessToken,
      `/integrations/conflicts/${conflict.id}/acknowledge`,
      { method: 'PATCH', body: JSON.stringify({}) },
    );
    expect(response.status).toBe(403);

    const after = await prisma.integrationConflict.findUniqueOrThrow({
      where: { id: conflict.id },
    });
    expect(after.status).toBe('OPEN');
  });

  /**
   * The assertion the increment exists to guarantee.
   *
   * Acknowledgement is not remediation. The conflict row and its audit record
   * are the only intended writes; product, mapping, inventory, price, SKU,
   * order and wallet state must be untouched.
   */
  it('MC-011 · acknowledging mutates the conflict and the audit log, and nothing else', async () => {
    const conflict = await makeConflict(integrationA);
    // Counts alone are not enough, and a mutation proved it: an in-place
    // update changes no count, so a snapshot of counts would pass while a
    // price, SKU or mapping was rewritten underneath it. Every table that
    // carries @updatedAt is fingerprinted by its latest value as well.
    const snapshot = async (): Promise<Record<string, string>> => {
      const [products, syncs, mappings, inventory, orders, wallets, ledger] = await Promise.all([
        prisma.product.aggregate({ _count: true, _max: { updatedAt: true } }),
        prisma.productSync.aggregate({ _count: true, _max: { updatedAt: true } }),
        prisma.categoryMapping.aggregate({ _count: true, _max: { updatedAt: true } }),
        prisma.productInventory.aggregate({ _count: true, _max: { updatedAt: true } }),
        prisma.order.aggregate({ _count: true, _max: { updatedAt: true } }),
        prisma.wallet.count(),
        prisma.walletLedgerEntry.count(),
      ]);
      const fp = (a: { _count: number; _max: { updatedAt: Date | null } }): string =>
        `${String(a._count)}@${a._max.updatedAt?.toISOString() ?? 'none'}`;
      return {
        products: fp(products),
        syncs: fp(syncs),
        mappings: fp(mappings),
        inventory: fp(inventory),
        orders: fp(orders),
        wallets: String(wallets),
        ledger: String(ledger),
      };
    };

    const before = await snapshot();
    const auditBefore = await prisma.auditLog.count({
      where: { action: 'integration.conflict_acknowledged' },
    });

    const response = await asMerchant(
      tokenA,
      `/integrations/conflicts/${conflict.id}/acknowledge`,
      {
        method: 'PATCH',
        body: JSON.stringify({}),
      },
    );
    expect(response.status).toBe(200);

    expect(await snapshot()).toEqual(before);
    // MC-015: the audit record is the one other intended write.
    expect(
      await prisma.auditLog.count({ where: { action: 'integration.conflict_acknowledged' } }),
    ).toBe(auditBefore + 1);
  });

  it('MC-012 · no customer identity or payment information is exposed', async () => {
    const response = await asMerchant(tokenA, `/integrations/conflicts/${integrationA}`);
    const text = await response.text();
    for (const forbidden of [
      'customerId',
      'paymentMethod',
      'paymentStatus',
      'deliveryAddress',
      'orderNumber',
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('MC-013 · a conflict raised by a real catalogue push is listable', async () => {
    // The loop this increment closes: written by ingestion, read by a merchant.
    const raised = await makeConflict(integrationB, CONFLICT_TYPE.CATEGORY_UNMAPPED);
    const response = await asMerchant(
      tokenB,
      `/integrations/conflicts/${integrationB}?status=OPEN`,
    );
    const body = (await response.json()) as {
      data: { items: { id: string; conflictType: string }[] };
    };

    expect(response.status).toBe(200);
    const found = body.data.items.find((c) => c.id === raised.id);
    expect(found?.conflictType).toBe(CONFLICT_TYPE.CATEGORY_UNMAPPED);
  });
});
