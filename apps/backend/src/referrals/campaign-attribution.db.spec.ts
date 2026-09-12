import { randomUUID } from 'node:crypto';

import {
  CampaignParticipantType,
  PrismaClient,
  PromotionStatus,
  PromotionType,
  WalletOwnerType,
  type CampaignPromoter,
} from '@prisma/client';

import { ATTRIBUTION_OUTCOME, CampaignAttributionService } from './campaign-attribution.service';
import { CampaignPromoterService } from './campaign-promoter.service';
import { ReferralLifecycleService } from './referral-lifecycle.service';
import { ReferralsService } from './referrals.service';

import type { AuditService } from '../audit/audit.service';
import type { DomainEventBus } from '../events/domain-event-bus';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * DPX-PROMO-REF-001 — attribution against a real database.
 *
 * The property that matters most here cannot be tested any other way: two
 * promoters racing for the same new customer must produce exactly one
 * acquisition. That is a unique constraint doing its job under real
 * concurrency, and a mocked prisma would only prove the mock was written to
 * agree.
 */
describe('CampaignAttributionService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let attribution: CampaignAttributionService;
  let promoters: CampaignPromoterService;
  const createdUserIds: string[] = [];
  const createdPromotionIds: string[] = [];
  const ADMIN = '99999999-9999-4999-8999-999999999999';
  const ctx = { ipAddress: '127.0.0.1' };

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
    const audit = { record: () => Promise.resolve(undefined) } as unknown as AuditService;
    const bus = { emit: () => Promise.resolve(undefined) } as unknown as DomainEventBus;
    const lifecycle = new ReferralLifecycleService(
      prisma,
      audit,
      bus,
      { credit: () => Promise.resolve(undefined) } as never,
      { evaluate: () => Promise.resolve({ qualified: true }) } as never,
      { screen: () => Promise.resolve({ cleared: true }) } as never,
      { awardPoints: () => Promise.resolve(undefined) } as never,
    );
    const referrals = new ReferralsService(prisma, audit, bus, lifecycle);
    promoters = new CampaignPromoterService(prisma, referrals, audit);
    attribution = new CampaignAttributionService(prisma, lifecycle, audit);
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
    const u = await prisma.user.create({
      data: {
        email: `attr-${randomUUID()}@dripplex.test`,
        passwordHash: 'x',
        firstName: 'A',
        lastName: 'B',
      },
    });
    createdUserIds.push(u.id);
    return u.id;
  }

  async function aCampaign(status: PromotionStatus = PromotionStatus.ACTIVE): Promise<string> {
    const p = await prisma.promotion.create({
      data: { name: `C ${randomUUID()}`, type: PromotionType.REFERRAL, status },
    });
    createdPromotionIds.push(p.id);
    return p.id;
  }

  async function aPromoter(
    status: PromotionStatus = PromotionStatus.ACTIVE,
    participantType: CampaignParticipantType = CampaignParticipantType.INFLUENCER,
  ): Promise<{ promoter: CampaignPromoter; promotionId: string; userId: string }> {
    const promotionId = await aCampaign(status);
    const userId = await aUser();
    const promoter = await promoters.addPromoter(
      { promotionId, userId, participantType, reward: { amountNgn: 150 } },
      ADMIN,
    );
    return { promoter, promotionId, userId };
  }

  it('records the exact campaign, promoter and token', async () => {
    if (!databaseAvailable) return;
    const { promoter, promotionId } = await aPromoter();
    const referee = await aUser();

    const result = await attribution.attribute(referee, promoter.token, ctx);

    expect(result.outcome).toBe(ATTRIBUTION_OUTCOME.ATTRIBUTED);
    const row = await prisma.referralRedemption.findUniqueOrThrow({
      where: { refereeUserId: referee },
    });
    expect(row.campaignPromoterId).toBe(promoter.id);
    expect(row.campaignPromoterId).not.toBeNull();
    const back = await prisma.campaignPromoter.findUniqueOrThrow({
      where: { id: row.campaignPromoterId ?? '' },
    });
    expect(back.promotionId).toBe(promotionId);
    expect(back.token).toBe(promoter.token);
  });

  it('resolves a token however it was typed', async () => {
    if (!databaseAvailable) return;
    const { promoter } = await aPromoter();
    const referee = await aUser();
    const result = await attribution.attribute(referee, `  ${promoter.token.toLowerCase()}  `, ctx);
    expect(result.outcome).toBe(ATTRIBUTION_OUTCOME.ATTRIBUTED);
  });

  it('pays nothing and discounts nothing', async () => {
    if (!databaseAvailable) return;
    // Attribution establishes eligibility. If it moved money it would be paying
    // before anti-abuse has looked, which is the whole reason the hold exists.
    const { promoter, userId } = await aPromoter();
    const referee = await aUser();

    await attribution.attribute(referee, promoter.token, ctx);

    const row = await prisma.referralRedemption.findUniqueOrThrow({
      where: { refereeUserId: referee },
    });
    expect(row.status).toBe('PENDING');
    expect(row.referrerRewardAmount).toBeNull();
    expect(row.refereeRewardAmount).toBeNull();
    expect(row.paidAt).toBeNull();
    const wallets = await prisma.wallet.count({
      where: { ownerId: { in: [userId, referee] }, ownerType: WalletOwnerType.CUSTOMER },
    });
    expect(wallets).toBe(0);
    const promoRedemptions = await prisma.promotionRedemption.count({ where: { userId: referee } });
    expect(promoRedemptions).toBe(0);
  });

  it('refuses an unknown token, a self-referral, and a removed promoter', async () => {
    if (!databaseAvailable) return;
    const { promoter, userId } = await aPromoter();
    const referee = await aUser();

    expect((await attribution.attribute(referee, 'NOTATOKEN', ctx)).outcome).toBe(
      ATTRIBUTION_OUTCOME.TOKEN_UNKNOWN,
    );
    expect((await attribution.attribute(userId, promoter.token, ctx)).outcome).toBe(
      ATTRIBUTION_OUTCOME.SELF_REFERRAL,
    );

    await promoters.removePromoter(promoter.id, ADMIN);
    expect((await attribution.attribute(referee, promoter.token, ctx)).outcome).toBe(
      ATTRIBUTION_OUTCOME.PROMOTER_INACTIVE,
    );
    expect(await prisma.referralRedemption.count({ where: { refereeUserId: referee } })).toBe(0);
  });

  it.each([
    [PromotionStatus.PAUSED],
    [PromotionStatus.EXPIRED],
    [PromotionStatus.ARCHIVED],
    [PromotionStatus.CANCELLED],
  ])('refuses to acquire under a %s campaign', async (status) => {
    if (!databaseAvailable) return;
    // PAUSED is refused with the terminal states on purpose: a pause that kept
    // acquiring would leave an operator who stopped their spend still owing
    // rewards for everything that arrived afterwards.
    const { promoter, promotionId } = await aPromoter();
    await prisma.promotion.update({ where: { id: promotionId }, data: { status } });
    const referee = await aUser();

    const result = await attribution.attribute(referee, promoter.token, ctx);

    expect(result.outcome).toBe(ATTRIBUTION_OUTCOME.CAMPAIGN_CLOSED);
    expect(await prisma.referralRedemption.count({ where: { refereeUserId: referee } })).toBe(0);
  });

  it('is idempotent when the same token arrives twice', async () => {
    if (!databaseAvailable) return;
    const { promoter } = await aPromoter();
    const referee = await aUser();

    const first = await attribution.attribute(referee, promoter.token, ctx);
    const second = await attribution.attribute(referee, promoter.token, ctx);

    expect(first.outcome).toBe(ATTRIBUTION_OUTCOME.ATTRIBUTED);
    expect(second.outcome).toBe(ATTRIBUTION_OUTCOME.ALREADY_ATTRIBUTED);
    expect(second.redemptionId).toBe(first.redemptionId);
    expect(await prisma.referralRedemption.count({ where: { refereeUserId: referee } })).toBe(1);
  });

  it('gives a second promoter ALREADY_ACQUIRED rather than a second acquisition', async () => {
    if (!databaseAvailable) return;
    const a = await aPromoter();
    const b = await aPromoter();
    const referee = await aUser();

    const first = await attribution.attribute(referee, a.promoter.token, ctx);
    const second = await attribution.attribute(referee, b.promoter.token, ctx);

    expect(first.outcome).toBe(ATTRIBUTION_OUTCOME.ATTRIBUTED);
    expect(second.outcome).toBe(ATTRIBUTION_OUTCOME.ALREADY_ACQUIRED);
    // The loser is told who holds it, so Operations can answer "why was my
    // promoter not credited" without reading the table by hand.
    expect(second.campaignPromoterId).toBe(a.promoter.id);
    expect(await prisma.referralRedemption.count({ where: { refereeUserId: referee } })).toBe(1);
  });

  it('refuses rather than writing an acquisition nobody could be paid for', async () => {
    if (!databaseAvailable) return;
    // ReferralRedemption.referralId is NOT NULL. Enrolment guarantees the
    // promoter's referral row precisely so this cannot happen — but if it ever
    // does, refusing is better than a foreign-key error surfacing at
    // qualification, on live money, for somebody who has done the work. This
    // guard survived the first mutation run because nothing exercised it.
    const { promoter, userId } = await aPromoter();
    await prisma.referral.deleteMany({ where: { userId } });
    const referee = await aUser();

    const result = await attribution.attribute(referee, promoter.token, ctx);

    expect(result.outcome).toBe(ATTRIBUTION_OUTCOME.PROMOTER_INACTIVE);
    expect(await prisma.referralRedemption.count({ where: { refereeUserId: referee } })).toBe(0);
  });

  it('lets exactly one of two racing promoters win, every time', async () => {
    if (!databaseAvailable) return;
    // Measured as a ratio over repeated runs, not asserted from one green pass:
    // a race that happens to serialise once proves nothing about the guard.
    const RUNS = 10;
    let attributed = 0;
    let alreadyAcquired = 0;

    for (let i = 0; i < RUNS; i += 1) {
      const a = await aPromoter();
      const b = await aPromoter();
      const referee = await aUser();

      const [ra, rb] = await Promise.all([
        attribution.attribute(referee, a.promoter.token, ctx),
        attribution.attribute(referee, b.promoter.token, ctx),
      ]);

      const outcomes = [ra.outcome, rb.outcome];
      attributed += outcomes.filter((o) => o === ATTRIBUTION_OUTCOME.ATTRIBUTED).length;
      alreadyAcquired += outcomes.filter((o) => o === ATTRIBUTION_OUTCOME.ALREADY_ACQUIRED).length;

      const rows = await prisma.referralRedemption.findMany({ where: { refereeUserId: referee } });
      expect(rows).toHaveLength(1);
      // The surviving row is attributed to one of the two racers and to a real
      // participation — never null, never a mix.
      expect([a.promoter.id, b.promoter.id]).toContain(rows[0]?.campaignPromoterId);
    }

    expect(attributed).toBe(RUNS);
    expect(alreadyAcquired).toBe(RUNS);
  });
});
