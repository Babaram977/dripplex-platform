import { randomUUID } from 'node:crypto';

import {
  CampaignParticipantType,
  CampaignPromoterStatus,
  PrismaClient,
  PromotionType,
  ReferralOwnerType,
  ReferralRedemptionStatus,
  ReferralRefereeType,
  RideStatus,
  RideType,
} from '@prisma/client';

import { CampaignPromoterService } from '../referrals/campaign-promoter.service';
import { ReferralsService } from '../referrals/referrals.service';

import { OperationsPromotionsService } from './operations-promotions.service';

import type { AuditService } from '../audit/audit.service';
import type { DomainEventBus } from '../events/domain-event-bus';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * DPX-PROMO-REF-001 — what the Promotions tab reads and writes.
 *
 * The tab decides nothing financial: every figure here is an aggregate of rows
 * the referral engine already owns, and every mutation delegates. These tests
 * exist to prove exactly that — that Ops configures and displays, and does not
 * quietly become a second source of truth for what somebody earned.
 */
describe('OperationsPromotionsService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let ops: OperationsPromotionsService;
  const audited: { action: string; resourceId?: string }[] = [];
  const users: string[] = [];
  const promos: string[] = [];
  const ADMIN = '99999999-9999-4999-8999-999999999999';
  const ctx = { userId: ADMIN };

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
    const audit = {
      record: (action: string, _c: unknown, meta: { resourceId?: string }) => {
        audited.push({
          action,
          ...(meta.resourceId === undefined ? {} : { resourceId: meta.resourceId }),
        });
        return Promise.resolve(undefined);
      },
    } as unknown as AuditService;
    const bus = { emit: () => Promise.resolve(undefined) } as unknown as DomainEventBus;
    const referrals = new ReferralsService(prisma, audit, bus, {
      advance: () => Promise.resolve(undefined),
    } as never);
    ops = new OperationsPromotionsService(
      prisma,
      new CampaignPromoterService(prisma, referrals, audit),
    );
  });

  afterEach(() => {
    audited.length = 0;
  });

  afterAll(async () => {
    if (!databaseAvailable) return;
    await prisma.ride.deleteMany({ where: { customerId: { in: users } } });
    await prisma.referralRedemption.deleteMany({ where: { refereeUserId: { in: users } } });
    await prisma.campaignPromoter.deleteMany({ where: { userId: { in: users } } });
    await prisma.referral.deleteMany({ where: { userId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.promotion.deleteMany({ where: { id: { in: promos } } });
    await prisma.$disconnect();
  });

  async function aUser(): Promise<string> {
    const u = await prisma.user.create({
      data: {
        email: `ops-${randomUUID()}@dripplex.test`,
        passwordHash: 'x',
        firstName: 'Ops',
        lastName: 'Test',
      },
    });
    users.push(u.id);
    return u.id;
  }

  async function aCampaign(): Promise<string> {
    const p = await prisma.promotion.create({
      data: { name: `Kano ${randomUUID()}`, type: PromotionType.REFERRAL },
    });
    promos.push(p.id);
    return p.id;
  }

  /** A campaign with one promoter already enrolled on the given reward. */
  async function aCampaignWithPromoter(reward: {
    rewardAmountNgn?: number;
    rewardPoints?: number;
  }): Promise<{ promotionId: string; promoterId: string }> {
    const [promotionId, userId] = [await aCampaign(), await aUser()];
    const row = await ops.addPromoter(
      promotionId,
      { userId, participantType: CampaignParticipantType.INFLUENCER, ...reward },
      ADMIN,
      ctx,
    );
    return { promotionId, promoterId: row.id };
  }

  /** A redemption attributed to a promoter, written straight in so the reward
   *  snapshot can be set to a historical rate this run never produced. */
  async function seedRedemption(
    campaignPromoterId: string,
    fields: {
      status: ReferralRedemptionStatus;
      referrerRewardPoints: number;
      pointsPerNairaAtGrant: number | null;
    },
  ): Promise<void> {
    const promoter = await prisma.campaignPromoter.findUniqueOrThrow({
      where: { id: campaignPromoterId },
    });
    const referral = await prisma.referral.findUniqueOrThrow({
      where: { userId: promoter.userId },
    });
    await prisma.referralRedemption.create({
      data: {
        referralId: referral.id,
        refereeUserId: await aUser(),
        refereeType: ReferralRefereeType.CUSTOMER,
        campaignPromoterId,
        status: fields.status,
        referrerRewardPoints: fields.referrerRewardPoints,
        pointsPerNairaAtGrant: fields.pointsPerNairaAtGrant,
      },
    });
  }

  it('adds a promoter, ensuring their Referral and issuing a private token', async () => {
    if (!databaseAvailable) return;
    const [promotionId, userId] = [await aCampaign(), await aUser()];

    const row = await ops.addPromoter(
      promotionId,
      { userId, participantType: CampaignParticipantType.PIONEER_DRIVER, rewardAmountNgn: 350 },
      ADMIN,
      ctx,
    );

    expect(row.token).toHaveLength(32);
    expect(row.rewardAmountNgn).toBe(350);
    expect(row.status).toBe(CampaignPromoterStatus.ACTIVE);
    // The public code is created, and is NOT the campaign token.
    const publicCode = await prisma.referral.findUniqueOrThrow({ where: { userId } });
    expect(publicCode.code).not.toBe(row.token);
    expect(publicCode.ownerType).toBe(ReferralOwnerType.DRIVER);
    expect(audited.map((a) => a.action)).toContain('campaign.promoter.added');
  });

  it('refuses a reward that is both cash and points', async () => {
    if (!databaseAvailable) return;
    const [promotionId, userId] = [await aCampaign(), await aUser()];
    await expect(
      ops.addPromoter(
        promotionId,
        {
          userId,
          participantType: CampaignParticipantType.INFLUENCER,
          rewardAmountNgn: 150,
          rewardPoints: 15_000,
        },
        ADMIN,
        ctx,
      ),
    ).rejects.toThrow(/exactly one/i);
  });

  it('refuses a duplicate, and the second attempt writes nothing', async () => {
    if (!databaseAvailable) return;
    const [promotionId, userId] = [await aCampaign(), await aUser()];
    const input = {
      userId,
      participantType: CampaignParticipantType.CREATOR,
      rewardPoints: 15_000,
    } as const;
    await ops.addPromoter(promotionId, input, ADMIN, ctx);

    await expect(ops.addPromoter(promotionId, input, ADMIN, ctx)).rejects.toThrow(
      /already an active/i,
    );
    expect(await prisma.campaignPromoter.count({ where: { promotionId, userId } })).toBe(1);
  });

  it('removes a promoter without losing a single historical row', async () => {
    if (!databaseAvailable) return;
    const [promotionId, userId, referee] = [await aCampaign(), await aUser(), await aUser()];
    const promoter = await ops.addPromoter(
      promotionId,
      { userId, participantType: CampaignParticipantType.AMBASSADOR, rewardAmountNgn: 150 },
      ADMIN,
      ctx,
    );
    const referral = await prisma.referral.findUniqueOrThrow({ where: { userId } });
    await prisma.referralRedemption.create({
      data: {
        referralId: referral.id,
        refereeUserId: referee,
        refereeType: ReferralRefereeType.CUSTOMER,
        status: ReferralRedemptionStatus.PAID,
        campaignPromoterId: promoter.id,
        referrerRewardAmount: 150,
        refereeRewardAmount: 150,
      },
    });

    const removed = await ops.removePromoter(promoter.id, ADMIN, ctx);

    expect(removed.status).toBe(CampaignPromoterStatus.REMOVED);
    const after = await prisma.campaignPromoter.findUniqueOrThrow({ where: { id: promoter.id } });
    expect(after.token).toBe(promoter.token);
    expect(
      await prisma.referralRedemption.count({ where: { campaignPromoterId: promoter.id } }),
    ).toBe(1);
    expect(audited.map((a) => a.action)).toContain('campaign.promoter.removed');
  });

  it('reports performance from the referral rows, not from its own arithmetic', async () => {
    if (!databaseAvailable) return;
    const [promotionId, userId] = [await aCampaign(), await aUser()];
    const promoter = await ops.addPromoter(
      promotionId,
      { userId, participantType: CampaignParticipantType.DRIVER, rewardAmountNgn: 200 },
      ADMIN,
      ctx,
    );
    const referral = await prisma.referral.findUniqueOrThrow({ where: { userId } });
    const rode = await aUser();
    const didNot = await aUser();
    await prisma.referralRedemption.createMany({
      data: [
        {
          referralId: referral.id,
          refereeUserId: rode,
          refereeType: ReferralRefereeType.CUSTOMER,
          status: ReferralRedemptionStatus.PAID,
          campaignPromoterId: promoter.id,
          referrerRewardAmount: 200,
          refereeRewardAmount: 150,
        },
        {
          referralId: referral.id,
          refereeUserId: didNot,
          refereeType: ReferralRefereeType.CUSTOMER,
          status: ReferralRedemptionStatus.PENDING,
          campaignPromoterId: promoter.id,
        },
      ],
    });
    await prisma.ride.createMany({
      data: [
        {
          customerId: rode,
          rideType: RideType.ECONOMY,
          status: RideStatus.COMPLETED,
          pickupLatitude: 12,
          pickupLongitude: 8,
          dropoffLatitude: 12.1,
          dropoffLongitude: 8.1,
        },
        // The other referee took a ride and cancelled it. Without this the
        // status filter is unasserted: a mutation counting every ride passed
        // the whole suite.
        {
          customerId: didNot,
          rideType: RideType.ECONOMY,
          status: RideStatus.CANCELLED,
          pickupLatitude: 12,
          pickupLongitude: 8,
          dropoffLatitude: 12.1,
          dropoffLongitude: 8.1,
        },
      ],
    });

    const detail = await ops.getCampaign(promotionId);
    const p = detail.promoters[0];

    expect(p?.performance.totalReferrals).toBe(2);
    expect(p?.performance.qualifiedReferrals).toBe(1);
    // Counted from rides, because qualification also accepts a completed
    // marketplace order — "qualified" and "took their first ride" differ.
    expect(p?.performance.firstCompletedRides).toBe(1);
    expect(p?.performance.conversionRate).toBe(0.5);
    expect(p?.performance.rewardsPaidNgn).toBe(200);
    expect(p?.performance.rewardsPendingNgn).toBe(0);
    expect(detail.performance.totalReferrals).toBe(2);
  });

  /**
   * DPX-PROMO-REF-001 audit, F4 — points are valued at the rate that granted
   * them.
   *
   * `pointsPerNairaAtGrant` exists so a repricing cannot restate what somebody
   * earned. Aggregating the points and dividing by today's rate threw that
   * away: two grants of 15,000, one made at 200:1 and one at 100:1, cost ₦75
   * and ₦150 — ₦225 together, not the ₦300 that dividing 30,000 by 100 gives.
   */
  it('values points rewards at each grant own rate, never at today rate', async () => {
    if (!databaseAvailable) return;
    const { promotionId, promoterId } = await aCampaignWithPromoter({ rewardPoints: 15_000 });

    await seedRedemption(promoterId, {
      status: ReferralRedemptionStatus.PAID,
      referrerRewardPoints: 15_000,
      pointsPerNairaAtGrant: 200,
    });
    await seedRedemption(promoterId, {
      status: ReferralRedemptionStatus.PAID,
      referrerRewardPoints: 15_000,
      pointsPerNairaAtGrant: 100,
    });

    const detail = await ops.getCampaign(promotionId);
    expect(detail.performance.rewardsEarnedPoints).toBe(30_000);
    expect(detail.performance.rewardsEarnedPointsValueNgn).toBe(225);
    // Never the naive conversion.
    expect(detail.performance.rewardsEarnedPointsValueNgn).not.toBe(300);
  });

  it('refuses to total a points value when a grant carries no rate', async () => {
    if (!databaseAvailable) return;
    const { promotionId, promoterId } = await aCampaignWithPromoter({ rewardPoints: 15_000 });
    await seedRedemption(promoterId, {
      status: ReferralRedemptionStatus.PAID,
      referrerRewardPoints: 15_000,
      pointsPerNairaAtGrant: null,
    });

    const detail = await ops.getCampaign(promotionId);
    // Null rather than a partial total a caller would read as complete.
    expect(detail.performance.rewardsEarnedPointsValueNgn).toBeNull();
    expect(detail.performance.rewardsEarnedPoints).toBe(15_000);
  });

  it('states the promoter configured reward value, so no client divides', async () => {
    if (!databaseAvailable) return;
    const { promotionId } = await aCampaignWithPromoter({ rewardPoints: 35_000 });

    const detail = await ops.getCampaign(promotionId);
    expect(detail.pointsPerNaira).toBe(100);
    // Today's rate is right here — this is what the next acquisition pays,
    // not what a past one did.
    expect(detail.promoters[0]?.rewardPointsValueNgn).toBe(350);
  });

  it('shows the acquisition incentive read-only, and never per campaign', async () => {
    if (!databaseAvailable) return;
    const INCENTIVE = '00000000-0000-4000-8000-00000000200a';
    const before = await ops.acquisitionIncentiveUsage();
    const rider = await aUser();
    await prisma.ride.createMany({
      data: [
        {
          customerId: rider,
          rideType: RideType.ECONOMY,
          status: RideStatus.COMPLETED,
          promotionId: INCENTIVE,
          promoDiscount: 200,
          pickupLatitude: 12,
          pickupLongitude: 8,
          dropoffLatitude: 12.1,
          dropoffLongitude: 8.1,
        },
        // A cancelled discounted ride costs nothing and must not be counted as
        // spend — the same rule the reservation uses to release its slot.
        {
          customerId: rider,
          rideType: RideType.ECONOMY,
          status: RideStatus.CANCELLED,
          promotionId: INCENTIVE,
          promoDiscount: 200,
          pickupLatitude: 12,
          pickupLongitude: 8,
          dropoffLatitude: 12.1,
          dropoffLongitude: 8.1,
        },
      ],
    });

    const usage = await ops.acquisitionIncentiveUsage();
    expect(usage.promotionId).toBe(INCENTIVE);
    expect(usage.status).toBe('ACTIVE');
    expect(usage.discountedRides).toBe(before.discountedRides + 1);
    expect(usage.totalDiscountNgn).toBe(before.totalDiscountNgn + 200);
    // It is one platform-wide row; a campaign detail never carries its own.
    expect(
      await prisma.promotion.count({
        where: { metadata: { path: ['kind'], equals: 'universal-acquisition-incentive' } },
      }),
    ).toBe(1);
  });

  /**
   * The three amounts a Promotions screen has to keep apart — 20%, three
   * rides, and the referee's naira reward — come from here, not from the
   * client. A UI that hardcoded them would keep displaying 20% after a founder
   * repriced the row, which is the failure this assertion exists to prevent.
   */
  it('states the incentive terms and the referee reward from server state', async () => {
    if (!databaseAvailable) return;
    const usage = await ops.acquisitionIncentiveUsage();

    expect(usage.percentOff).toBe(20);
    expect(usage.maxDiscountedRides).toBe(3);

    const programme = await prisma.referralProgramme.findUnique({
      where: { refereeType: ReferralRefereeType.CUSTOMER },
      select: { refereeRewardAmount: true },
    });
    expect(usage.refereeRewardNgn).toBe(
      programme === null ? null : Number(programme.refereeRewardAmount),
    );

    // Not the promoter's reward. The referee's reward is a property of the
    // programme, identical whoever referred them; the promoter's is a property
    // of their campaign row and varies 150/200/350.
    expect(usage.refereeRewardNgn).not.toBeNull();
  });

  it('follows the promotion row when the discount is repriced', async () => {
    if (!databaseAvailable) return;
    const INCENTIVE = '00000000-0000-4000-8000-00000000200a';
    const original = await prisma.promotion.findUniqueOrThrow({
      where: { id: INCENTIVE },
      select: { percentOff: true },
    });
    try {
      await prisma.promotion.update({
        where: { id: INCENTIVE },
        data: { percentOff: 25 },
      });
      expect((await ops.acquisitionIncentiveUsage()).percentOff).toBe(25);
    } finally {
      await prisma.promotion.update({
        where: { id: INCENTIVE },
        data: { percentOff: original.percentOff },
      });
    }
  });
});
