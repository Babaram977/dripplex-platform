import { randomUUID } from 'node:crypto';

import {
  LoyaltyRewardType,
  PrismaClient,
  PromotionDomain,
  PromotionStatus,
  PromotionType,
} from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { DomainEventBus } from '../events/domain-event-bus';
import { PromotionsService } from '../promotions/promotions.service';
import { WalletService } from '../wallet/wallet.service';

import { LoyaltyRewardsService } from './loyalty-rewards.service';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * DPX-LOYALTY-008 — a redeemed coupon becomes a coupon somebody can spend.
 *
 * `promotion_id` has been on the redemption row since the catalogue shipped and
 * nothing ever wrote it, so a holder who spent 25,000 DX Points on a "₦500
 * coupon" got a record of the purchase and no way to use it. The test that
 * matters here is the one that actually spends it.
 */
describe('minting a coupon from a redeemed reward', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let rewards: LoyaltyRewardsService;
  let promotions: PromotionsService;
  const createdUserIds: string[] = [];
  const createdRewardIds: string[] = [];

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

    const auditLogRepository: jest.Mocked<AuditLogRepository> = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    const auditService = new AuditService(auditLogRepository);
    const eventBus = new DomainEventBus();
    const walletService = new WalletService(prisma, auditService, eventBus);
    rewards = new LoyaltyRewardsService(prisma, auditService);
    promotions = new PromotionsService(prisma, auditService, eventBus, walletService);
  });

  afterAll(async () => {
    if (databaseAvailable) {
      const redemptions = await prisma.loyaltyRewardRedemption.findMany({
        where: { userId: { in: createdUserIds } },
        select: { promotionId: true },
      });
      const promotionIds = redemptions
        .map((row) => row.promotionId)
        .filter((id): id is string => id !== null);
      await prisma.promotionRedemption.deleteMany({
        where: { promotionId: { in: promotionIds } },
      });
      await prisma.loyaltyRewardRedemption.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
      await prisma.promotion.deleteMany({ where: { id: { in: promotionIds } } });
      await prisma.loyaltyReward.deleteMany({ where: { id: { in: createdRewardIds } } });
      await prisma.loyaltyLedgerEntry.deleteMany({
        where: { account: { userId: { in: createdUserIds } } },
      });
      await prisma.loyaltyAccount.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  /** The coupon this redemption minted. Throws rather than asserting, so a
   *  test that stops minting fails where the mint was expected. */
  function mintedCoupon(redemption: { promotionId: string | null }): string {
    if (redemption.promotionId === null) {
      throw new Error('Expected this redemption to have minted a coupon');
    }
    return redemption.promotionId;
  }

  async function holderWith(points: number): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `reward-coupon-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Holder',
      },
    });
    createdUserIds.push(user.id);
    await prisma.loyaltyAccount.create({
      data: { userId: user.id, pointsBalance: points, lifetimePoints: points },
    });
    return user.id;
  }

  async function couponReward(overrides: Record<string, unknown> = {}): Promise<{ id: string }> {
    const reward = await prisma.loyaltyReward.create({
      data: {
        name: 'NGN 500 off',
        type: LoyaltyRewardType.DISCOUNT_COUPON,
        pointsCost: 25_000,
        monetaryValue: 500,
        entitlementDays: 30,
        domains: [PromotionDomain.MARKETPLACE],
        ...overrides,
      },
      select: { id: true },
    });
    createdRewardIds.push(reward.id);
    return reward;
  }

  it('mints a coupon the holder can actually spend', async () => {
    if (!databaseAvailable) return;
    // The whole point. Before this, the redemption row existed and the coupon
    // did not, so 25,000 points bought a record of a purchase.
    const userId = await holderWith(30_000);
    const reward = await couponReward();

    const redemption = await rewards.redeem(userId, reward.id, randomUUID(), {});
    expect(redemption.promotionId).not.toBeNull();

    const applied = await promotions.redeemForReference(
      {
        promotionId: mintedCoupon(redemption),
        userId,
        domain: PromotionDomain.MARKETPLACE,
        subtotal: 4000,
        referenceType: 'test',
        referenceId: randomUUID(),
      },
      {},
    );
    expect(applied.discountAmount).toBe(500);
  });

  it('locks the coupon to the holder who paid for it', async () => {
    if (!databaseAvailable) return;
    // Bought with somebody's own points, so it is not a campaign. Another
    // account holding the code must not be able to spend it.
    const userId = await holderWith(30_000);
    const strangerId = await holderWith(0);
    const reward = await couponReward();

    const redemption = await rewards.redeem(userId, reward.id, randomUUID(), {});

    await expect(
      promotions.redeemForReference(
        {
          promotionId: mintedCoupon(redemption),
          userId: strangerId,
          domain: PromotionDomain.MARKETPLACE,
          subtotal: 4000,
          referenceType: 'test',
          referenceId: randomUUID(),
        },
        {},
      ),
    ).rejects.toThrow(/whitelist/i);
  });

  it('spends once, and not twice', async () => {
    if (!databaseAvailable) return;
    const userId = await holderWith(30_000);
    const reward = await couponReward();
    const redemption = await rewards.redeem(userId, reward.id, randomUUID(), {});

    await promotions.redeemForReference(
      {
        promotionId: mintedCoupon(redemption),
        userId,
        domain: PromotionDomain.MARKETPLACE,
        subtotal: 4000,
        referenceType: 'test',
        referenceId: randomUUID(),
      },
      {},
    );

    await expect(
      promotions.redeemForReference(
        {
          promotionId: mintedCoupon(redemption),
          userId,
          domain: PromotionDomain.MARKETPLACE,
          subtotal: 4000,
          referenceType: 'test',
          referenceId: randomUUID(),
        },
        {},
      ),
    ).rejects.toThrow(/limit/i);
  });

  it('scopes the coupon to the domains the reward names', async () => {
    if (!databaseAvailable) return;
    // A shopping coupon does not pay for a ride unless somebody said it should.
    const userId = await holderWith(30_000);
    const reward = await couponReward();
    const redemption = await rewards.redeem(userId, reward.id, randomUUID(), {});

    await expect(
      promotions.redeemForReference(
        {
          promotionId: mintedCoupon(redemption),
          userId,
          domain: PromotionDomain.RIDE,
          subtotal: 4000,
          referenceType: 'test',
          referenceId: randomUUID(),
        },
        {},
      ),
    ).rejects.toThrow();
  });

  it('mints a percentage coupon when that is what the reward grants', async () => {
    if (!databaseAvailable) return;
    const userId = await holderWith(30_000);
    const reward = await couponReward({
      name: '10% off',
      monetaryValue: null,
      discountPercentage: 10,
      maxDiscount: 1000,
    });

    const redemption = await rewards.redeem(userId, reward.id, randomUUID(), {});
    const promotion = await prisma.promotion.findUniqueOrThrow({
      where: { id: mintedCoupon(redemption) },
    });

    expect(promotion.type).toBe(PromotionType.PERCENTAGE);
    expect(Number(promotion.percentOff)).toBe(10);
    expect(Number(promotion.maxDiscount)).toBe(1000);
    expect(promotion.status).toBe(PromotionStatus.ACTIVE);
  });

  it('expires the coupon when the entitlement does', async () => {
    if (!databaseAvailable) return;
    const userId = await holderWith(30_000);
    const reward = await couponReward({ entitlementDays: 7 });

    const redemption = await rewards.redeem(userId, reward.id, randomUUID(), {});
    const promotion = await prisma.promotion.findUniqueOrThrow({
      where: { id: mintedCoupon(redemption) },
    });

    expect(promotion.endsAt?.toISOString()).toBe(redemption.expiresAt);
  });

  it('mints nothing for a reward that names no domains', async () => {
    if (!databaseAvailable) return;
    // A correct silence: a reward whose scope nobody has stated must not be
    // given one here. FREE_DELIVERY is in exactly this position today.
    const userId = await holderWith(30_000);
    const reward = await couponReward({ domains: [] });

    const redemption = await rewards.redeem(userId, reward.id, randomUUID(), {});

    expect(redemption.promotionId).toBeNull();
  });

  it('mints nothing, and says so, for a coupon reward with no value', async () => {
    if (!databaseAvailable) return;
    // A misconfiguration, not a free coupon. Minting an empty promotion would
    // hand somebody a code that silently takes nothing off.
    const userId = await holderWith(30_000);
    const reward = await couponReward({ monetaryValue: null, discountPercentage: null });

    const redemption = await rewards.redeem(userId, reward.id, randomUUID(), {});

    expect(redemption.promotionId).toBeNull();
  });

  it('mints nothing for a reward that is not a coupon', async () => {
    if (!databaseAvailable) return;
    // A gift is posted, not spent.
    const userId = await holderWith(30_000);
    const reward = await couponReward({
      name: 'Branded helmet',
      type: LoyaltyRewardType.PHYSICAL_GIFT,
      monetaryValue: null,
    });

    const redemption = await rewards.redeem(userId, reward.id, randomUUID(), {});

    expect(redemption.promotionId).toBeNull();
  });
});
