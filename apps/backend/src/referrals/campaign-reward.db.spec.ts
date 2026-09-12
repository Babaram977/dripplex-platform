import { randomUUID } from 'node:crypto';

import {
  CampaignParticipantType,
  LoyaltyLedgerEntryType,
  PrismaClient,
  PromotionType,
  ReferralOwnerType,
  ReferralRedemptionStatus,
  ReferralRefereeType,
  WalletOwnerType,
  type ReferralProgramme,
} from '@prisma/client';

import { LOYALTY_SETTING_ID } from '../loyalty/loyalty.constants';

import { ReferralLifecycleService } from './referral-lifecycle.service';
import { REFERRAL_WALLET_REFERENCE_TYPES } from './referral.constants';

import type { AuditService } from '../audit/audit.service';
import type { DomainEventBus } from '../events/domain-event-bus';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * DPX-PROMO-REF-001 — the reward, from qualification to payment.
 *
 * The snapshot is the whole point: what somebody earned is decided once, at
 * qualification, and nothing an operator does afterwards may move it.
 */
describe('campaign reward through the referral lifecycle', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let lifecycle: ReferralLifecycleService;
  const awarded: { userId: string; points: number; type?: LoyaltyLedgerEntryType }[] = [];
  const credited: { ownerType: WalletOwnerType; ownerId: string; amount: number }[] = [];
  const debited: { ownerType: WalletOwnerType; ownerId: string; amount: number }[] = [];
  const pointsReversals: { userId: string; referenceType: string; referenceId: string }[] = [];
  const users: string[] = [];
  let originalProgramme: ReferralProgramme | null = null;
  const promos: string[] = [];

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
    lifecycle = new ReferralLifecycleService(
      prisma,
      audit,
      bus,
      {
        credit: (i: { ownerType: WalletOwnerType; ownerId: string; amount: number }) => {
          credited.push(i);
          return Promise.resolve(undefined);
        },
        debit: (i: { ownerType: WalletOwnerType; ownerId: string; amount: number }) => {
          debited.push(i);
          return Promise.resolve(undefined);
        },
      } as never,
      { evaluate: () => Promise.resolve({ qualified: true, reason: null }) } as never,
      { screen: () => Promise.resolve({ reject: null, flag: null }) } as never,
      {
        awardPoints: (i: { userId: string; points: number; type?: LoyaltyLedgerEntryType }) => {
          awarded.push(i);
          return Promise.resolve(undefined);
        },
        reversePointsFor: (i: { userId: string; referenceType: string; referenceId: string }) => {
          pointsReversals.push(i);
          return Promise.resolve({ reversed: 0, shortfall: 0 });
        },
      } as never,
    );
    // The CUSTOMER programme is a singleton this suite has to change, and it is
    // shared with every other spec in the run. The first version of this file
    // set it and never put it back, which quietly broke five assertions in
    // referral-lifecycle.db.spec.ts — a failure that belongs to this file and
    // surfaces in another. So the original is kept and restored in afterAll.
    originalProgramme = await prisma.referralProgramme.findUnique({
      where: { refereeType: ReferralRefereeType.CUSTOMER },
    });
    await prisma.referralProgramme.upsert({
      where: { refereeType: ReferralRefereeType.CUSTOMER },
      update: { referrerRewardAmount: 150, refereeRewardAmount: 150, holdDays: 0, active: true },
      create: {
        refereeType: ReferralRefereeType.CUSTOMER,
        referrerRewardAmount: 150,
        refereeRewardAmount: 150,
        holdDays: 0,
      },
    });
  });

  afterEach(() => {
    awarded.length = 0;
    credited.length = 0;
    debited.length = 0;
    pointsReversals.length = 0;
  });

  afterAll(async () => {
    if (!databaseAvailable) return;
    if (originalProgramme !== null) {
      await prisma.referralProgramme.update({
        where: { refereeType: ReferralRefereeType.CUSTOMER },
        data: {
          referrerRewardAmount: originalProgramme.referrerRewardAmount,
          refereeRewardAmount: originalProgramme.refereeRewardAmount,
          holdDays: originalProgramme.holdDays,
          active: originalProgramme.active,
        },
      });
    }
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
        email: `rw-${randomUUID()}@dripplex.test`,
        passwordHash: 'x',
        firstName: 'R',
        lastName: 'W',
      },
    });
    users.push(u.id);
    return u.id;
  }

  /** An acquisition sitting PENDING, attributed to a campaign paying `reward`. */
  async function anAcquisition(
    reward: { rewardAmount?: number; rewardPoints?: number },
    ownerType: ReferralOwnerType = ReferralOwnerType.DRIVER,
    participantType: CampaignParticipantType = CampaignParticipantType.PIONEER_DRIVER,
  ): Promise<{
    redemption: { id: string };
    promoter: { id: string };
    promoterUserId: string;
    refereeUserId: string;
  }> {
    const promoterUserId = await aUser();
    const refereeUserId = await aUser();
    const promo = await prisma.promotion.create({
      data: { name: `C ${randomUUID()}`, type: PromotionType.REFERRAL },
    });
    promos.push(promo.id);
    const referral = await prisma.referral.create({
      data: { userId: promoterUserId, ownerType, code: randomUUID().slice(0, 8).toUpperCase() },
    });
    const promoter = await prisma.campaignPromoter.create({
      data: {
        promotionId: promo.id,
        userId: promoterUserId,
        participantType,
        token: randomUUID().replace(/-/g, '').slice(0, 32).toUpperCase(),
        rewardAmount: reward.rewardAmount ?? null,
        rewardPoints: reward.rewardPoints ?? null,
      },
    });
    const redemption = await prisma.referralRedemption.create({
      data: {
        referralId: referral.id,
        refereeUserId,
        refereeType: ReferralRefereeType.CUSTOMER,
        campaignPromoterId: promoter.id,
      },
    });
    return { redemption, promoter, promoterUserId, refereeUserId };
  }

  it.each([
    ['Customer', CampaignParticipantType.CUSTOMER, ReferralOwnerType.CUSTOMER, 150],
    ['Driver', CampaignParticipantType.DRIVER, ReferralOwnerType.DRIVER, 200],
    ['Pioneer driver', CampaignParticipantType.PIONEER_DRIVER, ReferralOwnerType.DRIVER, 350],
  ])(
    '%s earns ₦%i and the referee always earns ₦150',
    async (_l, participantType, ownerType, ngn) => {
      if (!databaseAvailable) return;
      const { redemption } = await anAcquisition({ rewardAmount: ngn }, ownerType, participantType);

      await lifecycle.advance(redemption.id);

      const row = await prisma.referralRedemption.findUniqueOrThrow({
        where: { id: redemption.id },
      });
      expect(Number(row.referrerRewardAmount)).toBe(ngn);
      // Fixed platform-wide, whoever referred them: no campaign can outbid
      // another for the same acquisition.
      expect(Number(row.refereeRewardAmount)).toBe(150);
      expect(row.referrerRewardPoints).toBeNull();
    },
  );

  it('pays a cash reward into the wallet the referral owner type names', async () => {
    if (!databaseAvailable) return;
    const { redemption, promoterUserId } = await anAcquisition({ rewardAmount: 350 });

    await lifecycle.advance(redemption.id);
    await lifecycle.advance(redemption.id);
    await lifecycle.advance(redemption.id);

    const referrerCredit = credited.find((c) => c.ownerId === promoterUserId);
    expect(referrerCredit).toMatchObject({ ownerType: WalletOwnerType.DRIVER, amount: 350 });
    expect(awarded).toHaveLength(0);
  });

  it('pays a points reward through the DX Points ledger, never as wallet cash', async () => {
    if (!databaseAvailable) return;
    // The guardrail: points must not become a second settlement path. They
    // enter the loyalty ledger as BONUS and the holder cashes out, if they
    // want to, through the redemption path Operations already controls.
    const { redemption, promoterUserId } = await anAcquisition({ rewardPoints: 35_000 });

    await lifecycle.advance(redemption.id);
    const qualified = await prisma.referralRedemption.findUniqueOrThrow({
      where: { id: redemption.id },
    });
    expect(qualified.referrerRewardPoints).toBe(35_000);
    expect(qualified.referrerRewardAmount).toBeNull();
    expect(qualified.pointsPerNairaAtGrant).toBe(100);

    await lifecycle.advance(redemption.id);
    await lifecycle.advance(redemption.id);

    expect(awarded).toContainEqual(
      expect.objectContaining({
        userId: promoterUserId,
        points: 35_000,
        type: LoyaltyLedgerEntryType.BONUS,
      }),
    );
    expect(credited.find((c) => c.ownerId === promoterUserId)).toBeUndefined();
  });

  it('does not move money at qualification, because the hold has not run', async () => {
    if (!databaseAvailable) return;
    // The suite's programme uses holdDays 0, under which one advance() runs
    // PENDING -> QUALIFIED -> APPROVED -> PAID in a single cascade — which is
    // how the first version of this test accidentally asserted a paid row was
    // unpaid. A real hold is what separates qualification from payment, so the
    // only honest way to assert "qualification pays nothing" is with one set.
    await prisma.referralProgramme.update({
      where: { refereeType: ReferralRefereeType.CUSTOMER },
      data: { holdDays: 7 },
    });
    try {
      const { redemption } = await anAcquisition({ rewardAmount: 350 });

      await lifecycle.advance(redemption.id);

      const row = await prisma.referralRedemption.findUniqueOrThrow({
        where: { id: redemption.id },
      });
      expect(row.status).toBe(ReferralRedemptionStatus.QUALIFIED);
      expect(row.paidAt).toBeNull();
      // Snapshotted, but not a penny moved.
      expect(Number(row.referrerRewardAmount)).toBe(350);
      expect(credited).toHaveLength(0);
      expect(awarded).toHaveLength(0);
    } finally {
      await prisma.referralProgramme.update({
        where: { refereeType: ReferralRefereeType.CUSTOMER },
        data: { holdDays: 0 },
      });
    }
  });

  it('freezes the reward: re-pricing the campaign afterwards changes nothing', async () => {
    if (!databaseAvailable) return;
    const { redemption, promoter } = await anAcquisition({ rewardAmount: 350 });
    await lifecycle.advance(redemption.id);

    await prisma.campaignPromoter.update({
      where: { id: promoter.id },
      data: { rewardAmount: 1000 },
    });
    await prisma.referralProgramme.update({
      where: { refereeType: ReferralRefereeType.CUSTOMER },
      data: { referrerRewardAmount: 999, refereeRewardAmount: 999 },
    });
    await lifecycle.advance(redemption.id);
    await lifecycle.advance(redemption.id);

    const row = await prisma.referralRedemption.findUniqueOrThrow({ where: { id: redemption.id } });
    expect(Number(row.referrerRewardAmount)).toBe(350);
    expect(Number(row.refereeRewardAmount)).toBe(150);
    expect(credited.find((c) => c.amount === 1000)).toBeUndefined();

    await prisma.referralProgramme.update({
      where: { refereeType: ReferralRefereeType.CUSTOMER },
      data: { referrerRewardAmount: 150, refereeRewardAmount: 150 },
    });
  });

  it('freezes the points rate too, so a later repricing cannot restate the cost', async () => {
    if (!databaseAvailable) return;
    const { redemption } = await anAcquisition({ rewardPoints: 15_000 });
    await lifecycle.advance(redemption.id);

    await prisma.loyaltySetting.update({
      where: { id: LOYALTY_SETTING_ID },
      data: { pointsPerNaira: 50, minRedemptionPoints: 50 },
    });
    await lifecycle.advance(redemption.id);

    const row = await prisma.referralRedemption.findUniqueOrThrow({ where: { id: redemption.id } });
    expect(row.pointsPerNairaAtGrant).toBe(100);
    expect(row.referrerRewardPoints).toBe(15_000);

    await prisma.loyaltySetting.update({
      where: { id: LOYALTY_SETTING_ID },
      data: { pointsPerNaira: 100, minRedemptionPoints: 100 },
    });
  });

  /**
   * DPX-PROMO-REF-001 audit, F5 — reversal is symmetric with payment.
   *
   * A points reward was never wallet cash. Reversing it through the wallet
   * would invent a debt in a currency the promoter was never credited in, and
   * before this the points path was simply skipped: the row read REVERSED and
   * nothing at all came back.
   */
  it('reverses a points reward through the points ledger, not the wallet', async () => {
    if (!databaseAvailable) return;
    const { redemption, promoterUserId } = await anAcquisition({ rewardPoints: 35_000 });

    await lifecycle.advance(redemption.id);
    expect(awarded).toHaveLength(1);

    await lifecycle.reverse(redemption.id, 'Fraudulent acquisition', await aUser());

    // Keyed identically to the award. That is what makes a replayed reversal
    // take nothing more, and what lets `reversePointsFor` find the grant it is
    // undoing at all.
    expect(pointsReversals).toHaveLength(1);
    expect(pointsReversals[0]).toMatchObject({
      userId: promoterUserId,
      referenceType: REFERRAL_WALLET_REFERENCE_TYPES.REFERRER_REWARD,
      referenceId: redemption.id,
    });
    // Never a wallet debit for the promoter: they hold points, not naira.
    expect(debited.some((d) => d.ownerId === promoterUserId)).toBe(false);
    const row = await prisma.referralRedemption.findUniqueOrThrow({
      where: { id: redemption.id },
    });
    expect(row.status).toBe(ReferralRedemptionStatus.REVERSED);
  });

  it('reverses a cash reward through the wallet, not the points ledger', async () => {
    if (!databaseAvailable) return;
    const { redemption, promoterUserId } = await anAcquisition({ rewardAmount: 350 });

    await lifecycle.advance(redemption.id);
    await lifecycle.reverse(redemption.id, 'Fraudulent acquisition', await aUser());

    expect(debited.some((d) => d.ownerId === promoterUserId && d.amount === 350)).toBe(true);
    expect(pointsReversals).toHaveLength(0);
  });

  it('cannot qualify twice, however many times it is advanced concurrently', async () => {
    if (!databaseAvailable) return;
    // The snapshot is written by a conditional update on PENDING, so a replay
    // or a race cannot write a second reward over the first.
    const { redemption } = await anAcquisition({ rewardAmount: 350 });

    await Promise.all([
      lifecycle.advance(redemption.id),
      lifecycle.advance(redemption.id),
      lifecycle.advance(redemption.id),
    ]);

    const row = await prisma.referralRedemption.findUniqueOrThrow({ where: { id: redemption.id } });
    expect(Number(row.referrerRewardAmount)).toBe(350);
    expect(await prisma.referralRedemption.count({ where: { id: redemption.id } })).toBe(1);
  });
});
