import { randomUUID } from 'node:crypto';

import { PrismaClient, PromotionDomain, PromotionStatus, PromotionType } from '@prisma/client';

import { DomainEventBus } from '../events/domain-event-bus';

import { PromotionsService } from './promotions.service';

import type { PromotionEvaluationDto } from './promotion.mapper';
import type { AuditService } from '../audit/audit.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { WalletService } from '../wallet/wallet.service';

/**
 * Money rules for the two founder-approved launch campaigns seeded by
 * prisma/seed-promotions.cjs. These assertions guard real spend:
 *
 *   Free First Ride      100% off ONE ride per customer, capped at ₦1,500
 *   40% Off Marketplace  40% off an order, capped at ₦2,000
 *
 * The critical guarantees are that a DRAFT campaign discounts NOTHING (so the
 * seed can ship to production inert), that the caps hold on expensive
 * fares/baskets, and that "first ride" really is once-per-customer.
 *
 * Runs against a real Postgres; skips (rather than fails) when none is
 * configured, matching the convention in rides.service.spec.ts.
 */
describe('launch campaigns (Free First Ride / 40% Off Marketplace)', () => {
  const databaseUrl = process.env['DATABASE_URL'] ?? '';
  let prisma: PrismaClient;
  let service: PromotionsService;
  let databaseAvailable = false;

  // Codeless, exactly like the seeded campaigns — a coded promotion only
  // applies when the customer types that code, which would defeat an
  // advertised automatic campaign.
  const rideName = `Free First Ride (test ${randomUUID().slice(0, 8)})`;
  const shopName = `40% Off Marketplace (test ${randomUUID().slice(0, 8)})`;
  let rideId = '';
  let shopId = '';
  let userId = '';

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    try {
      await prisma.$connect();
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
      return;
    }

    const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
    const wallet = {
      credit: jest.fn().mockResolvedValue(undefined),
      cashback: jest.fn().mockResolvedValue(undefined),
    } as unknown as WalletService;
    service = new PromotionsService(
      prisma as unknown as PrismaService,
      audit,
      new DomainEventBus(),
      wallet,
    );

    const user = await prisma.user.create({
      data: {
        email: `promo-${randomUUID()}@example.test`,
        passwordHash: 'x',
        firstName: 'Promo',
        lastName: 'Tester',
      },
    });
    userId = user.id;

    // Mirrors the seeded Free First Ride config exactly.
    const ride = await prisma.promotion.create({
      data: {
        code: null,
        name: rideName,
        type: PromotionType.PERCENTAGE,
        status: PromotionStatus.DRAFT,
        domains: [PromotionDomain.RIDE],
        percentOff: 100,
        maxDiscount: 1500,
        perUserLimit: 1,
        usageLimit: 1000,
        priority: 100,
      },
    });
    rideId = ride.id;

    // Mirrors the seeded 40% Off Marketplace config exactly.
    const shop = await prisma.promotion.create({
      data: {
        code: null,
        name: shopName,
        type: PromotionType.PERCENTAGE,
        status: PromotionStatus.DRAFT,
        domains: [PromotionDomain.MARKETPLACE],
        percentOff: 40,
        maxDiscount: 2000,
        perUserLimit: 3,
        usageLimit: 1000,
        priority: 50,
      },
    });
    shopId = shop.id;
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.promotionRedemption.deleteMany({ where: { userId } });
      await prisma.promotion.deleteMany({ where: { id: { in: [rideId, shopId] } } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await prisma.$disconnect();
  });

  const previewRide = async (fare: number): Promise<PromotionEvaluationDto> =>
    await service.previewPromotion({
      userId,
      domain: PromotionDomain.RIDE,
      subtotal: fare,
    });

  it('DRAFT campaigns discount nothing — the seed ships inert', async () => {
    if (!databaseAvailable) return;
    const ride = await previewRide(1200);
    expect(ride.discountTotal).toBe(0);
    expect(ride.discounts).toHaveLength(0);

    const shop = await service.previewPromotion({
      userId,
      domain: PromotionDomain.MARKETPLACE,
      subtotal: 10000,
    });
    expect(shop.discountTotal).toBe(0);
  });

  it('once ACTIVE, a cheap first ride is fully free (no coupon code needed)', async () => {
    if (!databaseAvailable) return;
    await prisma.promotion.update({
      where: { id: rideId },
      data: { status: PromotionStatus.ACTIVE },
    });

    const result = await previewRide(1200);
    expect(result.discountTotal).toBe(1200);
    expect(result.discounts[0]?.promotionId).toBe(rideId);
  });

  it('caps DrippleX’s cost at ₦1,500 on an expensive ride — the rider pays the excess', async () => {
    if (!databaseAvailable) return;
    const result = await previewRide(9000);
    expect(result.discountTotal).toBe(1500);
    // The rider still owes the balance; the fare is not zeroed out.
    expect(9000 - result.discountTotal).toBe(7500);
  });

  it('is a FIRST-ride offer: no discount once the customer has redeemed it', async () => {
    if (!databaseAvailable) return;
    await prisma.promotionRedemption.create({
      data: { promotionId: rideId, userId, amountSaved: 1500 },
    });

    const result = await previewRide(1200);
    expect(result.discountTotal).toBe(0);
    expect(result.discounts).toHaveLength(0);
  });

  it('takes 40% off a marketplace order but never more than ₦2,000', async () => {
    if (!databaseAvailable) return;
    await prisma.promotion.update({
      where: { id: shopId },
      data: { status: PromotionStatus.ACTIVE },
    });

    // 40% of ₦3,000 = ₦1,200 — under the cap, so the full 40% applies.
    const small = await service.previewPromotion({
      userId,
      domain: PromotionDomain.MARKETPLACE,
      subtotal: 3000,
    });
    expect(small.discountTotal).toBe(1200);

    // 40% of ₦20,000 = ₦8,000 — clamped to the ₦2,000 cap.
    const large = await service.previewPromotion({
      userId,
      domain: PromotionDomain.MARKETPLACE,
      subtotal: 20000,
    });
    expect(large.discountTotal).toBe(2000);
  });

  it('keeps the ride and marketplace campaigns in their own domains', async () => {
    if (!databaseAvailable) return;
    // The marketplace campaign must never discount a ride (and vice versa).
    const ride = await previewRide(5000);
    expect(ride.discounts.some((d) => d.promotionId === shopId)).toBe(false);

    const shop = await service.previewPromotion({
      userId,
      domain: PromotionDomain.MARKETPLACE,
      subtotal: 5000,
    });
    expect(shop.discounts.some((d) => d.promotionId === rideId)).toBe(false);
  });
});
