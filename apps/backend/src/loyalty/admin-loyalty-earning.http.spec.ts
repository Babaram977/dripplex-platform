import { randomUUID } from 'node:crypto';

import { Test } from '@nestjs/testing';
import { PrismaClient, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { AppConfigService } from '../config/app-config.service';

import type { INestApplication } from '@nestjs/common';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * The DX Points Earning desk's two reads, proved over authenticated HTTP.
 *
 * These are the last two routes behind the Operations Console that could not
 * be proved from outside. Everywhere else in this API, a 404 on a bogus
 * sibling proves that a 401 on the real path means "exists, behind auth".
 * That discriminator does not work under `admin/loyalty`: `:userId` matches
 * any single segment, so `GET /admin/loyalty/nope` answers 401 too, and a 401
 * on `earning-programmes` says nothing about which handler would have run.
 *
 * Only a request that gets past the guard can tell the two apart, so this file
 * signs in for real and looks at the body. The discriminator is the last test:
 * with a valid token the literal route returns 200 and a programme array,
 * while an arbitrary word under the same prefix returns 400 from the
 * ParseUUIDPipe on `:userId`. Two different handlers, proved by their answers
 * rather than by reading the controller.
 *
 * Read-only by construction: every request below is a GET. The fixture writes
 * only its own throwaway role, permission grant and user, and deletes them
 * afterwards.
 */
describe('DX Points Earning reads over authenticated HTTP', () => {
  let databaseAvailable = false;
  let app: INestApplication;
  let baseUrl: string;
  let prisma: PrismaClient;
  let accessToken = '';

  const password = `Route-Proof-${randomUUID()}`;
  const email = `ops-loyalty-proof-${randomUUID()}@dripplex.test`;
  const roleName = `ops_loyalty_proof_${randomUUID().slice(0, 8)}`;
  let userId = '';
  let roleId = '';

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    try {
      await prisma.$connect();
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
      return;
    }

    const { AppModule } = await import('../app.module');
    // No provider overrides: the real guards, the real validation pipe, the
    // real JWT strategy. Overriding any of them would prove a pipeline that
    // does not exist in production.
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bufferLogs: true });
    const config = app.get(AppConfigService);
    app.setGlobalPrefix(config.apiGlobalPrefix);
    await app.listen(0);
    baseUrl = `${(await app.getUrl()).replace('[::1]', '127.0.0.1')}/${config.apiGlobalPrefix}`;

    // `operations_staff` is what the ops portal checks for; `admin:loyalty:manage`
    // is what the two routes require. The user needs both, and the JWT strategy
    // reads permissions from the database per request rather than from the
    // token, so the grant has to be real.
    const permission = await prisma.permission.upsert({
      where: { code: 'admin:loyalty:manage' },
      update: {},
      create: { code: 'admin:loyalty:manage', description: 'DX Points earning (HTTP proof)' },
    });
    const opsRole = await prisma.role.upsert({
      where: { name: 'operations_staff' },
      update: {},
      create: { name: 'operations_staff', description: 'Operations staff (HTTP proof)' },
    });
    // A throwaway role carries the grant so the shared `operations_staff` row
    // is not permanently widened by a test run.
    const grantRole = await prisma.role.create({
      data: { name: roleName, description: 'DX Points earning HTTP proof' },
    });
    roleId = grantRole.id;
    await prisma.rolePermission.create({
      data: { roleId: grantRole.id, permissionId: permission.id },
    });

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 10),
        firstName: 'Route',
        lastName: 'Proof',
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        roles: { create: [{ roleId: opsRole.id }, { roleId: grantRole.id }] },
      },
    });
    userId = user.id;

    const login = await fetch(`${baseUrl}/auth/login/operations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.77' },
      body: JSON.stringify({ email, password }),
    });
    const body = (await login.json()) as { data?: { accessToken?: string } };
    if (login.status !== 200 || typeof body.data?.accessToken !== 'string') {
      // Loud, not silent. A fixture that fails to authenticate would otherwise
      // leave every test below asserting against an empty token and calling
      // the resulting 401 a pass.
      throw new Error(
        `Ops login failed: HTTP ${String(login.status)} ${JSON.stringify(body).slice(0, 300)}`,
      );
    }
    accessToken = body.data.accessToken;
  }, 180_000);

  afterAll(async () => {
    if (!databaseAvailable) return;
    if (userId !== '') {
      await prisma.userRole.deleteMany({ where: { userId } });
      await prisma.authSession.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    if (roleId !== '') {
      await prisma.rolePermission.deleteMany({ where: { roleId } });
      await prisma.role.deleteMany({ where: { id: roleId } });
    }
    await app.close();
    await prisma.$disconnect();
  }, 60_000);

  const get = async (path: string): Promise<Response> =>
    await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });

  it('authenticated the fixture, so the assertions below mean something', () => {
    if (!databaseAvailable) return;
    expect(accessToken).not.toBe('');
    expect(accessToken.length).toBeGreaterThan(20);
  });

  it('GET /admin/loyalty/earning-programmes answers 200 with the programme contract', async () => {
    if (!databaseAvailable) return;
    const response = await get('/admin/loyalty/earning-programmes');
    const body = (await response.json()) as {
      success?: boolean;
      data?: { persona?: string; pointsPerCompletedJob?: number; active?: boolean }[];
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    // A valid empty state is acceptable; a wrong shape is not. Every row that
    // is there must carry the fields the console renders.
    for (const row of body.data ?? []) {
      expect(typeof row.persona).toBe('string');
      expect(typeof row.pointsPerCompletedJob).toBe('number');
      expect(typeof row.active).toBe('boolean');
    }
  });

  it('GET /admin/loyalty/earning-programmes/impact answers 200 with the impact contract', async () => {
    if (!databaseAvailable) return;
    const response = await get('/admin/loyalty/earning-programmes/impact');
    const body = (await response.json()) as {
      success?: boolean;
      data?: { persona?: string; eligiblePartners?: number; pointsPerNaira?: number }[];
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    for (const row of body.data ?? []) {
      expect(typeof row.persona).toBe('string');
      expect(typeof row.eligiblePartners).toBe('number');
      expect(typeof row.pointsPerNaira).toBe('number');
    }
  });

  /**
   * The discriminator. This is the assertion the whole file exists for.
   *
   * If `:userId` were shadowing the literal route, `earning-programmes` would
   * reach ParseUUIDPipe and answer 400 exactly like an arbitrary word does.
   * It answers 200 with an array while the arbitrary word answers 400, so two
   * different handlers ran — proved from the responses, not from the order the
   * decorators happen to appear in.
   */
  it('reaches the literal handler, not the :userId catch-all', async () => {
    if (!databaseAvailable) return;
    const literal = await get('/admin/loyalty/earning-programmes');
    const arbitrary = await get('/admin/loyalty/not-a-uuid-at-all');

    expect(literal.status).toBe(200);
    expect(arbitrary.status).toBe(400);

    const literalBody = (await literal.json()) as { data?: unknown };
    expect(Array.isArray(literalBody.data)).toBe(true);
  });
});
