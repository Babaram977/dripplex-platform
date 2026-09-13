import { randomUUID } from 'node:crypto';

import {
  CampaignParticipantType,
  CampaignPromoterStatus,
  PromotionStatus,
  PromotionType,
  ReferralOwnerType,
  type ReferralRefereeType,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { CampaignPromoterService } from './campaign-promoter.service';
import { ReferralsService } from './referrals.service';

import type { ReferralLifecycleService } from './referral-lifecycle.service';
import type { AuditService } from '../audit/audit.service';
import type { DomainEventBus } from '../events/domain-event-bus';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * Founder ruling, 2026-09-13 — one code, one rate.
 *
 * A promoter does not get a second code to share. Their own referral code is
 * the only thing they ever hand out, and being enrolled on a campaign raises
 * what that one code pays: ₦350 instead of ₦150, never both. Remove them from
 * the campaign and it drops back.
 *
 * Before this, a personal referral code could never carry a campaign rate at
 * all — `campaignPromoterId` was set only by the private token path, so a
 * pioneer driver sharing their own code was paid the ordinary ₦150 while the
 * console showed ₦350 against their name.
 *
 * These tests are about which participation lands on the redemption at
 * registration, because that is what `advance()` later reads to decide what to
 * pay. They deliberately do not re-test the payment itself — campaign-reward
 * .db.spec already owns that.
 */
describe('a referral code carries its owner’s campaign rate', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let referrals: ReferralsService;
  const users: string[] = [];
  const promos: string[] = [];

  const ctx = { ipAddress: '127.0.0.1', userAgent: 'jest' };

  beforeAll(async () => {
    prisma = new PrismaService({ datasources: { db: { url: databaseUrl } } } as never);
    try {
      await prisma.$connect();
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
      return;
    }
    const audit = { record: () => Promise.resolve(undefined) } as unknown as AuditService;
    const bus = { emit: () => Promise.resolve(undefined) } as unknown as DomainEventBus;
    const lifecycle = {
      programmeFor: (t: ReferralRefereeType) =>
        prisma.referralProgramme.findUnique({ where: { refereeType: t } }),
    } as unknown as ReferralLifecycleService;
    referrals = new ReferralsService(prisma, audit, bus, lifecycle);
  }, 60_000);

  afterAll(async () => {
    if (databaseAvailable) {
      if (users.length > 0) {
        await prisma.referralRedemption.deleteMany({
          where: {
            OR: [{ refereeUserId: { in: users } }, { referral: { userId: { in: users } } }],
          },
        });
        await prisma.campaignPromoter.deleteMany({ where: { userId: { in: users } } });
        await prisma.referral.deleteMany({ where: { userId: { in: users } } });
        await prisma.user.deleteMany({ where: { id: { in: users } } });
      }
      if (promos.length > 0) {
        await prisma.promotion.deleteMany({ where: { id: { in: promos } } });
      }
    }
    await prisma.$disconnect();
  }, 60_000);

  const guard = (): boolean => {
    if (!databaseAvailable) {
      console.warn('DATABASE_URL not reachable — skipping referral-code campaign rate spec');
    }
    return databaseAvailable;
  };

  async function makeUser(): Promise<string> {
    const u = await prisma.user.create({
      data: {
        email: `ref-${randomUUID()}@example.test`,
        passwordHash: 'x',
        firstName: 'Test',
        lastName: 'Person',
      },
    });
    users.push(u.id);
    return u.id;
  }

  async function makeCampaign(status: PromotionStatus = PromotionStatus.ACTIVE): Promise<string> {
    const p = await prisma.promotion.create({
      data: { name: `Camp ${randomUUID().slice(0, 8)}`, type: PromotionType.REFERRAL, status },
    });
    promos.push(p.id);
    return p.id;
  }

  /** Enrol directly, so these tests are about attribution and not about the
   *  enrolment guard, which has its own tests below. */
  async function enrol(
    promotionId: string,
    userId: string,
    status: CampaignPromoterStatus = CampaignPromoterStatus.ACTIVE,
  ): Promise<string> {
    const row = await prisma.campaignPromoter.create({
      data: {
        promotionId,
        userId,
        participantType: CampaignParticipantType.PIONEER_DRIVER,
        token: randomUUID().replace(/-/g, '').slice(0, 24).toUpperCase(),
        rewardAmount: 350,
        status,
      },
    });
    return row.id;
  }

  async function redeemWithCodeOf(referrerUserId: string): Promise<{
    campaignPromoterId: string | null;
  } | null> {
    const code = await referrals.getOrCreateMyCode(referrerUserId, ReferralOwnerType.DRIVER, ctx);
    const referee = await makeUser();
    await referrals.tryRedeemAtRegistration(referee.valueOf(), code.code, ctx);
    return await prisma.referralRedemption.findFirst({
      where: { refereeUserId: referee },
      select: { campaignPromoterId: true },
    });
  }

  it('pays the campaign rate when the code’s owner is on a live campaign', async () => {
    if (!guard()) return;
    const promoter = await makeUser();
    const participationId = await enrol(await makeCampaign(), promoter);

    const redemption = await redeemWithCodeOf(promoter);

    // This is the whole ruling: the personal code now carries the campaign, so
    // advance() will pay ₦350 instead of the programme's ₦150.
    expect(redemption?.campaignPromoterId).toBe(participationId);
  }, 60_000);

  it('pays the ordinary rate when the owner is on no campaign', async () => {
    if (!guard()) return;
    const plain = await makeUser();

    const redemption = await redeemWithCodeOf(plain);

    // Null is what makes advance() fall back to the programme rate. The ₦150
    // path is unchanged, and that matters as much as the ₦350 one.
    expect(redemption).not.toBeNull();
    expect(redemption?.campaignPromoterId).toBeNull();
  }, 60_000);

  it('drops back to the ordinary rate once the promoter is removed', async () => {
    if (!guard()) return;
    const promoter = await makeUser();
    await enrol(await makeCampaign(), promoter, CampaignPromoterStatus.REMOVED);

    const redemption = await redeemWithCodeOf(promoter);

    // Removing somebody stops future participation without deleting history,
    // so the same code must go back to paying ₦150.
    expect(redemption?.campaignPromoterId).toBeNull();
  }, 60_000);

  it('does not carry a campaign that has been paused', async () => {
    if (!guard()) return;
    const promoter = await makeUser();
    await enrol(await makeCampaign(PromotionStatus.PAUSED), promoter);

    const redemption = await redeemWithCodeOf(promoter);

    expect(redemption?.campaignPromoterId).toBeNull();
  }, 60_000);

  it('does not carry a campaign that has been deleted', async () => {
    if (!guard()) return;
    const promoter = await makeUser();
    const promotionId = await makeCampaign();
    await enrol(promotionId, promoter);
    await prisma.promotion.update({ where: { id: promotionId }, data: { deletedAt: new Date() } });

    const redemption = await redeemWithCodeOf(promoter);

    expect(redemption?.campaignPromoterId).toBeNull();
  }, 60_000);

  it('carries a scheduled campaign, the same as the token path does', async () => {
    if (!guard()) return;
    const promoter = await makeUser();
    const participationId = await enrol(await makeCampaign(PromotionStatus.SCHEDULED), promoter);

    const redemption = await redeemWithCodeOf(promoter);

    // The two routes into an acquisition must agree about what "live" means,
    // or the same signup pays differently depending on which string arrived.
    expect(redemption?.campaignPromoterId).toBe(participationId);
  }, 60_000);
});

/**
 * One campaign at a time, enforced where the enrolment happens.
 *
 * The ruling above only holds if it is impossible to be on two live campaigns:
 * a promoter shares one code, so that code has to mean exactly one rate. With
 * two live participations "what does this code pay?" has no answer, because
 * nothing in the code says which campaign was intended.
 */
describe('one campaign at a time', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let promoters: CampaignPromoterService;
  const users: string[] = [];
  const promos: string[] = [];
  const ctx = { ipAddress: '127.0.0.1', userAgent: 'jest' };
  let adminId = '';

  beforeAll(async () => {
    prisma = new PrismaService({ datasources: { db: { url: databaseUrl } } } as never);
    try {
      await prisma.$connect();
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
      return;
    }
    const audit = { record: () => Promise.resolve(undefined) } as unknown as AuditService;
    const bus = { emit: () => Promise.resolve(undefined) } as unknown as DomainEventBus;
    const referrals = new ReferralsService(prisma, audit, bus, {
      advance: () => Promise.resolve(undefined),
    } as never);
    promoters = new CampaignPromoterService(prisma, referrals, audit);
    const admin = await prisma.user.create({
      data: {
        email: `admin-${randomUUID()}@example.test`,
        passwordHash: 'x',
        firstName: 'Ops',
        lastName: 'Admin',
      },
    });
    adminId = admin.id;
    users.push(admin.id);
  }, 60_000);

  afterAll(async () => {
    if (databaseAvailable) {
      if (users.length > 0) {
        await prisma.campaignPromoter.deleteMany({ where: { userId: { in: users } } });
        await prisma.referral.deleteMany({ where: { userId: { in: users } } });
        await prisma.user.deleteMany({ where: { id: { in: users } } });
      }
      if (promos.length > 0) {
        await prisma.promotion.deleteMany({ where: { id: { in: promos } } });
      }
    }
    await prisma.$disconnect();
  }, 60_000);

  const guard = (): boolean => databaseAvailable;

  async function makeUser(): Promise<string> {
    const u = await prisma.user.create({
      data: {
        email: `p-${randomUUID()}@example.test`,
        passwordHash: 'x',
        firstName: 'Promo',
        lastName: 'Ter',
      },
    });
    users.push(u.id);
    return u.id;
  }

  async function makeCampaign(
    name: string,
    status: PromotionStatus = PromotionStatus.ACTIVE,
  ): Promise<string> {
    const p = await prisma.promotion.create({
      data: { name, type: PromotionType.REFERRAL, status },
    });
    promos.push(p.id);
    return p.id;
  }

  const enrol = (promotionId: string, userId: string): Promise<unknown> =>
    promoters.addPromoter(
      {
        promotionId,
        userId,
        participantType: CampaignParticipantType.PIONEER_DRIVER,
        reward: { amountNgn: 350 },
      },
      adminId,
      ctx,
    );

  it('refuses a second live campaign, and names the one they are on', async () => {
    if (!guard()) return;
    const promoter = await makeUser();
    const first = `Pioneer Drivers ${randomUUID().slice(0, 6)}`;
    await enrol(await makeCampaign(first), promoter);

    // Named rather than a bare refusal: an operator who is told which campaign
    // can go and remove them; one who is only told "no" cannot.
    await expect(enrol(await makeCampaign('Ramadan Push'), promoter)).rejects.toThrow(first);
  }, 60_000);

  it('allows a second campaign once they are removed from the first', async () => {
    if (!guard()) return;
    const promoter = await makeUser();
    const firstId = await makeCampaign(`First ${randomUUID().slice(0, 6)}`);
    await enrol(firstId, promoter);
    await prisma.campaignPromoter.updateMany({
      where: { promotionId: firstId, userId: promoter },
      data: { status: CampaignPromoterStatus.REMOVED },
    });

    await expect(enrol(await makeCampaign('Second'), promoter)).resolves.toBeDefined();
  }, 60_000);

  it('does not count a closed campaign as blocking', async () => {
    if (!guard()) return;
    const promoter = await makeUser();
    const paused = await makeCampaign(`Paused ${randomUUID().slice(0, 6)}`);
    await enrol(paused, promoter);
    await prisma.promotion.update({
      where: { id: paused },
      data: { status: PromotionStatus.PAUSED },
    });

    // A campaign that can no longer take acquisitions must not keep somebody
    // locked out of the next one.
    await expect(enrol(await makeCampaign('Live one'), promoter)).resolves.toBeDefined();
  }, 60_000);

  it('leaves the same-campaign refusal saying what it always said', async () => {
    if (!guard()) return;
    const promoter = await makeUser();
    const id = await makeCampaign(`Same ${randomUUID().slice(0, 6)}`);
    await enrol(id, promoter);

    // Re-adding somebody already active on *this* campaign was refused long
    // before the one-campaign rule existed, and must still be refused for that
    // reason rather than the new one. An operator told "already promoting X"
    // about the campaign they are looking at would go hunting for a conflict
    // that is not there.
    await expect(enrol(id, promoter)).rejects.toThrow(
      'already an active promoter on this campaign',
    );
  }, 60_000);

  it('reinstates a removed promoter on the same campaign, at the new rate', async () => {
    if (!guard()) return;
    const promoter = await makeUser();
    const id = await makeCampaign(`Reinstate ${randomUUID().slice(0, 6)}`);
    await enrol(id, promoter);
    await prisma.campaignPromoter.updateMany({
      where: { promotionId: id, userId: promoter },
      data: { status: CampaignPromoterStatus.REMOVED },
    });

    // Their own removed participation must not block them from the campaign
    // they are being put back on.
    await expect(enrol(id, promoter)).resolves.toBeDefined();
  }, 60_000);
});
