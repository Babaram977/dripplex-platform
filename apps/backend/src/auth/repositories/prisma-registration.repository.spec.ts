import { randomUUID } from 'node:crypto';

import { PrismaClient, RegistrationChannel, UserStatus } from '@prisma/client';

import { PrismaRegistrationRepository } from './prisma-registration.repository';

import type { PrismaService } from '../../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * Every partner is also a customer.
 *
 * Founder rule, 2026-08-31: "driver, merchant or rider can be a customer, his
 * login details should work on customers page". `/auth/login/customer` admits
 * only the `customer` role, and the customer surface hangs cart, addresses and
 * orders off a CustomerProfile — so a partner needs both or their own
 * credentials do not work on the customer app.
 *
 * The other half of the rule — that a driver may NOT sign in through the rider
 * or merchant portal — is enforced by PORTAL_LOGIN_CONFIG and covered by
 * `login.service.spec.ts` ("rejects wrong portal role").
 */
describe('PrismaRegistrationRepository — partners are customers too', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let repository: PrismaRegistrationRepository;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    }) as unknown as PrismaService;

    try {
      await prisma.$connect();
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
      return;
    }

    repository = new PrismaRegistrationRepository(prisma);

    // CI runs migrations but not seed-rbac.cjs, so the suite seeds the roles
    // it depends on rather than assuming a seeded database.
    for (const name of ['customer', 'rider', 'driver', 'merchant']) {
      await prisma.role.upsert({
        where: { name },
        create: { name, description: 'registration repository test fixture' },
        update: {},
      });
    }
  });

  afterAll(async () => {
    if (databaseAvailable) {
      for (const userId of createdUserIds) {
        // Cascades clear the roles and profiles hung off the user.
        await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
      }
    }
    await prisma.$disconnect();
  });

  async function register(
    portal: 'customer' | 'merchant' | 'rider' | 'driver',
    channel: RegistrationChannel,
  ): Promise<string> {
    const result = await repository.registerPortalUser({
      email: `${portal}-${randomUUID()}@dripplex.test`,
      passwordHash: 'not-a-real-hash',
      firstName: 'Test',
      lastName: portal,
      status: UserStatus.ACTIVE,
      registrationChannel: channel,
      roleName: portal,
      portal,
    });
    createdUserIds.push(result.userId);
    return result.userId;
  }

  async function roleNamesFor(userId: string): Promise<string[]> {
    const rows = await prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });
    return rows.map((row) => row.role.name).sort();
  }

  it.each([
    ['rider', RegistrationChannel.RIDER_PORTAL],
    ['driver', RegistrationChannel.DRIVER_PORTAL],
    ['merchant', RegistrationChannel.MERCHANT_PORTAL],
  ] as const)(
    'gives a %s the customer role and a customer profile, so their own login works on the customer app',
    async (portal, channel) => {
      if (!databaseAvailable) return;

      const userId = await register(portal, channel);

      expect(await roleNamesFor(userId)).toEqual(['customer', portal].sort());

      // The role without the profile is a broken customer: cart, addresses and
      // orders all hang off this row.
      const profile = await prisma.customerProfile.findUnique({ where: { userId } });
      expect(profile).not.toBeNull();
    },
  );

  it('leaves a plain customer signup with exactly one role and one profile', async () => {
    if (!databaseAvailable) return;

    const userId = await register('customer', RegistrationChannel.CUSTOMER_WEB);

    expect(await roleNamesFor(userId)).toEqual(['customer']);
    // `userId` is unique on the table, so a second insert would have thrown —
    // this asserts the partner branch did not also fire for a customer.
    const profiles = await prisma.customerProfile.count({ where: { userId } });
    expect(profiles).toBe(1);
  });
});
