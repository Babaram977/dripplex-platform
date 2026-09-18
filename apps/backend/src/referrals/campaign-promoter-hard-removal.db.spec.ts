import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  CampaignParticipantType,
  CampaignPromoterStatus,
  PrismaClient,
  PromotionType,
  ReferralRedemptionStatus,
  ReferralRefereeType,
} from '@prisma/client';

import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

const MIGRATION = join(
  __dirname,
  '../../prisma/migrations/20260918120000_campaign_promoter_hard_removal/migration.sql',
);

/**
 * Removal is complete — founder ruling, 2026-09-18, reversing soft removal.
 *
 *   "No soft removal in any campaign, removal should be completely, ops have
 *    total control. If it has been trigger by ops there is a reason for that."
 *
 * The ruling came from the desk: promoters left sitting in campaign lists as
 * REMOVED showing `0/0` and `₦0`, under copy saying they were kept because
 * their attributions and earnings stand — rows kept for a reason that did not
 * apply to them.
 *
 * The migration that clears them is the risky half of this change, because it
 * deletes from a table next to paid money. So it is exercised here on real
 * rows rather than reasoned about: seed the exact pre-state, replay the
 * migration's own SQL, and assert what went and what stayed.
 */
describe('campaign promoter removal is complete', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  const createdUserIds: string[] = [];
  const createdPromotionIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    }) as unknown as PrismaService;
    try {
      await prisma.$connect();
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
    }
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.campaignPromoter
        .deleteMany({ where: { promotionId: { in: createdPromotionIds } } })
        .catch(() => undefined);
      await prisma.user
        .deleteMany({ where: { id: { in: createdUserIds } } })
        .catch(() => undefined);
      await prisma.promotion
        .deleteMany({ where: { id: { in: createdPromotionIds } } })
        .catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  async function aUser(): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `hardremove-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Promoter',
      },
    });
    createdUserIds.push(user.id);
    return user.id;
  }

  async function aCampaign(): Promise<string> {
    const promo = await prisma.promotion.create({
      data: { name: `Campaign ${randomUUID()}`, type: PromotionType.REFERRAL },
    });
    createdPromotionIds.push(promo.id);
    return promo.id;
  }

  /** The state this migration exists to clear: a promoter an operator already
   *  removed under the old rule, carrying one PAID acquisition. */
  async function aRemovedPromoterWithAPaidAcquisition(): Promise<{
    promoterId: string;
    refereeId: string;
    referralId: string;
  }> {
    const [promotionId, userId, refereeId] = [await aCampaign(), await aUser(), await aUser()];
    const promoter = await prisma.campaignPromoter.create({
      data: {
        promotionId,
        userId,
        participantType: CampaignParticipantType.PIONEER_DRIVER,
        token: randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase(),
        rewardAmount: 350,
        status: CampaignPromoterStatus.REMOVED,
        removedAt: new Date(),
      },
    });
    const referral = await prisma.referral.create({
      data: { userId, code: randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase() },
    });
    await prisma.referralRedemption.create({
      data: {
        referralId: referral.id,
        refereeUserId: refereeId,
        status: ReferralRedemptionStatus.PAID,
        refereeType: ReferralRefereeType.CUSTOMER,
        campaignPromoterId: promoter.id,
        referrerRewardAmount: 350,
        refereeRewardAmount: 150,
        paidAt: new Date(),
      },
    });
    return { promoterId: promoter.id, refereeId, referralId: referral.id };
  }

  /** The migration's own statements, run verbatim rather than reimplemented —
   *  a reimplementation would test this spec's idea of the migration.
   *
   *  Comments are stripped BEFORE splitting on `;`, not after. The first
   *  version did it the other way and a prose semicolon inside a `--` comment
   *  split mid-sentence, handing Postgres half an English sentence as a
   *  statement. */
  async function replayTheMigration(): Promise<void> {
    const withoutComments = readFileSync(MIGRATION, 'utf8')
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n');
    for (const statement of withoutComments
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part.length > 0)) {
      await prisma.$executeRawUnsafe(statement);
    }
  }

  it('deletes a promoter an operator had removed, and detaches the money record', async () => {
    if (!databaseAvailable) return;
    const { promoterId, refereeId, referralId } = await aRemovedPromoterWithAPaidAcquisition();

    await replayTheMigration();

    // GONE. This is the ruling.
    expect(await prisma.campaignPromoter.findUnique({ where: { id: promoterId } })).toBeNull();

    // NOT GONE. This redemption is PAID — the wallet ledger holds the matching
    // credit — so deleting it would leave money that moved with nothing saying
    // why. Detached, and everything that says who earned what survives.
    const survivor = await prisma.referralRedemption.findFirstOrThrow({
      where: { refereeUserId: refereeId },
    });
    expect(survivor.campaignPromoterId).toBeNull();
    expect(survivor.status).toBe(ReferralRedemptionStatus.PAID);
    expect(Number(survivor.referrerRewardAmount)).toBe(350);
    // The referral still names the referrer, independently of the deleted
    // participation. This is why detaching does not lose who earned it.
    expect(survivor.referralId).toBe(referralId);
  });

  it('leaves ACTIVE promoters alone', async () => {
    if (!databaseAvailable) return;
    const [promotionId, userId] = [await aCampaign(), await aUser()];
    const active = await prisma.campaignPromoter.create({
      data: {
        promotionId,
        userId,
        participantType: CampaignParticipantType.INFLUENCER,
        token: randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase(),
        rewardAmount: 150,
        status: CampaignPromoterStatus.ACTIVE,
      },
    });

    await replayTheMigration();

    // The migration completes removals that already happened. It does not
    // decide that anybody comes off a campaign.
    expect(await prisma.campaignPromoter.findUnique({ where: { id: active.id } })).not.toBeNull();
  });

  it('leaves no REMOVED promoter behind', async () => {
    if (!databaseAvailable) return;
    await aRemovedPromoterWithAPaidAcquisition();

    await replayTheMigration();

    expect(
      await prisma.campaignPromoter.count({ where: { status: CampaignPromoterStatus.REMOVED } }),
    ).toBe(0);
  });

  it('no production code writes REMOVED any more', () => {
    // PostgreSQL cannot drop a value from an enum type, so REMOVED survives in
    // the schema with nothing carrying it. That makes this guard the only thing
    // stopping soft removal creeping back in one service at a time — the type
    // system will not object, because the value is still legal.
    const sources = [
      'src/referrals/campaign-promoter.service.ts',
      'src/operations/operations-promotions.service.ts',
      'src/referrals/campaign-attribution.service.ts',
      'src/referrals/referrals.service.ts',
    ].map((rel) => readFileSync(join(__dirname, '../..', rel), 'utf8'));

    for (const source of sources) {
      expect(source).not.toMatch(/CampaignPromoterStatus\.REMOVED/);
    }
  });
});
