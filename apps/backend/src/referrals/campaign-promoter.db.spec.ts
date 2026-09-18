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

import { PARTICIPANT_OWNER_TYPE, CAMPAIGN_TOKEN_LENGTH } from './campaign-promoter.constants';
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

  it('refuses a second simultaneous campaign, and names the first', async () => {
    if (!databaseAvailable) return;
    // SUPERSEDES founder ruling 4. Until 2026-09-13 one person could hold live
    // participations on several campaigns at once, each with its own private
    // token — this test asserted exactly that.
    //
    // The founder then ruled that a promoter shares their own referral code and
    // nothing else, and that enrolling them raises what that one code pays.
    // One code cannot carry two rates: nothing in the string says which
    // campaign was meant. So simultaneous participations are now refused, and
    // the schema's per-campaign token becomes a backend identifier rather than
    // something anybody hands out.
    //
    // Removing somebody from the first campaign frees them for the next; that
    // is covered in referral-code-campaign-rate.db.spec.
    const userId = await aUser();
    const campaignA = await aCampaign();
    const campaignB = await aCampaign();

    const a = await service.addPromoter(
      {
        promotionId: campaignA,
        userId,
        participantType: CampaignParticipantType.AMBASSADOR,
        reward: { amountNgn: 150 },
      },
      ADMIN,
    );
    expect(a.token).toHaveLength(CAMPAIGN_TOKEN_LENGTH);

    await expect(
      service.addPromoter(
        {
          promotionId: campaignB,
          userId,
          participantType: CampaignParticipantType.AMBASSADOR,
          reward: { amountNgn: 150 },
        },
        ADMIN,
      ),
    ).rejects.toThrow(/already promoting/i);
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

  it('tells the loser of a race it lost this campaign, not to leave another one', async () => {
    if (!databaseAvailable) return;
    // The race above finds this roughly twice in twenty runs, which is not
    // protection. Here the interleaving is forced instead of hoped for: the
    // competing enrolment is committed *during* the loser's existence check, so
    // the loser always reaches the one-campaign-at-a-time guard with a row
    // already written on the very campaign it is enrolling onto.
    //
    // Before the guard excluded that campaign, the loser was told "already
    // promoting X — remove them from that campaign first", naming the campaign
    // it was being added to. An operator following that sentence would remove
    // the promoter from the enrolment that had just succeeded.
    const [promotionId, userId] = [await aCampaign(), await aUser()];
    const input = {
      promotionId,
      userId,
      participantType: CampaignParticipantType.CUSTOMER,
      reward: { amountNgn: 150 },
    };

    let winnerEnrolled = false;
    const racingPrisma = Object.create(prisma) as PrismaService;
    Object.defineProperty(racingPrisma, 'campaignPromoter', {
      configurable: true,
      value: {
        ...prisma.campaignPromoter,
        findUnique: async (args: Parameters<typeof prisma.campaignPromoter.findUnique>[0]) => {
          // The read happens first and its answer is what the loser gets back:
          // a stale "no row here". The winner commits in between. Returning a
          // fresh read instead would hand the loser the winner's row and send
          // it down the reinstate branch, which is a different bug entirely.
          const stale = await prisma.campaignPromoter.findUnique(args);
          if (!winnerEnrolled) {
            winnerEnrolled = true;
            await service.addPromoter(input, ADMIN);
          }
          return stale;
        },
      },
    });
    const auditService = { record: () => Promise.resolve(undefined) } as unknown as AuditService;
    const loser = new CampaignPromoterService(
      racingPrisma,
      new ReferralsService(
        prisma,
        auditService,
        { emit: () => Promise.resolve(undefined) } as unknown as DomainEventBus,
        {
          advance: () => Promise.resolve(undefined),
        } as never,
      ),
      auditService,
    );

    // One attempt, both assertions on the same error. Calling twice would send
    // the second one down the reinstate path — a different branch, which would
    // quietly stop testing the race.
    const error: unknown = await loser.addPromoter(input, ADMIN).catch((e: unknown) => e);
    expect(String(error)).toMatch(/already a(n active)? promoter/i);
    expect(String(error)).not.toMatch(/remove them from that/i);
    expect(await prisma.campaignPromoter.count({ where: { promotionId, userId } })).toBe(1);
  });

  it('removal deletes the participation and detaches — never deletes — the money record', async () => {
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

    // THE ROW IS GONE. Founder ruling, 2026-09-18, reversing soft removal:
    // "No soft removal in any campaign, removal should be completely."
    expect(await prisma.campaignPromoter.findUnique({ where: { id: promoter.id } })).toBeNull();
    expect(removed.detachedRedemptions).toBe(1);

    // THE MONEY RECORD IS NOT. This redemption is PAID — the wallet ledger holds
    // the matching credit — so deleting it would leave money that moved with
    // nothing saying why. It is detached, not destroyed, and keeps its
    // snapshotted amounts and the referral that names who earned them.
    const survivor = await prisma.referralRedemption.findFirstOrThrow({
      where: { refereeUserId: refereeId },
    });
    expect(survivor.campaignPromoterId).toBeNull();
    expect(survivor.status).toBe(ReferralRedemptionStatus.PAID);
    expect(Number(survivor.referrerRewardAmount)).toBe(350);
    expect(survivor.pointsPerNairaAtGrant).toBe(100);
    expect(survivor.referralId).toBe(referral.id);
  });

  it('re-adding somebody removed gives them a NEW participation and a NEW token', async () => {
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

    // This is the cost of total removal, pinned rather than hidden. Soft removal
    // used to reinstate the SAME row on the SAME token, so a promoter's links
    // kept working across a gap. A deleted participation cannot be reinstated,
    // so their old token is dead and anything already shared under it stops
    // attributing. Founder ruling, 2026-09-18 — ops have total control, and
    // this is what total means.
    expect(again.id).not.toBe(first.id);
    expect(again.token).not.toBe(first.token);
    expect(again.status).toBe(CampaignPromoterStatus.ACTIVE);
    expect(again.removedAt).toBeNull();
    // And exactly one participation, not two.
    expect(await prisma.campaignPromoter.count({ where: { promotionId, userId } })).toBe(1);
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
