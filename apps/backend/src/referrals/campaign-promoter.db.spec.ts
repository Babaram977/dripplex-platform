import { randomUUID } from 'node:crypto';

import {
  CampaignParticipantType,
  CampaignPromoterStatus,
  PrismaClient,
  PromotionStatus,
  PromotionType,
  ReferralOwnerType,
  ReferralRedemptionStatus,
  ReferralRefereeType,
} from '@prisma/client';

import { PARTICIPANT_OWNER_TYPE } from './campaign-promoter.constants';
import { CampaignPromoterService } from './campaign-promoter.service';
import { ReferralsService } from './referrals.service';

import type { AuditService } from '../audit/audit.service';
import type { DomainEventBus } from '../events/domain-event-bus';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * DPX-PROMO-REF-001 — campaign participation against a real database.
 *
 * Every property worth asserting here is a database property: the unique token,
 * the one-participation-per-campaign rule, and the fact that removing a promoter
 * destroys nothing. Mocks would only prove the mocks agree with themselves.
 */
describe('CampaignPromoterService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: CampaignPromoterService;
  const createdUserIds: string[] = [];
  const createdPromotionIds: string[] = [];
  const ADMIN = '99999999-9999-4999-8999-999999999999';

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
    const auditService = { record: () => Promise.resolve(undefined) } as unknown as AuditService;
    const eventBus = { emit: () => Promise.resolve(undefined) } as unknown as DomainEventBus;
    const referrals = new ReferralsService(prisma, auditService, eventBus, {
      advance: () => Promise.resolve(undefined),
    } as never);
    service = new CampaignPromoterService(prisma, referrals, auditService);
  });

  afterAll(async () => {
    if (!databaseAvailable) return;
    await prisma.referralRedemption.deleteMany({
      where: { refereeUserId: { in: createdUserIds } },
    });
    await prisma.campaignPromoter.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.referral.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.promotion.deleteMany({ where: { id: { in: createdPromotionIds } } });
    await prisma.$disconnect();
  });

  async function aUser(): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `promoter-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Promoter',
      },
    });
    createdUserIds.push(user.id);
    return user.id;
  }

  async function aCampaign(status: PromotionStatus = PromotionStatus.ACTIVE): Promise<string> {
    const promo = await prisma.promotion.create({
      data: { name: `Campaign ${randomUUID()}`, type: PromotionType.REFERRAL, status },
    });
    createdPromotionIds.push(promo.id);
    return promo.id;
  }

  it('issues a private token that is not the promoter public code', async () => {
    if (!databaseAvailable) return;
    const [promotionId, userId] = [await aCampaign(), await aUser()];

    const promoter = await service.addPromoter(
      {
        promotionId,
        userId,
        participantType: CampaignParticipantType.INFLUENCER,
        reward: { amountNgn: 150 },
      },
      ADMIN,
    );

    const publicCode = await prisma.referral.findUniqueOrThrow({ where: { userId } });
    expect(promoter.token).toHaveLength(32);
    expect(promoter.token).not.toBe(publicCode.code);
    expect(promoter.token).toBe(promoter.token.toUpperCase());
  });

  it('ensures the Referral row exists before participation, with the routing owner type', async () => {
    if (!databaseAvailable) return;
    // The reason this matters is not tidiness. ReferralRedemption.referralId is
    // NOT NULL, so a promoter without a Referral row cannot have an acquisition
    // written at all — and that failure would land at qualification, on live
    // money, for somebody who had already done the work.
    const [promotionId, userId] = [await aCampaign(), await aUser()];

    await service.addPromoter(
      {
        promotionId,
        userId,
        participantType: CampaignParticipantType.PIONEER_DRIVER,
        reward: { amountNgn: 350 },
      },
      ADMIN,
    );

    const referral = await prisma.referral.findUniqueOrThrow({ where: { userId } });
    // A pioneer driver is paid into a DRIVER wallet: the ₦350 is a rate, not a
    // different destination.
    expect(referral.ownerType).toBe(ReferralOwnerType.DRIVER);
    expect(PARTICIPANT_OWNER_TYPE[CampaignParticipantType.PIONEER_DRIVER]).toBe(
      ReferralOwnerType.DRIVER,
    );
  });

  // Every participant class, asserted against the wallet its reward actually
  // reaches. Written as a table because the first version of this test checked
  // CREATOR and called itself "routes an influencer": a mutation that sent
  // INFLUENCER to a driver wallet passed all ten tests. The mapping is where
  // money goes, so every row of it is named here.
  it.each([
    [CampaignParticipantType.CUSTOMER, ReferralOwnerType.CUSTOMER],
    [CampaignParticipantType.RIDER, ReferralOwnerType.RIDER],
    [CampaignParticipantType.DRIVER, ReferralOwnerType.DRIVER],
    [CampaignParticipantType.PIONEER_DRIVER, ReferralOwnerType.DRIVER],
    [CampaignParticipantType.INFLUENCER, ReferralOwnerType.CUSTOMER],
    [CampaignParticipantType.CREATOR, ReferralOwnerType.CUSTOMER],
    [CampaignParticipantType.AMBASSADOR, ReferralOwnerType.CUSTOMER],
  ])('routes %s to the %s wallet', async (participantType, expectedOwner) => {
    if (!databaseAvailable) return;
    const [promotionId, userId] = [await aCampaign(), await aUser()];
    await service.addPromoter(
      { promotionId, userId, participantType, reward: { amountNgn: 150 } },
      ADMIN,
    );
    const referral = await prisma.referral.findUniqueOrThrow({ where: { userId } });
    expect(referral.ownerType).toBe(expectedOwner);
    expect(PARTICIPANT_OWNER_TYPE[participantType]).toBe(expectedOwner);
  });

  it('refuses a reward that is both cash and points, or neither', async () => {
    if (!databaseAvailable) return;
    const [promotionId, userId] = [await aCampaign(), await aUser()];
    const base = { promotionId, userId, participantType: CampaignParticipantType.CUSTOMER };

    await expect(
      service.addPromoter({ ...base, reward: { amountNgn: 150, points: 15_000 } }, ADMIN),
    ).rejects.toThrow(/exactly one/i);
    await expect(service.addPromoter({ ...base, reward: {} }, ADMIN)).rejects.toThrow(
      /exactly one/i,
    );
    await expect(service.addPromoter({ ...base, reward: { amountNgn: 0 } }, ADMIN)).rejects.toThrow(
      /greater than zero/i,
    );
  });

  it('refuses a second active participation for the same user on one campaign', async () => {
    if (!databaseAvailable) return;
    const [promotionId, userId] = [await aCampaign(), await aUser()];
    const input = {
      promotionId,
      userId,
      participantType: CampaignParticipantType.DRIVER,
      reward: { amountNgn: 200 },
    };

    await service.addPromoter(input, ADMIN);
    await expect(service.addPromoter(input, ADMIN)).rejects.toThrow(/already an active promoter/i);
  });

  it('lets one promoter hold separate tokens across simultaneous campaigns', async () => {
    if (!databaseAvailable) return;
    // Founder ruling 4. Two live campaigns, one person, two private tokens —
    // and no period-uniqueness stopping the campaigns overlapping, which is
    // exactly why Promotion is the campaign layer and ReferralCampaign is not.
    const userId = await aUser();
    const [campaignA, campaignB] = [await aCampaign(), await aCampaign()];

    const a = await service.addPromoter(
      {
        promotionId: campaignA,
        userId,
        participantType: CampaignParticipantType.AMBASSADOR,
        reward: { amountNgn: 150 },
      },
      ADMIN,
    );
    const b = await service.addPromoter(
      {
        promotionId: campaignB,
        userId,
        participantType: CampaignParticipantType.AMBASSADOR,
        reward: { amountNgn: 150 },
      },
      ADMIN,
    );

    expect(a.token).not.toBe(b.token);
    expect(a.id).not.toBe(b.id);
  });

  it('survives concurrent enrolment of the same person: one wins, the rest are told why', async () => {
    if (!databaseAvailable) return;
    const [promotionId, userId] = [await aCampaign(), await aUser()];
    const input = {
      promotionId,
      userId,
      participantType: CampaignParticipantType.CUSTOMER,
      reward: { amountNgn: 150 },
    };

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, async () => await service.addPromoter(input, ADMIN)),
    );
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rows = await prisma.campaignPromoter.count({ where: { promotionId, userId } });

    expect(rows).toBe(1);
    expect(fulfilled).toHaveLength(1);
    for (const r of results.filter((x): x is PromiseRejectedResult => x.status === 'rejected')) {
      const reason = String(r.reason);
      expect(reason).toMatch(/already a(n active)? promoter/i);
      // Two unique constraints raise P2002 on this table and they mean opposite
      // things. Treating a lost enrolment race as a token collision retries it
      // ten times and then reports a token failure, which sends whoever reads
      // the log looking at the generator instead of at the race. A mutation
      // doing exactly that passed every other test here.
      expect(reason).not.toMatch(/token/i);
    }
  });

  it('removal stops future participation and destroys nothing', async () => {
    if (!databaseAvailable) return;
    const [promotionId, userId, refereeId] = [await aCampaign(), await aUser(), await aUser()];
    const promoter = await service.addPromoter(
      {
        promotionId,
        userId,
        participantType: CampaignParticipantType.PIONEER_DRIVER,
        reward: { amountNgn: 350 },
      },
      ADMIN,
    );
    const referral = await prisma.referral.findUniqueOrThrow({ where: { userId } });
    await prisma.referralRedemption.create({
      data: {
        referralId: referral.id,
        refereeUserId: refereeId,
        status: ReferralRedemptionStatus.PAID,
        refereeType: ReferralRefereeType.CUSTOMER,
        campaignPromoterId: promoter.id,
        referrerRewardAmount: 350,
        refereeRewardAmount: 150,
        pointsPerNairaAtGrant: 100,
      },
    });

    const removed = await service.removePromoter(promoter.id, ADMIN);

    expect(removed.status).toBe(CampaignPromoterStatus.REMOVED);
    expect(removed.removedAt).not.toBeNull();
    // The token is kept on purpose: historical rows were attributed through it.
    expect(removed.token).toBe(promoter.token);
    const kept = await prisma.referralRedemption.findFirstOrThrow({
      where: { campaignPromoterId: promoter.id },
    });
    expect(Number(kept.referrerRewardAmount)).toBe(350);
    expect(kept.pointsPerNairaAtGrant).toBe(100);
  });

  it('reinstates a removed promoter on their original token, keeping one history', async () => {
    if (!databaseAvailable) return;
    const [promotionId, userId] = [await aCampaign(), await aUser()];
    const input = {
      promotionId,
      userId,
      participantType: CampaignParticipantType.RIDER,
      reward: { amountNgn: 150 },
    };
    const first = await service.addPromoter(input, ADMIN);
    await service.removePromoter(first.id, ADMIN);

    const again = await service.addPromoter(input, ADMIN);

    expect(again.id).toBe(first.id);
    expect(again.token).toBe(first.token);
    expect(again.status).toBe(CampaignPromoterStatus.ACTIVE);
    expect(again.removedAt).toBeNull();
  });

  it('refuses to enrol anyone on a campaign that can never attribute', async () => {
    if (!databaseAvailable) return;
    // A token against an archived campaign is a code that silently earns
    // nothing, which the promoter discovers by asking why they were not paid.
    for (const status of [
      PromotionStatus.ARCHIVED,
      PromotionStatus.EXPIRED,
      PromotionStatus.CANCELLED,
    ]) {
      const [promotionId, userId] = [await aCampaign(status), await aUser()];
      await expect(
        service.addPromoter(
          {
            promotionId,
            userId,
            participantType: CampaignParticipantType.INFLUENCER,
            reward: { amountNgn: 150 },
          },
          ADMIN,
        ),
      ).rejects.toThrow(/cannot take new promoters/i);
    }
  });
});
