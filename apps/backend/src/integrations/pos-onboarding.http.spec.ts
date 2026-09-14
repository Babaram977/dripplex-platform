import { randomUUID } from 'node:crypto';

import { Test } from '@nestjs/testing';
import { PrismaClient, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { AppConfigService } from '../config/app-config.service';

import type { INestApplication } from '@nestjs/common';

/**
 * 8A — the merchant onboarding journey, over real HTTP.
 *
 * Every POS "routes" spec in this module is a reflection test: they read
 * PATH_METADATA and GUARDS_METADATA off the controller classes. Not one of them
 * sends a request. The twenty HTTP assertions the order-sync contract reports
 * were a manual run against a locally started API and left no artifact.
 *
 * So the wire has never been under test, which is why this shipped: the API key
 * `POST /integrations` hands a merchant is stored as OUTGOING_API_KEY, and
 * incoming authentication reads INCOMING_API_KEY only. The generated credential
 * authenticates nothing. Three thousand tests pass over the top of it.
 *
 * This file starts where a merchant starts — with the key DrippleX gave them —
 * and it never reaches for `POST /integrations/:id/credentials` to make the
 * journey work. Routing around the defect is what the simulator already does,
 * and it is why nobody noticed.
 */

// Chosen at module load so a run without a database reports SKIPPED, not
// PASSED. The `maybe()` helper the DB specs use returns early inside a passing
// `it`, so 1,836 lines of isolation and wallet assertions would report green
// while executing nothing. CI supplies Postgres, so this skips only locally.
const databaseUrl = process.env['DATABASE_URL'] ?? '';
const suite = databaseUrl === '' ? describe.skip : describe;

suite('POS onboarding over HTTP (8A)', () => {
  let prisma: PrismaClient;
  let app: INestApplication;
  let baseUrl: string;

  let merchantToken = '';
  let generatedIntegrationId = '';
  let generatedApiKey = '';

  const email = `pos-onboarding-${randomUUID()}@example.com`;
  const password = 'Password1!';
  const roleName = `pos-onboarding-${randomUUID().slice(0, 8)}`;
  let roleId = '';
  let userId = '';
  const integrationIds: string[] = [];

  // A distinct client address per request. ProxyAwareThrottlerGuard is a global
  // APP_GUARD keyed on the leftmost X-Forwarded-For entry, merchant login is
  // capped at 20/min, and everything else at 100/min. Share an address and the
  // suite throttles itself into 429s that read exactly like auth failures.
  let callerSeq = 0;
  const nextCaller = (): string =>
    `203.0.113.${String((callerSeq += 1) % 240)}:${String(callerSeq)}`;

  const priorMerchantModule = process.env['MERCHANT_MODULE_ENABLED'];

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    // Loud. A DATABASE_URL that is set but unreachable is a broken run, not an
    // absent one, and must not be confused with the skip above.
    await prisma.$connect();

    // Merchant-facing integrations routes now sit behind
    // MerchantModuleEnabledGuard (founder ruling 2026-09-14), and this suite
    // sets its fixtures up through those routes — so it must run as a merchant
    // whose module is on. POS ingestion's independence from the flag is proved
    // separately, in merchant-module-guard-off.http.spec.ts.
    process.env['MERCHANT_MODULE_ENABLED'] = 'true';

    const { AppModule } = await import('../app.module');
    // No provider overrides: the real validation pipe, the real exception
    // filter, the real guards. Overriding any of them proves a pipeline that
    // does not exist in production.
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication({ bufferLogs: true });
    const config = app.get(AppConfigService);
    // Load-bearing. main.ts sets this prefix; without it here every route mounts
    // one level off, the suite drives paths that do not exist, and it proves
    // nothing while passing.
    app.setGlobalPrefix(config.apiGlobalPrefix);
    await app.listen(0);
    baseUrl = `${(await app.getUrl()).replace('[::1]', '127.0.0.1')}/${config.apiGlobalPrefix}`;

    // The JWT strategy reads permissions from the database per request rather
    // than from the token, so the grant has to be real. A throwaway role
    // carries it, so the shared `merchant` row is not permanently widened.
    const read = await prisma.permission.upsert({
      where: { code: 'integrations:read' },
      update: {},
      create: { code: 'integrations:read', description: 'POS onboarding HTTP proof' },
    });
    const write = await prisma.permission.upsert({
      where: { code: 'integrations:write' },
      update: {},
      create: { code: 'integrations:write', description: 'POS onboarding HTTP proof' },
    });
    const merchantRole = await prisma.role.upsert({
      where: { name: 'merchant' },
      update: {},
      create: { name: 'merchant', description: 'Merchant (POS onboarding HTTP proof)' },
    });
    const grantRole = await prisma.role.create({
      data: { name: roleName, description: 'POS onboarding HTTP proof' },
    });
    roleId = grantRole.id;
    await prisma.rolePermission.createMany({
      data: [
        { roleId: grantRole.id, permissionId: read.id },
        { roleId: grantRole.id, permissionId: write.id },
      ],
    });

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 10),
        firstName: 'POS',
        lastName: 'Onboarding',
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        // Set explicitly rather than left to PORTAL_EMAIL_ACTIVATION: merchant
        // login refuses an unverified phone when that flag is off, and a
        // fixture must not depend on a deployment flag to authenticate.
        phoneVerifiedAt: new Date(),
        roles: { create: [{ roleId: merchantRole.id }, { roleId: grantRole.id }] },
      },
    });
    userId = user.id;

    // The POS order routes resolve MerchantProfile.id from the integration's
    // user id via MerchantProfileResolver, because MerchantIntegration.merchantId
    // holds a User id while Order.merchantId is an FK to MerchantProfile. Without
    // this row, `GET /integrations/orders/list` answers 500 by design —
    // order-sync contract §4, "a DrippleX defect, not a bad payload". Creating
    // the integration needs no profile; reading orders through it does.
    await prisma.merchantProfile.create({ data: { userId: user.id } });

    const login = await fetch(`${baseUrl}/auth/login/merchant`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': nextCaller() },
      body: JSON.stringify({ email, password }),
    });
    const body = (await login.json()) as { data?: { accessToken?: string } };
    if (login.status !== 200 || typeof body.data?.accessToken !== 'string') {
      // A fixture that fails to authenticate would leave every test below
      // asserting against an empty token and calling the resulting 401 a pass.
      throw new Error(
        `Merchant login failed: HTTP ${String(login.status)} ${JSON.stringify(body).slice(0, 300)}`,
      );
    }
    merchantToken = body.data.accessToken;
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
    await tidy('integrationCredential', () =>
      prisma.integrationCredential.deleteMany({
        where: { integrationId: { in: integrationIds } },
      }),
    );
    await tidy('merchantIntegration', () =>
      prisma.merchantIntegration.deleteMany({ where: { id: { in: integrationIds } } }),
    );
    await tidy('merchantProfile', () => prisma.merchantProfile.deleteMany({ where: { userId } }));
    await tidy('rolePermission', () => prisma.rolePermission.deleteMany({ where: { roleId } }));
    await tidy('userRole', () => prisma.userRole.deleteMany({ where: { userId } }));
    await tidy('user', () => prisma.user.deleteMany({ where: { id: userId } }));
    await tidy('role', () => prisma.role.deleteMany({ where: { id: roleId } }));
    await app.close();
    if (priorMerchantModule === undefined) {
      delete process.env['MERCHANT_MODULE_ENABLED'];
    } else {
      process.env['MERCHANT_MODULE_ENABLED'] = priorMerchantModule;
    }

    await prisma.$disconnect();
  }, 60_000);

  // `headers` narrowed to a plain record rather than RequestInit's HeadersInit,
  // which also admits an array of tuples — spreading that into an object would
  // yield numeric indices, and eslint is right to refuse it.
  type MerchantInit = Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };

  const asMerchant = (path: string, init: MerchantInit = {}): Promise<Response> =>
    fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${merchantToken}`,
        'x-forwarded-for': nextCaller(),
        ...(init.headers ?? {}),
      },
    });

  const asPos = (path: string, integrationId: string, key: string): Promise<Response> =>
    fetch(`${baseUrl}${path}`, {
      headers: {
        'x-integration-id': integrationId,
        'x-integration-key': key,
        'x-forwarded-for': nextCaller(),
      },
    });

  // ── A · issuance ──────────────────────────────────────────────────────

  it('E2E-001/002/003 · a merchant creates an integration and is handed a key once', async () => {
    const response = await asMerchant('/integrations', {
      method: 'POST',
      body: JSON.stringify({ vendorName: 'Acme POS', vendorVersion: '1.0.0' }),
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(typeof body['integrationId']).toBe('string');
    // Also proves which handler answered. Both IntegrationsCController and the
    // legacy IntegrationsController register POST /integrations; only the C
    // controller returns apiKey. Mapped is not reachable, and neither is
    // "the controller I meant".
    expect(typeof body['apiKey']).toBe('string');

    generatedIntegrationId = body['integrationId'] as string;
    generatedApiKey = body['apiKey'] as string;
    integrationIds.push(generatedIntegrationId);
  });

  it('E2E-005 · the key is never returned again', async () => {
    const response = await asMerchant(`/integrations/${generatedIntegrationId}`);
    const text = await response.text();

    expect(response.status).toBe(200);
    // Not a field check: the whole serialised body must not contain the secret,
    // however it might be nested or renamed.
    expect(text).not.toContain(generatedApiKey);
  });

  // ── The defect ────────────────────────────────────────────────────────

  /**
   * THE regression test for this workstream. It was `it.failing` while the
   * generated credential was stored as OUTGOING_API_KEY and verified as
   * INCOMING_API_KEY, and Jest turned the suite red the moment that was
   * corrected — which is what forced this flip rather than leaving a stale
   * marker behind.
   *
   * Do not satisfy this by issuing a credential through
   * `POST /integrations/:id/credentials`. That route takes a merchant-chosen
   * secret; this asserts the key DrippleX itself hands a merchant.
   */
  it('E2E-008 · the generated integration credential authenticates', async () => {
    const response = await asPos(
      '/integrations/orders/list',
      generatedIntegrationId,
      generatedApiKey,
    );
    expect(response.status).toBe(200);
  });

  it('E2E-008b · and it is the key that authenticates, not the route being open', async () => {
    // The pair matters: E2E-008 alone would pass if the guard were removed.
    // Same route, same integration, wrong secret — still refused.
    const response = await asPos(
      '/integrations/orders/list',
      generatedIntegrationId,
      `dpx_integration_${'0'.repeat(64)}`,
    );
    expect(response.status).toBe(401);
  });

  // ── A · negative paths ────────────────────────────────────────────────

  it('E2E-009 · a wrong key is refused', async () => {
    const response = await asPos(
      '/integrations/orders/list',
      generatedIntegrationId,
      `dpx_integration_${randomUUID()}_not-the-key`,
    );
    expect(response.status).toBe(401);
  });

  it('E2E-010 · an unknown integration fails without revealing whether it exists', async () => {
    const response = await asPos('/integrations/orders/list', randomUUID(), generatedApiKey);
    expect(response.status).toBe(401);
  });

  // ── B · the compatibility guarantee ───────────────────────────────────

  it('E2E-017 · a pre-existing merchant-chosen credential still authenticates', async () => {
    // The continuity-sensitive population: rows created before the credential
    // path was corrected — a merchant-chosen secret, bcrypt, no expiry, narrow
    // scopes. Written directly, because that shape can no longer be produced
    // through the API: every integration is now issued a generated credential
    // at creation, and P5 refuses a second live one.
    //
    // verifyIncomingCredential ends at bcrypt.compare and inspects no length,
    // format or prefix, so this keeps working — and this assertion is what
    // makes that promise falsifiable rather than merely stated.
    const created = await asMerchant('/integrations', {
      method: 'POST',
      body: JSON.stringify({ vendorName: 'Legacy POS' }),
    });
    const integrationId = ((await created.json()) as Record<string, unknown>)[
      'integrationId'
    ] as string;
    integrationIds.push(integrationId);

    const legacySecret = 'legacy-merchant-chosen-secret';
    await prisma.integrationCredential.updateMany({
      where: { integrationId, credentialType: 'INCOMING_API_KEY' },
      data: {
        credentialHash: await bcrypt.hash(legacySecret, 10),
        scopes: ['orders:read'],
        expiresAt: null,
      },
    });

    const response = await asPos('/integrations/orders/list', integrationId, legacySecret);
    expect(response.status).toBe(200);
  });

  it('E2E-004 · the generated key is 256 bits in the approved format', () => {
    // randomBytes(32) hex, no decorative suffix. The previous construction
    // appended twelve characters derived from the integration id, the uuid and
    // the clock — zero entropy, dressed as secret.
    expect(generatedApiKey).toMatch(/^dpx_integration_[0-9a-f]{64}$/);
  });

  it('E2E-007 · the credential is stored one-way and never decrypted for display', async () => {
    const response = await asMerchant(`/integrations/${generatedIntegrationId}/credentials`);
    const body = (await response.json()) as { data?: { publicSuffix?: string }[] };

    expect(response.status).toBe(200);
    // Masked without decryption. Listing decrypts OUTGOING credentials to
    // compute a display suffix; an incoming credential is a bcrypt hash, so
    // there is nothing to decrypt and nothing to reveal.
    expect(body.data?.[0]?.publicSuffix).toBe('****');
  });

  it('E2E-004b · a generated credential carries a 90-day expiry', async () => {
    const credential = await prisma.integrationCredential.findFirstOrThrow({
      where: { integrationId: generatedIntegrationId, credentialType: 'INCOMING_API_KEY' },
    });
    const expiresAt = credential.expiresAt;
    if (expiresAt === null) throw new Error('generated credential carries no expiry');
    const days = (expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(89);
    expect(days).toBeLessThan(91);
  });

  it('P5 · a live credential is never silently replaced', async () => {
    // Creating a second credential of the same type used to overwrite the
    // secret in place, so a POS stopped working mid-shift with nothing to say
    // why. Rotation is the explicit route and archives first, so it still works.
    const response = await asMerchant(`/integrations/${generatedIntegrationId}/credentials`, {
      method: 'POST',
      body: JSON.stringify({
        credentialType: 'INCOMING_API_KEY',
        secret: 'a-replacement-secret-value',
        scopes: ['orders:read'],
      }),
    });
    expect(response.status).toBe(409);

    // And the original key still works, which is the point.
    const stillWorks = await asPos(
      '/integrations/orders/list',
      generatedIntegrationId,
      generatedApiKey,
    );
    expect(stillWorks.status).toBe(200);
  });

  it.failing(
    'E2E-012 · a valid credential lacking the scope is refused as 403, not 401 [PENDING B6]',
    async () => {
      // Same shape as above: it holds orders:read and not inventory:write.
      // Today both failures answer `Invalid integration credentials`, so a POS
      // integrator cannot tell a wrong key from a missing privilege.
      const created = await asMerchant('/integrations', {
        method: 'POST',
        body: JSON.stringify({ vendorName: 'Scope POS' }),
      });
      const integrationId = ((await created.json()) as Record<string, unknown>)[
        'integrationId'
      ] as string;
      integrationIds.push(integrationId);

      // Narrowed on the generated credential rather than issued separately:
      // P5 now refuses a second live credential of the same type.
      const secret = 'scope-probe-secret-value';
      await prisma.integrationCredential.updateMany({
        where: { integrationId, credentialType: 'INCOMING_API_KEY' },
        data: { credentialHash: await bcrypt.hash(secret, 10), scopes: ['orders:read'] },
      });

      const response = await fetch(`${baseUrl}/integrations/inventory/sync`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'x-integration-id': integrationId,
          'x-integration-key': secret,
          'idempotency-key': randomUUID(),
          'x-forwarded-for': nextCaller(),
        },
        body: JSON.stringify({ items: [] }),
      });
      expect(response.status).toBe(403);
    },
  );
});
