import { randomUUID } from 'node:crypto';

import { Test } from '@nestjs/testing';
import { MerchantStatus, PrismaClient, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { AppConfigService } from '../config/app-config.service';

import { CredentialsService } from './services/credentials.service';

import type { INestApplication } from '@nestjs/common';

/**
 * Shared harness for the two Merchant Module guard specs.
 *
 * There are two spec files rather than one because the flag cannot be changed
 * twice in a process: `ConfigModule.forRoot()` bakes its validated env into
 * the module metadata at first import, and `jest.resetModules()` — the obvious
 * escape — duplicates `Reflector`'s class identity and breaks Nest's DI
 * outright. Jest gives each test file its own registry, so one boot per file
 * is the only way to exercise both states honestly rather than by mocking the
 * config the guard reads.
 *
 * Named `.shared-spec.ts`: `tsconfig.build.json` excludes `**\/*spec.ts` so it
 * never reaches `dist`, while Jest's `.*\.spec\.ts$` does not match it, so it
 * is not collected as a suite of its own.
 */

export const MODULE_OFF = 'The merchant module is not enabled';

export interface Probe {
  method: string;
  path: string;
  body?: unknown;
  /** Extra headers — the inventory batch carries its idempotency key in one. */
  headers?: Record<string, string>;
}

export interface Harness {
  app: INestApplication;
  prisma: PrismaClient;
  baseUrl: string;
  moduleEnabled: boolean;
  token: string;
  integrationId: string;
  apiKey: string;
  asMerchant: (probe: Probe) => Promise<{ status: number; text: string }>;
  asPos: (probe: Probe) => Promise<{ status: number; text: string }>;
  anonymous: (probe: Probe) => Promise<{ status: number; text: string }>;
  cleanup: () => Promise<void>;
}

/** Marks every row this harness creates, so a run that dies mid-setup can be swept. */
export const VENDOR_TAG = 'MMG Harness POS';

let callerSeq = 0;
const nextCaller = (): string => `198.20.0.${String((callerSeq += 1) % 240)}:${String(callerSeq)}`;

/**
 * Every merchant-facing route on the integrations surface.
 *
 * Addressed at an integration id belonging to nobody, so the module-on pass is
 * refused on ownership and mutates nothing — the destructive routes included.
 * What is asserted is which guard answered, never the resource.
 */
export const merchantRoutes = (): Probe[] => {
  const stranger = randomUUID();
  const credential = randomUUID();
  return [
    { method: 'GET', path: '/integrations' },
    // Deliberately invalid: guards run before validation pipes, so the module
    // off refuses this at the guard and the module on at the validator —
    // which distinguishes them without creating an integration.
    { method: 'POST', path: '/integrations', body: {} },
    { method: 'GET', path: `/integrations/${stranger}` },
    { method: 'PUT', path: `/integrations/${stranger}`, body: { vendorName: 'y' } },
    { method: 'DELETE', path: `/integrations/${stranger}` },
    { method: 'GET', path: `/integrations/${stranger}/test` },
    { method: 'POST', path: `/integrations/${stranger}/credentials`, body: {} },
    { method: 'GET', path: `/integrations/${stranger}/credentials` },
    {
      method: 'POST',
      path: `/integrations/${stranger}/credentials/${credential}/rotate`,
      body: {},
    },
    { method: 'DELETE', path: `/integrations/${stranger}/credentials/${credential}` },
    { method: 'GET', path: `/integrations/catalogue/jobs/${stranger}` },
    { method: 'GET', path: `/integrations/catalogue/products/${stranger}` },
    { method: 'GET', path: `/integrations/catalogue/mappings/${stranger}` },
    {
      method: 'PUT',
      path: `/integrations/catalogue/mappings/${stranger}`,
      body: { externalCategoryName: 'Drinks', categoryId: randomUUID() },
    },
    { method: 'DELETE', path: `/integrations/catalogue/mappings/${stranger}?name=Drinks` },
    { method: 'GET', path: `/integrations/inventory/levels/${stranger}` },
    { method: 'GET', path: `/integrations/conflicts/${stranger}` },
    { method: 'PATCH', path: `/integrations/conflicts/${stranger}/acknowledge`, body: {} },
  ];
};

/** Every POS machine-to-machine route, across all three controller families. */
export const posRoutes = (): Probe[] => [
  {
    method: 'POST',
    path: '/integrations/catalogue/sync',
    body: {
      idempotencyKey: `mmg-${randomUUID()}`,
      items: [{ externalSku: `MMG-${randomUUID().slice(0, 8)}`, name: 'Guard probe', price: 10 }],
    },
  },
  {
    method: 'PUT',
    path: '/integrations/inventory/sync',
    body: { items: [{ externalSku: `MMG-${randomUUID().slice(0, 8)}`, quantity: 3 }] },
    headers: { 'Idempotency-Key': `mmg-inv-${randomUUID()}` },
  },
  { method: 'GET', path: '/integrations/orders/list' },
  { method: 'GET', path: `/integrations/orders/detail/${randomUUID()}` },
  {
    method: 'PUT',
    path: `/integrations/orders/status/${randomUUID()}`,
    body: { status: 'PREPARING' },
  },
];

export async function bootHarness(databaseUrl: string, enabled: boolean): Promise<Harness> {
  process.env['MERCHANT_MODULE_ENABLED'] = enabled ? 'true' : 'false';

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  await prisma.$connect();

  const { AppModule } = await import('../app.module');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ bufferLogs: true });
  const config = app.get(AppConfigService);
  app.setGlobalPrefix(config.apiGlobalPrefix);
  await app.listen(0);
  const baseUrl = `${(await app.getUrl()).replace('[::1]', '127.0.0.1')}/${config.apiGlobalPrefix}`;

  const call = async (
    probe: Probe,
    headers: Record<string, string>,
  ): Promise<{ status: number; text: string }> => {
    const response = await fetch(`${baseUrl}${probe.path}`, {
      method: probe.method,
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': nextCaller(),
        ...headers,
        ...(probe.headers ?? {}),
      },
      ...(probe.body === undefined ? {} : { body: JSON.stringify(probe.body) }),
    });
    return { status: response.status, text: await response.text() };
  };

  // ── fixture ────────────────────────────────────────────────────────────────
  const password = 'Password1!';
  const roleName = `mmg-${randomUUID().slice(0, 8)}`;

  const read = await prisma.permission.upsert({
    where: { code: 'integrations:read' },
    update: {},
    create: { code: 'integrations:read', description: 'MMG proof' },
  });
  const write = await prisma.permission.upsert({
    where: { code: 'integrations:write' },
    update: {},
    create: { code: 'integrations:write', description: 'MMG proof' },
  });
  await prisma.role.upsert({
    where: { name: 'merchant' },
    update: {},
    create: { name: 'merchant', description: 'MMG proof' },
  });
  const rw = await prisma.role.create({ data: { name: roleName, description: 'MMG proof' } });
  await prisma.rolePermission.createMany({
    data: [
      { roleId: rw.id, permissionId: read.id },
      { roleId: rw.id, permissionId: write.id },
    ],
  });

  const email = `mmg-${randomUUID()}@example.com`;
  const merchantRole = await prisma.role.findUniqueOrThrow({ where: { name: 'merchant' } });
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 10),
      firstName: 'MMG',
      lastName: 'Merchant',
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
      roles: { create: [{ roleId: merchantRole.id }, { roleId: rw.id }] },
    },
  });
  await prisma.merchantProfile.create({
    data: { userId: user.id, status: MerchantStatus.APPROVED },
  });

  const login = await fetch(`${baseUrl}/auth/login/merchant`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': nextCaller() },
    body: JSON.stringify({ email, password }),
  });
  const loginBody = (await login.json()) as { data?: { accessToken?: string } };
  if (login.status !== 200 || typeof loginBody.data?.accessToken !== 'string') {
    throw new Error(`login failed: HTTP ${String(login.status)}`);
  }
  const token = loginBody.data.accessToken;

  const integration = await prisma.merchantIntegration.create({
    data: {
      merchantId: user.id,
      integrationName: 'MMG',
      posProvider: 'CUSTOM',
      vendorName: VENDOR_TAG,
    },
  });

  // Through the app's own CredentialsService rather than over HTTP: creating a
  // credential is itself a gated merchant action, so the module-off harness
  // could not set itself up through the API. This is the same production code
  // the route calls, so the key is hashed and scoped exactly as a real one.
  const apiKey = `dpx_integration_${randomUUID().replace(/-/g, '')}${randomUUID().replace(/-/g, '')}`;
  await app.get(CredentialsService).createCredential(user.id, {
    integrationId: integration.id,
    credentialType: 'INCOMING_API_KEY',
    secret: apiKey,
    scopes: [
      'catalog:read',
      'catalog:write',
      'inventory:read',
      'inventory:write',
      'orders:read',
      'orders:write',
    ],
    expiresAt: new Date(Date.now() + 86_400_000),
  });

  const cleanup = async (): Promise<void> => {
    const tidy = async (what: string, fn: () => Promise<unknown>): Promise<void> => {
      try {
        await fn();
      } catch (error) {
        console.warn(
          `cleanup: ${what} — ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    };
    // Sweep by vendor tag, so a run that died mid-setup leaves nothing for the
    // next run's assertions to meet.
    const strays = await prisma.merchantIntegration.findMany({
      where: { vendorName: VENDOR_TAG },
      select: { id: true },
    });
    const ids = strays.map((row) => row.id);
    const syncs = await prisma.productSync.findMany({
      where: { integrationId: { in: ids } },
      select: { productId: true },
    });
    const productIds = syncs.map((row) => row.productId).filter((id): id is string => id !== null);

    await tidy('inventoryUpdates', () =>
      prisma.inventoryUpdate.deleteMany({
        where: { productSync: { integrationId: { in: ids } } },
      }),
    );
    await tidy('productSyncs', () =>
      prisma.productSync.deleteMany({ where: { integrationId: { in: ids } } }),
    );
    await tidy('inventory', () =>
      prisma.productInventory.deleteMany({ where: { productId: { in: productIds } } }),
    );
    await tidy('products', () => prisma.product.deleteMany({ where: { id: { in: productIds } } }));
    await tidy('conflicts', () =>
      prisma.integrationConflict.deleteMany({ where: { integrationId: { in: ids } } }),
    );
    await tidy('logs', () =>
      prisma.integrationLog.deleteMany({ where: { integrationId: { in: ids } } }),
    );
    await tidy('syncJobs', () =>
      prisma.catalogSyncJob.deleteMany({ where: { integrationId: { in: ids } } }),
    );
    await tidy('credentials', () =>
      prisma.integrationCredential.deleteMany({ where: { integrationId: { in: ids } } }),
    );
    await tidy('integrations', () =>
      prisma.merchantIntegration.deleteMany({ where: { id: { in: ids } } }),
    );
    await tidy('profiles', () => prisma.merchantProfile.deleteMany({ where: { userId: user.id } }));
    await tidy('rolePermissions', () =>
      prisma.rolePermission.deleteMany({ where: { roleId: rw.id } }),
    );
    await tidy('userRoles', () => prisma.userRole.deleteMany({ where: { userId: user.id } }));
    await tidy('users', () => prisma.user.deleteMany({ where: { id: user.id } }));
    await tidy('roles', () => prisma.role.deleteMany({ where: { id: rw.id } }));
    await app.close();
    await prisma.$disconnect();
  };

  return {
    app,
    prisma,
    baseUrl,
    moduleEnabled: config.merchantModuleEnabled,
    token,
    integrationId: integration.id,
    apiKey,
    asMerchant: (probe) => call(probe, { authorization: `Bearer ${token}` }),
    asPos: (probe) =>
      call(probe, { 'x-integration-id': integration.id, 'x-integration-key': apiKey }),
    anonymous: (probe) => call(probe, {}),
    cleanup,
  };
}
