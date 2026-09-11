import { randomUUID } from 'node:crypto';

import { PrismaClient, PromotionDomain, PromotionStatus, PromotionType } from '@prisma/client';

import { WalletService } from '../wallet/wallet.service';

import { PromotionsService } from './promotions.service';

import type { AuditService } from '../audit/audit.service';
import type { DomainEventBus } from '../events/domain-event-bus';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * DPX-CAMPAIGN-001 — what a campaign is allowed to cost.
 *
 * `usageLimit` has always bounded how many times a campaign is used, which is
 * not the same thing as what it costs: ten thousand redemptions of "20% off"
 * costs whatever ten thousand baskets happen to add up to. These tests are
 * about the control that actually bounds spend.
 */
describe('promotion budgets and the benefit band', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: PromotionsService;
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
      return;
    }

    const auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;
    const eventBus = { emit: jest.fn().mockResolvedValue(undefined) } as unknown as DomainEventBus;
    // Real, not a stub: a CREDIT-type promotion pays into a wallet. Nothing
    // here is a credit promotion, but wiring a fake would make that a fact
    // about the test rather than about the service.
    service = new PromotionsService(
      prisma,
      auditService,
      eventBus,
      new WalletService(prisma, auditService, eventBus),
    );
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.promotionRedemption.deleteMany({
        where: { promotionId: { in: createdPromotionIds } },
      });
      await prisma.promotion.deleteMany({ where: { id: { in: createdPromotionIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  async function createUser(label: string): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `promo-budget-${label}-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: label,
      },
    });
    createdUserIds.push(user.id);
    return user.id;
  }

  async function createPromotion(overrides: Record<string, unknown> = {}): Promise<{ id: string }> {
    const promotion = await prisma.promotion.create({
      data: {
        name: 'Budget campaign',
        type: PromotionType.PERCENTAGE,
        status: PromotionStatus.ACTIVE,
        domains: [PromotionDomain.MARKETPLACE],
        percentOff: 50,
        ...overrides,
      },
      select: { id: true },
    });
    createdPromotionIds.push(promotion.id);
    return promotion;
  }

  async function redeemOnce(
    promotionId: string,
    userId: string,
    subtotal: number,
  ): Promise<{ discountAmount: number }> {
    const result = await service.redeemForReference(
      {
        promotionId,
        userId,
        domain: PromotionDomain.MARKETPLACE,
        subtotal,
        referenceType: 'test',
        referenceId: randomUUID(),
      },
      {},
    );
    return { discountAmount: result.discountAmount };
  }

  it('stops a campaign once it has spent its budget', async () => {
    if (!databaseAvailable) return;
    // ₦1,000 of budget, 50% off. The first ₦1,000 basket takes ₦500 and the
    // second takes the rest; the third has nothing left to spend.
    const { id } = await createPromotion({ budgetAmount: 1000 });
    const userId = await createUser('spender');

    expect((await redeemOnce(id, userId, 1000)).discountAmount).toBe(500);
    expect((await redeemOnce(id, userId, 1000)).discountAmount).toBe(500);
    await expect(redeemOnce(id, userId, 1000)).rejects.toThrow(/budget/i);

    const after = await prisma.promotion.findUniqueOrThrow({ where: { id } });
    expect(Number(after.budgetSpent)).toBe(1000);
    expect(after.usageCount).toBe(2);
  });

  it('refuses a redemption that would exceed the budget rather than trimming it', async () => {
    if (!databaseAvailable) return;
    // Quoting somebody ₦500 off and taking ₦120 because the campaign is nearly
    // out is worse than being told the offer has ended, and it puts a number on
    // a receipt that matches nothing the campaign advertised.
    const { id } = await createPromotion({ budgetAmount: 600 });
    const userId = await createUser('partial');

    expect((await redeemOnce(id, userId, 1000)).discountAmount).toBe(500);
    // ₦100 of headroom left, and this redemption wants ₦500.
    await expect(redeemOnce(id, userId, 1000)).rejects.toThrow(/budget/i);

    const after = await prisma.promotion.findUniqueOrThrow({ where: { id } });
    expect(Number(after.budgetSpent)).toBe(500);
  });

  it('leaves an uncapped campaign uncapped, and still records what it cost', async () => {
    if (!databaseAvailable) return;
    // Every campaign that existed before budgets is this one: null budget.
    const { id } = await createPromotion();
    const userId = await createUser('uncapped');

    await redeemOnce(id, userId, 4000);
    await redeemOnce(id, userId, 4000);

    const after = await prisma.promotion.findUniqueOrThrow({ where: { id } });
    expect(after.budgetAmount).toBeNull();
    expect(Number(after.budgetSpent)).toBe(4000);
  });

  it('keeps budgetSpent equal to the sum of the redemptions it is the sum of', async () => {
    if (!databaseAvailable) return;
    const { id } = await createPromotion({ budgetAmount: 10_000 });
    const userId = await createUser('reconcile');

    await redeemOnce(id, userId, 1500);
    await redeemOnce(id, userId, 700);
    await redeemOnce(id, userId, 2200);

    const [promotion, redemptions] = await Promise.all([
      prisma.promotion.findUniqueOrThrow({ where: { id } }),
      prisma.promotionRedemption.aggregate({
        where: { promotionId: id },
        _sum: { amountSaved: true },
      }),
    ]);
    expect(Number(promotion.budgetSpent)).toBe(Number(redemptions._sum.amountSaved));
  });

  it('lifts a small percentage benefit up to the floor', async () => {
    if (!databaseAvailable) return;
    // 10% of a ₦500 basket is ₦50, which delivers a worse impression than no
    // campaign at all. "₦200 to ₦2,000 off" is the offer.
    const { id } = await createPromotion({ percentOff: 10, minDiscount: 200, maxDiscount: 2000 });
    const userId = await createUser('floor');

    expect((await redeemOnce(id, userId, 500)).discountAmount).toBe(200);
    // The ceiling still holds at the other end.
    expect((await redeemOnce(id, userId, 100_000)).discountAmount).toBe(2000);
  });

  it('never lets the floor give more off than the basket is worth', async () => {
    if (!databaseAvailable) return;
    // Nothing gives ₦200 off a ₦150 order. This is the one clamp here that
    // protects the merchant rather than the customer.
    const { id } = await createPromotion({ percentOff: 10, minDiscount: 200 });
    const userId = await createUser('tiny-basket');

    expect((await redeemOnce(id, userId, 150)).discountAmount).toBe(150);
  });

  it('scopes a campaign to named merchants, and fails closed where the merchant is unknown', async () => {
    if (!databaseAvailable) return;
    const includedMerchantId = await createUser('included-merchant');
    const excludedMerchantId = await createUser('excluded-merchant');
    const { id } = await createPromotion({
      rules: { eligibleMerchantIds: [includedMerchantId] },
    });
    const userId = await createUser('shopper');

    const allowed = await service.redeemForReference(
      {
        promotionId: id,
        userId,
        merchantId: includedMerchantId,
        domain: PromotionDomain.MARKETPLACE,
        subtotal: 1000,
        referenceType: 'test',
        referenceId: randomUUID(),
      },
      {},
    );
    expect(allowed.discountAmount).toBe(500);

    await expect(
      service.redeemForReference(
        {
          promotionId: id,
          userId,
          merchantId: excludedMerchantId,
          domain: PromotionDomain.MARKETPLACE,
          subtotal: 1000,
          referenceType: 'test',
          referenceId: randomUUID(),
        },
        {},
      ),
    ).rejects.toThrow(/not part of this promotion/i);

    // No merchant named at all: fails closed, like every other rule here.
    await expect(redeemOnce(id, userId, 1000)).rejects.toThrow(/not part of this promotion/i);
  });
});
