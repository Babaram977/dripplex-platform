import { randomUUID } from 'node:crypto';

import { Test } from '@nestjs/testing';
import { PrismaClient, ProductStatus, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { AppConfigService } from '../config/app-config.service';

import { CONFLICT_TYPE } from './catalogue-ingestion.constants';

import type { INestApplication } from '@nestjs/common';

/**
 * 8B — catalogue push and stock push, over real HTTP.
 *
 * Deliberately small. The two DB specs in this module already carry twenty-four
 * assertions covering absolute-quantity semantics, movement snapshots,
 * previousQuantity, reserved, the negative clamp, batch replay,
 * duplicate-in-batch, concurrent serialisation, archived mappings, deleted
 * products and cross-merchant isolation. Re-expressing those over HTTP would
 * add cost and no information.
 *
 * HTTP proves exactly one class of thing they cannot: that a request reaches
 * the intended handler, through the right guard, at the right scope, and comes
 * back with the documented status and body. That is what has never been tested
 * here, and it is what let two defects ship.
 *
 * Sequential because the domain is: a stock push needs a ProductSync with a
 * productId, and the honest way to get one is to push a catalogue first rather
 * than manufacture a mapping state no merchant could produce.
 */

const databaseUrl = process.env['DATABASE_URL'] ?? '';
// Module-load choice, matching 8A: no database reports SKIPPED, never PASSED.
const suite = databaseUrl === '' ? describe.skip : describe;

suite('POS catalogue and inventory over HTTP (8B)', () => {
  let prisma: PrismaClient;
  let app: INestApplication;
  let baseUrl: string;

  const password = 'Password1!';
  const roleName = `pos-cat-inv-${randomUUID().slice(0, 8)}`;
  let roleId = '';

  const userIds: string[] = [];
  const profileIds: string[] = [];
  const integrationIds: string[] = [];
  let categoryId = '';

  // Merchant A drives the journey; merchant B exists so the isolation
  // assertion is against a real neighbour rather than a fabricated id.
  let tokenA = '';
  let tokenB = '';
  let integrationA = ''; // catalog:write + inventory:write
  let integrationB = ''; // merchant B, for the boundary test
  let integrationC = ''; // catalog:write ONLY — the scope refusals
  let keyA = '';
  let keyC = '';

  const MAPPED_CATEGORY = 'Fast Food';
  const skuMapped = `SKU-MAPPED-${randomUUID().slice(0, 8)}`;
  const skuUnmapped = `SKU-UNMAPPED-${randomUUID().slice(0, 8)}`;
  const batchKey = randomUUID();

  let callerSeq = 0;
  const nextCaller = (): string =>
    `198.51.100.${String((callerSeq += 1) % 240)}:${String(callerSeq)}`;

  type Init = Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };

  /**
   * The product a SKU mapped to, refusing the not-yet-linked state rather than
   * casting past it. A ProductSync with a null productId is SKU_NOT_LINKED —
   * an interrupted catalogue batch — which is a real failure here, not a
   * type inconvenience.
   */
  async function productForSku(
    integrationId: string,
    externalSku: string,
  ): Promise<Awaited<ReturnType<PrismaClient['product']['findUniqueOrThrow']>>> {
    const sync = await prisma.productSync.findFirstOrThrow({
      where: { integrationId, externalSku },
    });
    const productId = sync.productId;
    if (productId === null) {
      throw new Error(`ProductSync for ${externalSku} carries no productId (SKU_NOT_LINKED)`);
    }
    return await prisma.product.findUniqueOrThrow({ where: { id: productId } });
  }

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

  const asPos = (path: string, id: string, key: string, init: Init = {}): Promise<Response> =>
    fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        'x-integration-id': id,
        'x-integration-key': key,
        'x-forwarded-for': nextCaller(),
        ...(init.headers ?? {}),
      },
    });

  async function makeMerchant(): Promise<{ token: string; userId: string }> {
    const email = `pos-8b-${randomUUID()}@example.com`;
    const merchantRole = await prisma.role.findUniqueOrThrow({ where: { name: 'merchant' } });
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 10),
        firstName: 'POS',
        lastName: 'Catalogue',
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: new Date(),
        roles: { create: [{ roleId: merchantRole.id }, { roleId }] },
      },
    });
    userIds.push(user.id);

    // Product.merchantId is an FK to MerchantProfile.id, bridged from the
    // integration's user id by MerchantProfileResolver. Creating an integration
    // needs no profile; ingesting a catalogue through one does — 8A established
    // this the hard way. Nothing further is required: createProductForMerchant
    // checks category and brand existence only, never merchant status, business
    // or KYC.
    const profile = await prisma.merchantProfile.create({ data: { userId: user.id } });
    profileIds.push(profile.id);

    const login = await fetch(`${baseUrl}/auth/login/merchant`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': nextCaller() },
      body: JSON.stringify({ email, password }),
    });
    const body = (await login.json()) as { data?: { accessToken?: string } };
    if (login.status !== 200 || typeof body.data?.accessToken !== 'string') {
      throw new Error(
        `Merchant login failed: HTTP ${String(login.status)} ${JSON.stringify(body).slice(0, 300)}`,
      );
    }
    return { token: body.data.accessToken, userId: user.id };
  }

  /**
   * An integration and the credential DrippleX generates for it.
   *
   * The workaround this used to carry — discard the returned apiKey, then issue
   * a merchant-chosen INCOMING_API_KEY through the legacy route — is gone: the
   * generated credential now authenticates, which is the whole point of the
   * correction. Scopes are narrowed on the stored row where a test needs less
   * than the six defaults, because P5 refuses a second live credential.
   */
  async function makeIntegration(
    token: string,
    name: string,
    scopes?: string[],
  ): Promise<{ id: string; key: string }> {
    const created = await asMerchant(token, '/integrations', {
      method: 'POST',
      body: JSON.stringify({ vendorName: name }),
    });
    const body = (await created.json()) as Record<string, unknown>;
    const id = body['integrationId'] as string;
    const key = body['apiKey'] as string;
    integrationIds.push(id);

    if (scopes) {
      await prisma.integrationCredential.updateMany({
        where: { integrationId: id, credentialType: 'INCOMING_API_KEY' },
        data: { scopes },
      });
    }
    return { id, key };
  }

  const priorMerchantModule = process.env['MERCHANT_MODULE_ENABLED'];

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();

    // Merchant-facing integrations routes now sit behind
    // MerchantModuleEnabledGuard (founder ruling 2026-09-14), and this suite
    // sets its fixtures up through those routes — so it must run as a merchant
    // whose module is on. POS ingestion's independence from the flag is proved
    // separately, in merchant-module-guard-off.http.spec.ts.
    process.env['MERCHANT_MODULE_ENABLED'] = 'true';

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
      create: { code: 'integrations:read', description: 'POS 8B HTTP proof' },
    });
    const write = await prisma.permission.upsert({
      where: { code: 'integrations:write' },
      update: {},
      create: { code: 'integrations:write', description: 'POS 8B HTTP proof' },
    });
    await prisma.role.upsert({
      where: { name: 'merchant' },
      update: {},
      create: { name: 'merchant', description: 'Merchant (POS 8B HTTP proof)' },
    });
    const grantRole = await prisma.role.create({
      data: { name: roleName, description: 'POS 8B HTTP proof' },
    });
    roleId = grantRole.id;
    await prisma.rolePermission.createMany({
      data: [
        { roleId: grantRole.id, permissionId: read.id },
        { roleId: grantRole.id, permissionId: write.id },
      ],
    });

    const merchantA = await makeMerchant();
    const merchantB = await makeMerchant();
    tokenA = merchantA.token;
    tokenB = merchantB.token;

    const a = await makeIntegration(tokenA, 'Acme POS A');
    integrationA = a.id;
    keyA = a.key;
    const c = await makeIntegration(tokenA, 'Acme POS C', ['catalog:write']);
    integrationC = c.id;
    keyC = c.key;
    integrationB = (await makeIntegration(tokenB, 'Rival POS B')).id;

    // Category.slug is globally unique, so it is generated per run rather than
    // fixed — a fixed slug collides with the previous run's leftovers.
    const category = await prisma.category.create({
      data: { name: 'Fast Food (8B)', slug: `fast-food-8b-${randomUUID().slice(0, 8)}` },
    });
    categoryId = category.id;

    // Mapping is merchant-facing (JWT), not a POS capability: a POS may never
    // create a DrippleX category. Matching is verbatim and case-sensitive.
    const mapped = await asMerchant(tokenA, `/integrations/catalogue/mappings/${integrationA}`, {
      method: 'PUT',
      body: JSON.stringify({ externalCategoryName: MAPPED_CATEGORY, categoryId }),
    });
    if (mapped.status !== 200) {
      throw new Error(`Category mapping failed: HTTP ${String(mapped.status)}`);
    }
  }, 180_000);

  /**
   * Best-effort cleanup: one failing delete must not abandon the rest.
   *
   * This is not tidiness. An earlier run of this suite threw partway through
   * afterAll — a product could not be deleted because a CartItem still
   * referenced it — and every later delete was skipped, leaving orders,
   * products and unassigned DeliveryJob rows in the shared test database. A
   * later full-suite run then showed six failures in rides and delivery
   * dispatch that had nothing to do with the code under test: dispatch-flow
   * asserts on "the waiting delivery", singular, and there were four strays.
   * Diagnosing that cost far more than this guard does.
   */
  const tidy = async (what: string, fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn();
    } catch (error) {
      console.warn(
        `cleanup: ${what} failed — ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  afterAll(async () => {
    if (databaseUrl === '') return;
    await tidy('inventoryUpdate', () =>
      prisma.inventoryUpdate.deleteMany({ where: { integrationId: { in: integrationIds } } }),
    );
    await tidy('productSync', () =>
      prisma.productSync.deleteMany({ where: { integrationId: { in: integrationIds } } }),
    );
    await tidy('integrationConflict', () =>
      prisma.integrationConflict.deleteMany({
        where: { integrationId: { in: integrationIds } },
      }),
    );
    await tidy('integrationLog', () =>
      prisma.integrationLog.deleteMany({ where: { integrationId: { in: integrationIds } } }),
    );
    await tidy('catalogSyncJob', () =>
      prisma.catalogSyncJob.deleteMany({ where: { integrationId: { in: integrationIds } } }),
    );
    await tidy('categoryMapping', () =>
      prisma.categoryMapping.deleteMany({ where: { integrationId: { in: integrationIds } } }),
    );
    await tidy('integrationCredential', () =>
      prisma.integrationCredential.deleteMany({
        where: { integrationId: { in: integrationIds } },
      }),
    );
    await tidy('merchantIntegration', () =>
      prisma.merchantIntegration.deleteMany({ where: { id: { in: integrationIds } } }),
    );
    await tidy('product', () =>
      prisma.product.deleteMany({ where: { merchantId: { in: profileIds } } }),
    );
    await tidy('category', () => prisma.category.deleteMany({ where: { id: categoryId } }));
    await tidy('merchantProfile', () =>
      prisma.merchantProfile.deleteMany({ where: { userId: { in: userIds } } }),
    );
    await tidy('rolePermission', () => prisma.rolePermission.deleteMany({ where: { roleId } }));
    await tidy('userRole', () =>
      prisma.userRole.deleteMany({ where: { userId: { in: userIds } } }),
    );
    await tidy('user', () => prisma.user.deleteMany({ where: { id: { in: userIds } } }));
    await tidy('role', () => prisma.role.deleteMany({ where: { id: roleId } }));
    await app.close();
    if (priorMerchantModule === undefined) {
      delete process.env['MERCHANT_MODULE_ENABLED'];
    } else {
      process.env['MERCHANT_MODULE_ENABLED'] = priorMerchantModule;
    }

    await prisma.$disconnect();
  }, 60_000);

  // ── catalogue ─────────────────────────────────────────────────────────

  it('E2E-019 · a catalogue push returns 200 and the documented envelope', async () => {
    const response = await asPos('/integrations/catalogue/sync', integrationA, keyA, {
      method: 'POST',
      body: JSON.stringify({
        // The catalogue's idempotency key is a BODY field. Inventory's and
        // orders' travel in the Idempotency-Key header. Both are as their
        // tickets specify; the inconsistency is real and belongs in the
        // OpenAPI correction rather than being smoothed over here.
        idempotencyKey: batchKey,
        items: [
          {
            externalSku: skuMapped,
            name: 'Jollof Rice',
            price: 3500,
            categoryName: MAPPED_CATEGORY,
          },
          {
            externalSku: skuUnmapped,
            name: 'Chapman',
            price: 1200,
            categoryName: 'Nothing Maps Here',
          },
        ],
      }),
    });
    const body = (await response.json()) as { success?: boolean; data?: Record<string, unknown> };

    // 200, not 201 and not 202: the work is finished when the response is
    // written, and 202 would promise a later result that never arrives.
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(typeof body.data?.['jobId']).toBe('string');
    expect(body.data?.['productCount']).toBe(2);
    expect(body.data?.['failedCount']).toBe(0);
    expect(body.data?.['replayed']).toBe(false);
  });

  /**
   * The one that stops `productCount: 2` being mistaken for success.
   *
   * A merchant pushing a catalogue sees COMPLETED, N products, 0 failed — and
   * every product lands DRAFT, because autoPublish is per-integration and off
   * unless `metadata.autoPublish === true`. That is deliberate (decision #7: a
   * first-time POS connection must not publish an unreviewed catalogue to
   * customers). Counting rows alone would never notice, so the status and the
   * category are asserted, not the count.
   */
  it('E2E-022 · the product lands under the right merchant, DRAFT, and categorised', async () => {
    const product = await productForSku(integrationA, skuMapped);
    expect(profileIds).toContain(product.merchantId);
    expect(product.status).toBe(ProductStatus.DRAFT);
    expect(product.categoryId).toBe(categoryId);
  });

  it('E2E-026 · an unmapped category leaves the product uncategorised and raises a conflict', async () => {
    const product = await productForSku(integrationA, skuUnmapped);
    // Ingested, not rejected: a stock count carries no category, and refusing
    // the item would lose the product over a mapping the merchant can add.
    expect(product.categoryId).toBeNull();

    const conflicts = await prisma.integrationConflict.findMany({
      where: { integrationId: integrationA, conflictType: CONFLICT_TYPE.CATEGORY_UNMAPPED },
    });
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0]?.status).toBe('OPEN');

    // E2E-027 — that this OPEN conflict is reachable through any supported
    // operational surface — is NOT asserted here, because no such surface
    // exists. Three services write IntegrationConflict and nothing in the
    // codebase reads or resolves one. Recorded as a production-readiness gap
    // rather than closed by inventing an endpoint to make the matrix green.
  });

  it('E2E-023 · replaying the batch key re-applies nothing', async () => {
    const before = await prisma.productSync.count({ where: { integrationId: integrationA } });

    const response = await asPos('/integrations/catalogue/sync', integrationA, keyA, {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: batchKey,
        items: [
          {
            externalSku: skuMapped,
            name: 'Jollof Rice',
            price: 3500,
            categoryName: MAPPED_CATEGORY,
          },
        ],
      }),
    });
    const body = (await response.json()) as { data?: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(body.data?.['replayed']).toBe(true);
    expect(await prisma.productSync.count({ where: { integrationId: integrationA } })).toBe(before);
  });

  it('E2E-021 · an invalid credential cannot push a catalogue', async () => {
    const response = await asPos('/integrations/catalogue/sync', integrationA, 'wrong-secret', {
      method: 'POST',
      body: JSON.stringify({
        idempotencyKey: randomUUID(),
        items: [{ externalSku: 'X', name: 'X', price: 1 }],
      }),
    });
    expect(response.status).toBe(401);
  });

  // ── inventory ─────────────────────────────────────────────────────────

  it('E2E-028/031 · a stock push follows the catalogue-created mapping', async () => {
    const response = await asPos('/integrations/inventory/sync', integrationA, keyA, {
      method: 'PUT',
      headers: { 'idempotency-key': randomUUID() },
      body: JSON.stringify({ items: [{ externalSku: skuMapped, quantity: 42 }] }),
    });
    const body = (await response.json()) as { data?: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(body.data?.['appliedCount']).toBe(1);
    const items = body.data?.['items'] as { status: string; newQuantity?: number }[];
    expect(items[0]?.status).toBe('APPLIED');
    // Absolute, not a delta. The DB spec owns the movement semantics; this
    // asserts only that the absolute value survives the wire.
    expect(items[0]?.newQuantity).toBe(42);
  });

  it('E2E-030 · an invalid credential cannot push stock', async () => {
    const response = await asPos('/integrations/inventory/sync', integrationA, 'wrong-secret', {
      method: 'PUT',
      headers: { 'idempotency-key': randomUUID() },
      body: JSON.stringify({ items: [{ externalSku: skuMapped, quantity: 1 }] }),
    });
    expect(response.status).toBe(401);
  });

  it.failing(
    'E2E-020/029 · a credential without the scope is refused as 403, not 401 [PENDING B6]',
    async () => {
      // integrationC holds catalog:write and not inventory:write. Today the
      // guard answers 401 for both a wrong secret and a missing scope, so a POS
      // integrator cannot tell "your key is wrong" from "your key may not do
      // this". Flips to it() with B6.
      const response = await asPos('/integrations/inventory/sync', integrationC, keyC, {
        method: 'PUT',
        headers: { 'idempotency-key': randomUUID() },
        body: JSON.stringify({ items: [{ externalSku: skuMapped, quantity: 1 }] }),
      });
      expect(response.status).toBe(403);
    },
  );

  it('E2E-038 · one merchant cannot read another integration’s stock levels', async () => {
    // Merchant B holds a valid JWT with integrations:read and asks for merchant
    // A's integration by id. Ownership is checked before anything is read, so
    // this cannot be used to enumerate a neighbour's stock.
    const response = await asMerchant(tokenB, `/integrations/inventory/levels/${integrationA}`);
    expect(response.status).toBe(403);

    // And the reverse, so the refusal is a boundary rather than one merchant
    // happening to be privileged: A cannot read B's integration either.
    const reverse = await asMerchant(tokenA, `/integrations/inventory/levels/${integrationB}`);
    expect(reverse.status).toBe(403);

    // And the same route answers merchant A for their own integration, so the
    // refusal above is a boundary and not a broken route.
    const own = await asMerchant(tokenA, `/integrations/inventory/levels/${integrationA}`);
    expect(own.status).toBe(200);
    const body = (await own.json()) as {
      data?: { externalSku: string; quantity: number | null }[];
    };
    expect(body.data?.some((level) => level.externalSku === skuMapped)).toBe(true);
  });
});
