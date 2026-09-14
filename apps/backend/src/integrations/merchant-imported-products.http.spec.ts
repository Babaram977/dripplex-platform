import { randomUUID } from 'node:crypto';

import { Test } from '@nestjs/testing';
import { MerchantStatus, PrismaClient, ProductStatus, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { AppConfigService } from '../config/app-config.service';

import { MAX_IMPORTED_PRODUCT_PAGE_SIZE } from './services/imported-products.service';

import type { INestApplication } from '@nestjs/common';

/**
 * Merchant Connect — the imported-product reader, over real HTTP.
 *
 * The decisive assertion is MCP-002. Merchant Connect must answer "what did
 * *this* integration bring into my catalogue", which is a different question
 * from "what do I sell". `GET /merchant/products?status=DRAFT` answers the
 * second and would quietly mix in manually created drafts and other
 * integrations' imports — so the fixture deliberately contains a manual
 * product that must be ABSENT, not merely ordered differently.
 *
 * MCP-008 is the other load-bearing one: it drives the real publish endpoint
 * and re-reads through this one, proving the read surface and the existing
 * mutation agree. Nothing here introduces a new way to publish.
 */

const databaseUrl = process.env['DATABASE_URL'] ?? '';
const suite = databaseUrl === '' ? describe.skip : describe;

/** The exact key set a merchant may see of one imported product. */
const IMPORTED_KEYS = [
  'id',
  'externalSku',
  'productId',
  'productName',
  'price',
  'status',
  'publishedAt',
  'createdAt',
  'updatedAt',
].sort();

interface ImportedRow {
  id: string;
  externalSku: string;
  productId: string | null;
  productName: string | null;
  price: number | null;
  status: string | null;
  publishedAt: string | null;
}

suite('Merchant Connect imported products over HTTP (MCP)', () => {
  let prisma: PrismaClient;
  let app: INestApplication;
  let baseUrl: string;

  const password = 'Password1!';
  const roleName = `mcp-rw-${randomUUID().slice(0, 8)}`;
  let roleId = '';

  const userIds: string[] = [];
  const productIds: string[] = [];
  const integrationIds: string[] = [];

  let tokenA = '';
  let tokenB = '';
  let integrationA = '';
  let integrationB = '';
  let profileA = '';

  // Integration A's imports.
  let draftProductId = '';
  let publishedProductId = '';
  /** A manual product belonging to the same merchant, imported by nobody. */
  let manualProductId = '';

  let callerSeq = 0;
  const nextCaller = (): string =>
    `198.19.0.${String((callerSeq += 1) % 240)}:${String(callerSeq)}`;

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

  const listImported = async (
    token: string,
    integrationId: string,
    query = '',
  ): Promise<{
    status: number;
    data: { items: ImportedRow[]; total: number; page: number; pageSize: number };
  }> => {
    const response = await asMerchant(
      token,
      `/integrations/catalogue/products/${integrationId}${query}`,
    );
    const body = (await response.json()) as {
      data?: { items: ImportedRow[]; total: number; page: number; pageSize: number };
    };
    return {
      status: response.status,
      data: body.data ?? { items: [], total: 0, page: 0, pageSize: 0 },
    };
  };

  const makeProduct = async (merchantProfileId: string, status: ProductStatus): Promise<string> => {
    const product = await prisma.product.create({
      data: {
        merchantId: merchantProfileId,
        name: `MCP Product ${randomUUID().slice(0, 6)}`,
        slug: `mcp-product-${randomUUID().slice(0, 8)}`,
        basePrice: 1500,
        status,
        ...(status === ProductStatus.PUBLISHED ? { publishedAt: new Date() } : {}),
        inventory: { create: { quantity: 10 } },
      },
    });
    productIds.push(product.id);
    return product.id;
  };

  const linkSku = async (integrationId: string, productId: string | null): Promise<string> => {
    const sync = await prisma.productSync.create({
      data: {
        integrationId,
        externalSku: `MCP-SKU-${randomUUID().slice(0, 8)}`,
        productId,
        mappingStatus: 'ACTIVE',
      },
    });
    return sync.id;
  };

  async function makeMerchant(): Promise<{
    token: string;
    integrationId: string;
    profileId: string;
  }> {
    const email = `mcp-${randomUUID()}@example.com`;
    const merchantRole = await prisma.role.findUniqueOrThrow({ where: { name: 'merchant' } });
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 10),
        firstName: 'MCP',
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

    const login = await fetch(`${baseUrl}/auth/login/merchant`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': nextCaller() },
      body: JSON.stringify({ email, password }),
    });
    const body = (await login.json()) as { data?: { accessToken?: string } };
    if (login.status !== 200 || typeof body.data?.accessToken !== 'string') {
      throw new Error(`login failed: HTTP ${String(login.status)}`);
    }

    // MerchantIntegration.merchantId is the USER id here, while Product
    // .merchantId is the PROFILE id. They are different columns naming
    // different things; conflating them silently returns an empty catalogue.
    const integration = await prisma.merchantIntegration.create({
      data: {
        merchantId: user.id,
        integrationName: 'MCP POS',
        posProvider: 'CUSTOM',
        vendorName: 'MCP',
      },
    });
    integrationIds.push(integration.id);

    return { token: body.data.accessToken, integrationId: integration.id, profileId: profile.id };
  }

  const priorMerchantModule = process.env['MERCHANT_MODULE_ENABLED'];

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();

    // MerchantModuleEnabledGuard fronts every merchant-persona controller, so
    // MCP-008 cannot drive the real publish route with the flag off — it
    // answers 403 "The merchant module is not enabled" before the permission
    // check. merchant-products.service.spec calls the service directly and so
    // never meets this guard; this is the first spec to drive that route over
    // HTTP. Set before AppModule is imported, because config is read at init.
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
      create: { code: 'integrations:read', description: 'MCP proof' },
    });
    const write = await prisma.permission.upsert({
      where: { code: 'integrations:write' },
      update: {},
      create: { code: 'integrations:write', description: 'MCP proof' },
    });
    await prisma.role.upsert({
      where: { name: 'merchant' },
      update: {},
      create: { name: 'merchant', description: 'MCP proof' },
    });

    // Publishing is gated on merchant:products:manage, NOT on integrations:*.
    // Merchant Connect reads with one permission and mutates with another, so
    // the fixture must hold both or MCP-008 proves nothing about publishing.
    const manage = await prisma.permission.upsert({
      where: { code: 'merchant:products:manage' },
      update: {},
      create: { code: 'merchant:products:manage', description: 'MCP proof' },
    });

    const rw = await prisma.role.create({ data: { name: roleName, description: 'MCP proof' } });
    roleId = rw.id;
    await prisma.rolePermission.createMany({
      data: [
        { roleId: rw.id, permissionId: read.id },
        { roleId: rw.id, permissionId: write.id },
        { roleId: rw.id, permissionId: manage.id },
      ],
    });

    const a = await makeMerchant();
    const b = await makeMerchant();
    tokenA = a.token;
    integrationA = a.integrationId;
    profileA = a.profileId;
    tokenB = b.token;
    integrationB = b.integrationId;

    // The fixture the decision turns on: two imported, one manual.
    draftProductId = await makeProduct(profileA, ProductStatus.DRAFT);
    publishedProductId = await makeProduct(profileA, ProductStatus.PUBLISHED);
    manualProductId = await makeProduct(profileA, ProductStatus.DRAFT);
    await linkSku(integrationA, draftProductId);
    await linkSku(integrationA, publishedProductId);
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
    await tidy('productSyncs', () =>
      prisma.productSync.deleteMany({ where: { integrationId: { in: integrationIds } } }),
    );
    await tidy('logs', () =>
      prisma.integrationLog.deleteMany({ where: { integrationId: { in: integrationIds } } }),
    );
    await tidy('inventory', () =>
      prisma.productInventory.deleteMany({ where: { productId: { in: productIds } } }),
    );
    await tidy('products', () => prisma.product.deleteMany({ where: { id: { in: productIds } } }));
    await tidy('integrations', () =>
      prisma.merchantIntegration.deleteMany({ where: { id: { in: integrationIds } } }),
    );
    await tidy('profiles', () =>
      prisma.merchantProfile.deleteMany({ where: { userId: { in: userIds } } }),
    );
    await tidy('rolePermissions', () => prisma.rolePermission.deleteMany({ where: { roleId } }));
    await tidy('userRoles', () =>
      prisma.userRole.deleteMany({ where: { userId: { in: userIds } } }),
    );
    await tidy('users', () => prisma.user.deleteMany({ where: { id: { in: userIds } } }));
    await tidy('roles', () => prisma.role.deleteMany({ where: { id: roleId } }));
    await app.close();
    await prisma.$disconnect();
    if (priorMerchantModule === undefined) {
      delete process.env['MERCHANT_MODULE_ENABLED'];
    } else {
      process.env['MERCHANT_MODULE_ENABLED'] = priorMerchantModule;
    }
  }, 60_000);

  it('MCP-001 · the merchant reads their imported products in the ruled shape', async () => {
    const { status, data } = await listImported(tokenA, integrationA);

    expect(status).toBe(200);
    expect(data.items.length).toBe(2);
    // Equality, not presence: integrationId and mappingStatus are deliberately
    // absent — the caller supplied the first and cannot act on the second.
    expect(Object.keys(data.items[0] ?? {}).sort()).toEqual(IMPORTED_KEYS);
  });

  it('MCP-002 · shows this integration’s imports by publication state, and omits a manual product', async () => {
    const { data } = await listImported(tokenA, integrationA);
    const byProduct = new Map(data.items.map((row) => [row.productId, row]));

    // The draft is present and unpublished.
    expect(byProduct.get(draftProductId)?.status).toBe('DRAFT');
    expect(byProduct.get(draftProductId)?.publishedAt).toBeNull();

    // The published one is present and published.
    expect(byProduct.get(publishedProductId)?.status).toBe('PUBLISHED');
    expect(byProduct.get(publishedProductId)?.publishedAt).not.toBeNull();

    // The manual product is the whole point: same merchant, same DRAFT status,
    // imported by nobody. A screen built on /merchant/products?status=DRAFT
    // would show it. Merchant Connect must not.
    expect(byProduct.has(manualProductId)).toBe(false);
  });

  it('MCP-003 · carries the product name and price the merchant needs to decide', async () => {
    const { data } = await listImported(tokenA, integrationA);
    const row = data.items.find((r) => r.productId === draftProductId);

    expect(typeof row?.externalSku).toBe('string');
    expect(row?.externalSku).not.toBe('');
    expect(typeof row?.productName).toBe('string');
    // Decimal must cross the wire as a number, not "1500" or a Decimal object.
    expect(row?.price).toBe(1500);
  });

  it('MCP-004 · reports total, page and pageSize rather than a bare array', async () => {
    const { data } = await listImported(tokenA, integrationA);

    expect(data.total).toBe(2);
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(MAX_IMPORTED_PRODUCT_PAGE_SIZE);
  });

  it('MCP-005 · paginates explicitly, and never silently returns more than the cap', async () => {
    const first = await listImported(tokenA, integrationA, '?page=1&pageSize=1');
    const second = await listImported(tokenA, integrationA, '?page=2&pageSize=1');

    expect(first.data.items.length).toBe(1);
    expect(second.data.items.length).toBe(1);
    expect(first.data.total).toBe(2);
    // Two pages of one, and they are different rows — not the same row twice.
    expect(first.data.items[0]?.id).not.toBe(second.data.items[0]?.id);

    // An oversized request is clamped, not honoured. The merchant Products
    // list's silent-20 is the failure this endpoint must not reproduce: here
    // the ceiling is stated in the response.
    const over = await listImported(tokenA, integrationA, '?pageSize=5000');
    expect(over.data.pageSize).toBe(MAX_IMPORTED_PRODUCT_PAGE_SIZE);
  });

  it('MCP-006 · refuses another merchant’s integration before reading anything', async () => {
    const response = await asMerchant(tokenB, `/integrations/catalogue/products/${integrationA}`);
    expect(response.status).toBe(403);

    // And B's own integration is genuinely empty rather than leaking A's.
    const own = await listImported(tokenB, integrationB);
    expect(own.status).toBe(200);
    expect(own.data.items).toEqual([]);
  });

  it('MCP-007 · refuses an unauthenticated read', async () => {
    const response = await fetch(`${baseUrl}/integrations/catalogue/products/${integrationA}`, {
      headers: { 'x-forwarded-for': nextCaller() },
    });
    expect(response.status).toBe(401);
  });

  it('MCP-008 · publishing through the existing endpoint is reflected here', async () => {
    const before = await listImported(tokenA, integrationA);
    expect(before.data.items.find((r) => r.productId === draftProductId)?.status).toBe('DRAFT');

    // The real mutation — Merchant Connect adds no second way to publish.
    const publish = await asMerchant(tokenA, `/merchant/products/${draftProductId}/publish`, {
      method: 'POST',
    });
    expect(publish.status).toBe(201);

    const after = await listImported(tokenA, integrationA);
    const row = after.data.items.find((r) => r.productId === draftProductId);
    expect(row?.status).toBe('PUBLISHED');
    expect(row?.publishedAt).not.toBeNull();

    // Publishing twice is refused, so the UI must stop offering the control.
    const again = await asMerchant(tokenA, `/merchant/products/${draftProductId}/publish`, {
      method: 'POST',
    });
    expect(again.status).toBe(409);
  });

  it('MCP-009 · an unlinked SKU reports null product fields rather than vanishing', async () => {
    const syncId = await linkSku(integrationA, null);
    const { data } = await listImported(tokenA, integrationA);
    const row = data.items.find((r) => r.id === syncId);

    // The mapping exists and the merchant should see it — this is precisely
    // the "needs my attention" case.
    expect(row).toBeDefined();
    expect(row?.productId).toBeNull();
    expect(row?.productName).toBeNull();
    expect(row?.price).toBeNull();
    expect(row?.status).toBeNull();
  });

  it('MCP-010 · a soft-deleted product reports no publishable status', async () => {
    const deletedId = await makeProduct(profileA, ProductStatus.DRAFT);
    const syncId = await linkSku(integrationA, deletedId);
    await prisma.product.update({
      where: { id: deletedId },
      data: { isDeleted: true, status: ProductStatus.ARCHIVED },
    });

    const { data } = await listImported(tokenA, integrationA);
    const row = data.items.find((r) => r.id === syncId);

    // The publish route resolves products through requireOwnedProduct, which
    // filters isDeleted — so publishing this would answer 404. Reporting a
    // DRAFT status here would put a Publish control on a row where pressing it
    // always fails. productId is still reported, because the mapping does
    // point at a product.
    expect(row?.productId).toBe(deletedId);
    expect(row?.status).toBeNull();
    expect(row?.productName).toBeNull();

    const publish = await asMerchant(tokenA, `/merchant/products/${deletedId}/publish`, {
      method: 'POST',
    });
    expect(publish.status).toBe(404);
  });
});
