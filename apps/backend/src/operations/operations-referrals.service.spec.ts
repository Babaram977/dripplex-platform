import { randomUUID } from 'node:crypto';

import {
  PrismaClient,
  ReferralOwnerType,
  ReferralRedemptionStatus,
  ReferralRefereeType,
  ReferralRejectionReason,
} from '@prisma/client';

import { type AuditService } from '../audit/audit.service';
import { DomainEventBus } from '../events/domain-event-bus';
import { ReferralAntiAbuseService } from '../referrals/referral-anti-abuse.service';
import { ReferralLifecycleService } from '../referrals/referral-lifecycle.service';
import { ReferralQualificationService } from '../referrals/referral-qualification.service';
import { WalletService } from '../wallet/wallet.service';

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
    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;
    service = new OperationsReferralsService(
      prisma,
      new ReferralLifecycleService(
        prisma,
        auditService,
        new DomainEventBus(),
        new WalletService(prisma, auditService, new DomainEventBus()),
        new ReferralQualificationService(prisma),
        new ReferralAntiAbuseService(prisma),
      ),
    );
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
            index < rewarded ? ReferralRedemptionStatus.PAID : ReferralRedemptionStatus.PENDING,
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
    expect(personas.map((row) => row.persona).sort()).toEqual([
      'CUSTOMER',
      'DRIVER',
      'FLEET_OWNER',
      'MERCHANT',
      'RIDER',
    ]);
  });

  it('has no persona left without a programme', async () => {
    if (!databaseAvailable) return;

    const { personasWithoutProgramme } = await service.overview();

    // DPX-REFERRAL-002 gave merchants and fleet owners theirs, so every earning
    // persona can now be credited for bringing DrippleX a customer. The field
    // stays in the contract because it is what stops a *future* persona without
    // a code being reported as a row of zeroes.
    expect(personasWithoutProgramme).toEqual([]);
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

  it('gives merchants and fleet owners their own leaderboards', async () => {
    if (!databaseAvailable) return;

    const merchantId = await referrerWith(ReferralOwnerType.MERCHANT, 2, 1);
    const fleetOwnerId = await referrerWith(ReferralOwnerType.FLEET_OWNER, 1, 0);

    const merchants = await service.performers('MERCHANT', 1, 50);
    const fleets = await service.performers('FLEET_OWNER', 1, 50);

    expect(merchants.items.some((item) => item.userId === merchantId)).toBe(true);
    expect(fleets.items.some((item) => item.userId === fleetOwnerId)).toBe(true);
    // And neither shows up in the other's, for the same reason the personas
    // are split at all: their rewards are paid into different wallets.
    expect(merchants.items.some((item) => item.userId === fleetOwnerId)).toBe(false);
  });

  describe('the flagged-referral review queue', () => {
    /** A qualified referral carrying a flag — what the queue exists for. */
    async function flaggedReferral(): Promise<string> {
      const referrerId = await createUser('queue-referrer');
      const refereeId = await createUser('queue-referee');
      const referral = await prisma.referral.create({
        data: {
          userId: referrerId,
          ownerType: ReferralOwnerType.CUSTOMER,
          code: randomUUID().slice(0, 10).toUpperCase(),
        },
      });
      const redemption = await prisma.referralRedemption.create({
        data: {
          referralId: referral.id,
          refereeUserId: refereeId,
          refereeType: ReferralRefereeType.CUSTOMER,
          status: ReferralRedemptionStatus.QUALIFIED,
          qualifiedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
          flaggedReason: ReferralRejectionReason.SHARED_DEVICE,
          referrerRewardAmount: 350,
          refereeRewardAmount: 350,
        },
      });
      return redemption.id;
    }

    it('shows who both sides are, not their ids', async () => {
      if (!databaseAvailable) return;
      // A queue of UUIDs is a queue nobody works.
      const redemptionId = await flaggedReferral();

      const page = await service.reviewQueue(1, 50);
      const row = page.items.find((item) => item.redemptionId === redemptionId);

      expect(row?.referrerName).toContain('queue-referrer');
      expect(row?.refereeName).toContain('queue-referee');
      expect(row?.referrerCode).toHaveLength(10);
      expect(row?.flaggedReason).toBe(ReferralRejectionReason.SHARED_DEVICE);
      expect(row?.referrerRewardAmount).toBe(350);
    });

    it('says the hold has run out, so the wait is on the reviewer', async () => {
      if (!databaseAvailable) return;
      // A flag is not released by a timer — DPX-REFERRAL-003 holds a flagged
      // referral however long its hold was. Eight days past a seven-day hold
      // means nothing is coming to rescue it but a decision.
      const redemptionId = await flaggedReferral();

      const page = await service.reviewQueue(1, 50);
      const row = page.items.find((item) => item.redemptionId === redemptionId);

      expect(row?.holdElapsed).toBe(true);
      expect(row?.releasesAt).not.toBeNull();
      expect(row?.actionPath).toBe(`/admin/referrals/redemptions/${redemptionId}/approve`);
    });

    it('leaves out referrals nobody needs to look at', async () => {
      if (!databaseAvailable) return;
      // Unflagged qualified referrals are the hold's business and pay
      // themselves; paid and pending ones are nobody's decision. A queue that
      // lists them is a queue that gets ignored.
      const referrerId = await createUser('clean-referrer');
      const refereeId = await createUser('clean-referee');
      const referral = await prisma.referral.create({
        data: {
          userId: referrerId,
          ownerType: ReferralOwnerType.CUSTOMER,
          code: randomUUID().slice(0, 10).toUpperCase(),
        },
      });
      const clean = await prisma.referralRedemption.create({
        data: {
          referralId: referral.id,
          refereeUserId: refereeId,
          status: ReferralRedemptionStatus.QUALIFIED,
          qualifiedAt: new Date(),
        },
      });

      const page = await service.reviewQueue(1, 50);

      expect(page.items.some((item) => item.redemptionId === clean.id)).toBe(false);
      expect(page.items.every((item) => item.flaggedReason !== null)).toBe(true);
    });

    it('serves the programmes that price every referral', async () => {
      if (!databaseAvailable) return;
      const programmes = await service.programmes();

      expect(programmes.map((programme) => programme.refereeType).sort()).toEqual([
        'CUSTOMER',
        'FLEET',
        'MERCHANT',
      ]);
      const fleet = programmes.find((programme) => programme.refereeType === 'FLEET');
      expect(fleet?.referrerRewardAmount).toBe(2500);
    });
  });
});
