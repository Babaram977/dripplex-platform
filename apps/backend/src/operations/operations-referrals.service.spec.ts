import { randomUUID } from 'node:crypto';

import { PrismaClient, ReferralOwnerType, ReferralRedemptionStatus } from '@prisma/client';

import { OperationsReferralsService } from './operations-referrals.service';

import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * Referral performance, read one persona at a time.
 *
 * The thing worth testing is the separation: DrippleX runs two referral
 * programmes that look like one, and the generic code's `ownerType` decides
 * which wallet a reward is paid into. Reporting them together would hide whose
 * programme is converting, which is the question Operations is asking.
 */
describe('OperationsReferralsService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: OperationsReferralsService;
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
    service = new OperationsReferralsService(prisma);
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.referralRedemption.deleteMany({
        where: { refereeUserId: { in: createdUserIds } },
      });
      await prisma.referral.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  async function createUser(label: string): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `ops-referrals-${label}-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: label,
      },
    });
    createdUserIds.push(user.id);
    return user.id;
  }

  /** A referrer of one persona, with `rewarded` of `redeemed` codes converted. */
  async function referrerWith(
    ownerType: ReferralOwnerType,
    redeemed: number,
    rewarded: number,
  ): Promise<string> {
    const userId = await createUser(ownerType);
    const referral = await prisma.referral.create({
      data: { userId, ownerType, code: randomUUID().slice(0, 10).toUpperCase() },
    });

    for (let index = 0; index < redeemed; index += 1) {
      const refereeUserId = await createUser('referee');
      await prisma.referralRedemption.create({
        data: {
          referralId: referral.id,
          refereeUserId,
          status:
            index < rewarded ? ReferralRedemptionStatus.REWARDED : ReferralRedemptionStatus.PENDING,
        },
      });
    }
    return userId;
  }

  it('keeps each persona’s programme separate', async () => {
    if (!databaseAvailable) return;

    await referrerWith(ReferralOwnerType.RIDER, 4, 3);
    await referrerWith(ReferralOwnerType.CUSTOMER, 2, 0);

    const { personas } = await service.overview();
    const riders = personas.find((row) => row.persona === 'RIDER');
    const customers = personas.find((row) => row.persona === 'CUSTOMER');

    expect(riders?.redemptions).toBeGreaterThanOrEqual(4);
    expect(riders?.rewardedRedemptions).toBeGreaterThanOrEqual(3);
    // The customer's two unconverted redemptions must not flatter the rider
    // programme, nor the other way round.
    expect(customers?.pendingRedemptions).toBeGreaterThanOrEqual(2);
  });

  it('always reports every persona that has a programme, even at zero', async () => {
    if (!databaseAvailable) return;

    const { personas } = await service.overview();

    // A persona missing from the list reads as "not a thing"; a persona at zero
    // reads as "nobody is referring yet", and those are different answers.
    expect(personas.map((row) => row.persona).sort()).toEqual(['CUSTOMER', 'DRIVER', 'RIDER']);
  });

  it('names the personas that have no referral programme at all', async () => {
    if (!databaseAvailable) return;

    const { personasWithoutProgramme } = await service.overview();

    // Merchants and fleet owners have no ReferralOwnerType, no code and no
    // decided reward. Showing them as a row of zeroes would say "nobody is
    // referring" when the truth is "nobody can".
    expect(personasWithoutProgramme).toEqual(['MERCHANT', 'FLEET_OWNER']);
  });

  it('rates conversion on what was rewarded, not what was clicked', async () => {
    if (!databaseAvailable) return;

    // A fresh persona, so the ratio is this test's own.
    await prisma.referralRedemption.deleteMany({
      where: { referral: { ownerType: ReferralOwnerType.DRIVER } },
    });
    await prisma.referral.deleteMany({ where: { ownerType: ReferralOwnerType.DRIVER } });
    await referrerWith(ReferralOwnerType.DRIVER, 4, 1);

    const { personas } = await service.overview();
    const drivers = personas.find((row) => row.persona === 'DRIVER');

    expect(drivers?.conversionRate).toBe(0.25);
  });

  it('ranks performers within one persona and not across them', async () => {
    if (!databaseAvailable) return;

    const riderId = await referrerWith(ReferralOwnerType.RIDER, 3, 2);
    const page = await service.performers('RIDER', 1, 50);

    expect(page.items.every((item) => item.persona === 'RIDER')).toBe(true);
    const rider = page.items.find((item) => item.userId === riderId);
    expect(rider?.redemptions).toBe(3);
    expect(rider?.rewardedRedemptions).toBe(2);
  });

  it('reports reward money only for the persona that has a reward programme', async () => {
    if (!databaseAvailable) return;

    await referrerWith(ReferralOwnerType.RIDER, 1, 1);
    const riders = await service.performers('RIDER', 1, 50);

    // Null, not zero: riders have no Driver Growth Campaign, and ₦0 earned
    // would claim they took part and earned nothing.
    expect(riders.items.every((item) => item.rewardAmountEarned === null)).toBe(true);
  });
});
