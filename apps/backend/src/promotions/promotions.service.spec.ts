import { PromotionDomain, PromotionStatus, PromotionType } from '@prisma/client';

import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';

import { PromotionsService } from './promotions.service';

import type { AuditService } from '../audit/audit.service';
import type { DomainEventBus } from '../events/domain-event-bus';
import type { PrismaService } from '../prisma/prisma.service';
import type { WalletService } from '../wallet/wallet.service';
import type { Promotion, PromotionRedemption } from '@prisma/client';

const adminId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const promotionId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const merchantId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const orderId = '99999999-9999-4999-8999-999999999999';
const now = new Date('2026-01-01T00:00:00.000Z');

const decimal = (value: number): NonNullable<Promotion['percentOff']> =>
  value as unknown as NonNullable<Promotion['percentOff']>;

const promotion = (overrides: Partial<Promotion> = {}): Promotion => ({
  id: promotionId,
  code: null,
  name: 'Promo',
  type: PromotionType.PERCENTAGE,
  status: PromotionStatus.ACTIVE,
  domains: [],
  percentOff: decimal(10),
  amountOff: null,
  creditAmount: null,
  maxDiscount: null,
  buyQty: null,
  getQty: null,
  priority: 0,
  stackable: false,
  usageLimit: null,
  usageCount: 0,
  perUserLimit: null,
  perDeviceLimit: null,
  minOrderAmount: null,
  rules: null,
  startsAt: null,
  endsAt: null,
  pausedAt: null,
  archivedAt: null,
  merchantId: null,
  clonedFromId: null,
  createdBy: null,
  metadata: null,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  ...overrides,
});

const redemption = (overrides: Partial<PromotionRedemption> = {}): PromotionRedemption => ({
  id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  promotionId,
  userId,
  orderId,
  referenceType: null,
  referenceId: null,
  deviceId: null,
  walletTransactionId: null,
  amountSaved: decimal(10),
  createdAt: now,
  ...overrides,
});

const order = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: orderId,
  customerId: userId,
  merchantId,
  subtotal: decimal(1000),
  ...overrides,
});

describe('PromotionsService', () => {
  const prisma = {
    promotion: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
    },
    promotionRedemption: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      groupBy: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };

  const auditService = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AuditService>;

  const eventBus = {
    on: jest.fn(),
    emit: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<DomainEventBus>;

  const walletService = {
    credit: jest.fn().mockResolvedValue(undefined),
    cashback: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<WalletService>;

  const service = new PromotionsService(
    prisma as unknown as PrismaService,
    auditService,
    eventBus,
    walletService,
  );
  const context = { userId: adminId };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.order.findUnique.mockResolvedValue(order());
    prisma.promotionRedemption.findFirst.mockResolvedValue(null);
    prisma.$queryRaw.mockResolvedValue([{ id: promotionId }]);
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof prisma) => Promise<unknown>) => await callback(prisma),
    );
  });

  it('subscribes to coupon redeemed events on module init', () => {
    service.onModuleInit();
    expect(eventBus.on).toHaveBeenCalledWith('CouponRedeemed', expect.any(Function));
  });

  it('creates promotions, audits, and emits events', async () => {
    prisma.promotion.create.mockResolvedValue(promotion({ code: 'SAVE10' }));
    const result = await service.create(
      adminId,
      {
        code: 'save10',
        name: 'Save 10',
        type: PromotionType.PERCENTAGE,
        percentOff: 10,
      },
      context,
    );
    expect(result.code).toBe('SAVE10');
    expect(eventBus.emit).toHaveBeenCalledWith(
      'PromotionCreated',
      expect.objectContaining({ promotionId, code: 'SAVE10' }),
      { actorUserId: adminId },
    );
  });

  it('rejects BOGO promotions without quantities', async () => {
    await expect(
      service.create(adminId, { name: 'BOGO', type: PromotionType.BOGO }, context),
    ).rejects.toBeInstanceOf(ValidationDomainException);
  });

  it('rejects invalid schedules', async () => {
    await expect(
      service.create(
        adminId,
        {
          name: 'Bad',
          type: PromotionType.FIXED,
          amountOff: 100,
          startsAt: '2026-01-02T00:00:00.000Z',
          endsAt: '2026-01-01T00:00:00.000Z',
        },
        context,
      ),
    ).rejects.toBeInstanceOf(ValidationDomainException);
  });

  it('lists active scheduled promotions', async () => {
    prisma.promotion.findMany.mockResolvedValue([promotion({ merchantId })]);
    const result = await service.listActive(merchantId);
    expect(result).toHaveLength(1);
    expect(prisma.promotion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: [PromotionStatus.ACTIVE, PromotionStatus.SCHEDULED] },
        }),
      }),
    );
  });

  it('calculates percentage discounts', () => {
    expect(service.calculateDiscount(promotion({ percentOff: decimal(15) }), 2000)).toBe(300);
  });

  it('calculates fixed discounts capped at subtotal', () => {
    expect(
      service.calculateDiscount(
        promotion({ type: PromotionType.FIXED, percentOff: null, amountOff: decimal(2500) }),
        1000,
      ),
    ).toBe(1000);
  });

  it('calculates BOGO discounts from buy/get ratio', () => {
    expect(
      service.calculateDiscount(
        promotion({
          type: PromotionType.BOGO,
          percentOff: null,
          buyQty: 1,
          getQty: 1,
        }),
        1000,
      ),
    ).toBe(500);
  });

  it('selects best single discount when stackable total is lower', () => {
    const result = service.selectDiscounts(
      [
        {
          promotionId: '1',
          code: null,
          name: 'Stack',
          type: PromotionType.FIXED,
          priority: 5,
          stackable: true,
          discountAmount: 100,
          creditAmount: 0,
        },
        {
          promotionId: '2',
          code: null,
          name: 'Single',
          type: PromotionType.FIXED,
          priority: 1,
          stackable: false,
          discountAmount: 500,
          creditAmount: 0,
        },
      ],
      1000,
    );
    expect(result.map((discount) => discount.promotionId)).toEqual(['2']);
  });

  it('selects stackable discounts when stack beats best single', () => {
    const result = service.selectDiscounts(
      [
        {
          promotionId: '1',
          code: null,
          name: 'Stack 1',
          type: PromotionType.FIXED,
          priority: 5,
          stackable: true,
          discountAmount: 300,
          creditAmount: 0,
        },
        {
          promotionId: '2',
          code: null,
          name: 'Stack 2',
          type: PromotionType.FIXED,
          priority: 4,
          stackable: true,
          discountAmount: 250,
          creditAmount: 0,
        },
        {
          promotionId: '3',
          code: null,
          name: 'Single',
          type: PromotionType.FIXED,
          priority: 9,
          stackable: false,
          discountAmount: 400,
          creditAmount: 0,
        },
      ],
      1000,
    );
    expect(result.map((discount) => discount.promotionId)).toEqual(['1', '2']);
  });

  it('evaluates cart discounts with per-user limits', async () => {
    prisma.promotion.findMany.mockResolvedValue([
      promotion({ perUserLimit: 1, amountOff: decimal(200), percentOff: null }),
      promotion({
        id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        amountOff: decimal(100),
        percentOff: null,
      }),
    ]);
    prisma.promotionRedemption.count.mockResolvedValueOnce(1);

    const result = await service.evaluateForCart({ subtotal: 1000, userId });

    expect(result.discountTotal).toBe(100);
    expect(result.discounts[0]?.promotionId).toBe('ffffffff-ffff-4fff-8fff-ffffffffffff');
  });

  it('validates coupon codes using evaluation', async () => {
    prisma.promotion.findMany.mockResolvedValue([
      promotion({ code: 'SAVE10', amountOff: decimal(100), percentOff: null }),
    ]);
    const result = await service.validateCoupon({ subtotal: 1000, userId, couponCode: 'save10' });
    expect(result.valid).toBe(true);
    expect(result.couponCode).toBe('SAVE10');
  });

  it('rejects coupon validation without a coupon code', async () => {
    await expect(service.validateCoupon({ subtotal: 1000, userId })).rejects.toBeInstanceOf(
      ValidationDomainException,
    );
  });

  it('redeems promotions and emits coupon redeemed', async () => {
    prisma.promotion.findFirst.mockResolvedValue(promotion({ code: 'SAVE10' }));
    prisma.promotionRedemption.count.mockResolvedValue(0);
    prisma.$transaction.mockImplementation(
      async (
        callback: (tx: typeof prisma) => Promise<{
          redemption: PromotionRedemption;
          amountSaved: number;
          redeemedPromotion: Promotion;
        }>,
      ) =>
        await callback({
          ...prisma,
          promotionRedemption: {
            ...prisma.promotionRedemption,
            create: jest.fn().mockResolvedValue(redemption({ amountSaved: decimal(100) })),
          },
          promotion: {
            ...prisma.promotion,
            update: jest.fn().mockResolvedValue(promotion()),
          },
        }),
    );

    const result = await service.redeem(userId, { couponCode: 'save10', orderId }, { userId });

    expect(result.amountSaved).toBe(100);
    expect(eventBus.emit).toHaveBeenCalledWith(
      'CouponRedeemed',
      expect.objectContaining({ code: 'SAVE10', amountSaved: 100 }),
      { actorUserId: userId },
    );
  });

  it('rejects redemption after usage limit', async () => {
    prisma.promotion.findFirst.mockResolvedValue(promotion({ usageLimit: 1, usageCount: 1 }));
    await expect(
      service.redeem(userId, { promotionId, orderId }, { userId }),
    ).rejects.toBeInstanceOf(ValidationDomainException);
  });

  it('throws when promotion is missing', async () => {
    prisma.promotion.findFirst.mockResolvedValue(null);
    await expect(service.get(promotionId)).rejects.toBeInstanceOf(NotFoundDomainException);
  });

  describe('calculateEffect', () => {
    it('returns a discountAmount for percentage/fixed/BOGO types', () => {
      expect(service.calculateEffect(promotion({ percentOff: decimal(10) }), 1000)).toEqual({
        discountAmount: 100,
        creditAmount: 0,
      });
    });

    it('returns a creditAmount for WALLET_CREDIT/CASHBACK/BONUS_REWARD types', () => {
      const result = service.calculateEffect(
        promotion({
          type: PromotionType.CASHBACK,
          percentOff: null,
          creditAmount: decimal(50),
        }),
        1000,
      );
      expect(result).toEqual({ discountAmount: 0, creditAmount: 50 });
    });

    it('caps creditAmount at maxDiscount', () => {
      const result = service.calculateEffect(
        promotion({
          type: PromotionType.WALLET_CREDIT,
          percentOff: null,
          creditAmount: decimal(500),
          maxDiscount: decimal(200),
        }),
        1000,
      );
      expect(result.creditAmount).toBe(200);
    });

    it('caps a percentage discount at maxDiscount', () => {
      const result = service.calculateEffect(
        promotion({ percentOff: decimal(50), maxDiscount: decimal(100) }),
        1000,
      );
      expect(result.discountAmount).toBe(100);
    });
  });

  describe('lifecycle: pause/resume/archive/forceExpire/clone', () => {
    it('pauses an active promotion', async () => {
      prisma.promotion.findFirst.mockResolvedValue(promotion({ status: PromotionStatus.ACTIVE }));
      prisma.promotion.update.mockResolvedValue(
        promotion({ status: PromotionStatus.PAUSED, pausedAt: now }),
      );

      const result = await service.pause(adminId, promotionId, { userId: adminId });

      expect(result.status).toBe(PromotionStatus.PAUSED);
      expect(eventBus.emit).toHaveBeenCalledWith(
        'CampaignPaused',
        expect.objectContaining({ promotionId }),
        { actorUserId: adminId },
      );
    });

    it('rejects pausing an already-paused promotion', async () => {
      prisma.promotion.findFirst.mockResolvedValue(promotion({ status: PromotionStatus.PAUSED }));
      await expect(service.pause(adminId, promotionId, { userId: adminId })).rejects.toBeInstanceOf(
        ValidationDomainException,
      );
    });

    it('resumes a paused promotion to ACTIVE when startsAt has passed', async () => {
      prisma.promotion.findFirst.mockResolvedValue(promotion({ status: PromotionStatus.PAUSED }));
      prisma.promotion.update.mockResolvedValue(promotion({ status: PromotionStatus.ACTIVE }));

      const result = await service.resume(adminId, promotionId, { userId: adminId });

      expect(result.status).toBe(PromotionStatus.ACTIVE);
      expect(eventBus.emit).toHaveBeenCalledWith(
        'CampaignActivated',
        expect.objectContaining({ promotionId }),
        { actorUserId: adminId },
      );
    });

    it('resumes a paused promotion to SCHEDULED when startsAt is in the future', async () => {
      const future = new Date(now.getTime() + 86_400_000);
      prisma.promotion.findFirst.mockResolvedValue(
        promotion({ status: PromotionStatus.PAUSED, startsAt: future }),
      );
      prisma.promotion.update.mockResolvedValue(
        promotion({ status: PromotionStatus.SCHEDULED, startsAt: future }),
      );

      const result = await service.resume(adminId, promotionId, { userId: adminId });
      expect(result.status).toBe(PromotionStatus.SCHEDULED);
    });

    it('rejects resuming a promotion that is not paused', async () => {
      prisma.promotion.findFirst.mockResolvedValue(promotion({ status: PromotionStatus.ACTIVE }));
      await expect(
        service.resume(adminId, promotionId, { userId: adminId }),
      ).rejects.toBeInstanceOf(ValidationDomainException);
    });

    it('archives a promotion', async () => {
      prisma.promotion.findFirst.mockResolvedValue(promotion({ status: PromotionStatus.ACTIVE }));
      prisma.promotion.update.mockResolvedValue(
        promotion({ status: PromotionStatus.ARCHIVED, archivedAt: now }),
      );

      const result = await service.archive(adminId, promotionId, { userId: adminId });

      expect(result.status).toBe(PromotionStatus.ARCHIVED);
      expect(eventBus.emit).toHaveBeenCalledWith(
        'CampaignArchived',
        expect.objectContaining({ promotionId }),
        { actorUserId: adminId },
      );
    });

    it('rejects archiving an already-archived promotion', async () => {
      prisma.promotion.findFirst.mockResolvedValue(promotion({ status: PromotionStatus.ARCHIVED }));
      await expect(
        service.archive(adminId, promotionId, { userId: adminId }),
      ).rejects.toBeInstanceOf(ConflictDomainException);
    });

    it('force-expires an active promotion', async () => {
      prisma.promotion.findFirst.mockResolvedValue(promotion({ status: PromotionStatus.ACTIVE }));
      prisma.promotion.update.mockResolvedValue(
        promotion({ status: PromotionStatus.EXPIRED, endsAt: now }),
      );

      const result = await service.forceExpire(adminId, promotionId, { userId: adminId });

      expect(result.status).toBe(PromotionStatus.EXPIRED);
      expect(eventBus.emit).toHaveBeenCalledWith(
        'CampaignExpired',
        expect.objectContaining({ promotionId }),
        { actorUserId: adminId },
      );
    });

    it('rejects force-expiring an already-inactive promotion', async () => {
      prisma.promotion.findFirst.mockResolvedValue(
        promotion({ status: PromotionStatus.CANCELLED }),
      );
      await expect(
        service.forceExpire(adminId, promotionId, { userId: adminId }),
      ).rejects.toBeInstanceOf(ConflictDomainException);
    });

    it('clones a promotion as a new DRAFT with clonedFromId set', async () => {
      prisma.promotion.findFirst.mockResolvedValue(
        promotion({ code: 'SAVE10', status: PromotionStatus.ACTIVE }),
      );
      prisma.promotion.create.mockResolvedValue(
        promotion({
          id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
          code: 'CLONE10',
          status: PromotionStatus.DRAFT,
          clonedFromId: promotionId,
        }),
      );

      const result = await service.clone(
        adminId,
        promotionId,
        { code: 'clone10' },
        { userId: adminId },
      );

      expect(result.status).toBe(PromotionStatus.DRAFT);
      expect(result.clonedFromId).toBe(promotionId);
      expect(prisma.promotion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ clonedFromId: promotionId, createdBy: adminId }),
        }),
      );
    });
  });

  describe('sweep: activateDueCampaigns / expireDueCampaigns', () => {
    it('activates scheduled campaigns whose startsAt has arrived', async () => {
      prisma.promotion.findMany.mockResolvedValueOnce([{ id: promotionId, code: 'SAVE10' }]);
      prisma.promotion.update.mockResolvedValue(promotion());

      const activated = await service.activateDueCampaigns();

      expect(activated).toBe(1);
      expect(prisma.promotion.update).toHaveBeenCalledWith({
        where: { id: promotionId },
        data: { status: PromotionStatus.ACTIVE },
      });
      expect(eventBus.emit).toHaveBeenCalledWith('CampaignActivated', {
        promotionId,
        code: 'SAVE10',
      });
    });

    it('expires campaigns whose endsAt has passed', async () => {
      prisma.promotion.findMany.mockResolvedValueOnce([{ id: promotionId, code: 'SAVE10' }]);
      prisma.promotion.update.mockResolvedValue(promotion());

      const expired = await service.expireDueCampaigns();

      expect(expired).toBe(1);
      expect(eventBus.emit).toHaveBeenCalledWith('CampaignExpired', {
        promotionId,
        code: 'SAVE10',
      });
    });

    it('returns 0 when nothing is due', async () => {
      prisma.promotion.findMany.mockResolvedValueOnce([]);
      expect(await service.activateDueCampaigns()).toBe(0);
    });
  });

  describe('analytics / CSV export', () => {
    it('summarizes redemption analytics for a campaign', async () => {
      prisma.promotion.findFirst.mockResolvedValue(promotion({ usageLimit: 10, usageCount: 3 }));
      prisma.promotionRedemption.findMany.mockResolvedValue([
        { userId: 'u1', amountSaved: decimal(100) },
        { userId: 'u1', amountSaved: decimal(50) },
        { userId: 'u2', amountSaved: decimal(25) },
      ]);

      const result = await service.getCampaignAnalytics(promotionId, {});

      expect(result).toEqual({
        promotionId,
        totalRedemptions: 3,
        uniqueUsers: 2,
        totalDiscountCost: 175,
        usageLimit: 10,
        usageCount: 3,
        redemptionRate: 0.3,
      });
    });

    it('lists top campaigns by redemption count', async () => {
      prisma.promotionRedemption.groupBy.mockResolvedValue([
        { promotionId, _count: { _all: 5 }, _sum: { amountSaved: decimal(500) } },
      ]);
      prisma.promotion.findMany.mockResolvedValueOnce([promotion({ code: 'SAVE10' })]);

      const result = await service.getTopCampaigns({});

      expect(result).toEqual([
        {
          promotionId,
          code: 'SAVE10',
          name: 'Promo',
          type: PromotionType.PERCENTAGE,
          redemptions: 5,
          discountCost: 500,
        },
      ]);
    });

    it('returns an empty leaderboard when there are no redemptions', async () => {
      prisma.promotionRedemption.groupBy.mockResolvedValue([]);
      expect(await service.getTopCampaigns({})).toEqual([]);
    });

    it('exports redemptions as CSV', async () => {
      prisma.promotion.findFirst.mockResolvedValue(promotion());
      prisma.promotionRedemption.findMany.mockResolvedValue([
        redemption({ amountSaved: decimal(42) }),
      ]);

      const csv = await service.exportRedemptionsCsv(promotionId);

      expect(csv).toContain(
        'id,userId,orderId,referenceType,referenceId,deviceId,amountSaved,createdAt',
      );
      expect(csv).toContain('42.00');
    });
  });

  describe('previewSinglePromotion', () => {
    it('returns null when neither promotionId nor couponCode is given', async () => {
      const result = await service.previewSinglePromotion({
        userId,
        domain: PromotionDomain.RIDE,
        subtotal: 1000,
      });
      expect(result).toBeNull();
    });

    it('returns null when the promotion is not found', async () => {
      prisma.promotion.findFirst.mockResolvedValue(null);
      const result = await service.previewSinglePromotion({
        userId,
        domain: PromotionDomain.RIDE,
        subtotal: 1000,
        promotionId,
      });
      expect(result).toBeNull();
    });

    it('returns null when the promotion is restricted to a different domain', async () => {
      prisma.promotion.findFirst.mockResolvedValue(
        promotion({ domains: [PromotionDomain.MARKETPLACE] }),
      );
      const result = await service.previewSinglePromotion({
        userId,
        domain: PromotionDomain.RIDE,
        subtotal: 1000,
        promotionId,
      });
      expect(result).toBeNull();
    });

    it('returns the discount when the promotion applies to the domain', async () => {
      prisma.promotion.findFirst.mockResolvedValue(
        promotion({ domains: [PromotionDomain.RIDE], percentOff: decimal(10) }),
      );
      prisma.promotionRedemption.count.mockResolvedValue(0);

      const result = await service.previewSinglePromotion({
        userId,
        domain: PromotionDomain.RIDE,
        subtotal: 1000,
        promotionId,
      });

      expect(result).toEqual(expect.objectContaining({ discountAmount: 100, creditAmount: 0 }));
    });

    it('returns null when the caller already exhausted their perUserLimit', async () => {
      prisma.promotion.findFirst.mockResolvedValue(promotion({ perUserLimit: 1 }));
      prisma.promotionRedemption.count.mockResolvedValue(1);

      const result = await service.previewSinglePromotion({
        userId,
        domain: PromotionDomain.RIDE,
        subtotal: 1000,
        promotionId,
      });
      expect(result).toBeNull();
    });

    it('returns null when the usage limit is already reached', async () => {
      prisma.promotion.findFirst.mockResolvedValue(promotion({ usageLimit: 5, usageCount: 5 }));
      const result = await service.previewSinglePromotion({
        userId,
        domain: PromotionDomain.RIDE,
        subtotal: 1000,
        promotionId,
      });
      expect(result).toBeNull();
    });
  });

  describe('redeemForReference (domain-generic redemption)', () => {
    beforeEach(() => {
      prisma.promotionRedemption.findFirst.mockResolvedValue(null);
      prisma.promotionRedemption.count.mockResolvedValue(0);
    });

    it('redeems a promotion against an arbitrary reference and emits PromotionRedeemed', async () => {
      prisma.promotion.findFirst.mockResolvedValue(
        promotion({ domains: [PromotionDomain.RIDE], code: 'RIDE10', percentOff: decimal(10) }),
      );
      prisma.$transaction.mockImplementation(
        async (callback: (tx: typeof prisma) => Promise<unknown>) =>
          await callback({
            ...prisma,
            promotionRedemption: {
              ...prisma.promotionRedemption,
              create: jest
                .fn()
                .mockResolvedValue(redemption({ referenceType: 'ride', referenceId: 'ride-1' })),
            },
            promotion: { ...prisma.promotion, update: jest.fn().mockResolvedValue(promotion()) },
          }),
      );

      const result = await service.redeemForReference(
        {
          userId,
          domain: PromotionDomain.RIDE,
          subtotal: 1000,
          promotionId,
          referenceType: 'ride',
          referenceId: 'ride-1',
        },
        { userId },
      );

      expect(result.discountAmount).toBe(100);
      expect(result.creditAmount).toBe(0);
      expect(eventBus.emit).toHaveBeenCalledWith(
        'PromotionRedeemed',
        expect.objectContaining({ referenceType: 'ride', referenceId: 'ride-1' }),
        { actorUserId: userId },
      );
    });

    it('credits the wallet post-commit for a CASHBACK promotion and emits CashbackAwarded', async () => {
      prisma.promotion.findFirst.mockResolvedValue(
        promotion({
          domains: [PromotionDomain.RIDE],
          type: PromotionType.CASHBACK,
          percentOff: null,
          creditAmount: decimal(75),
        }),
      );
      prisma.$transaction.mockImplementation(
        async (callback: (tx: typeof prisma) => Promise<unknown>) =>
          await callback({
            ...prisma,
            promotionRedemption: {
              ...prisma.promotionRedemption,
              create: jest.fn().mockResolvedValue(redemption({ amountSaved: decimal(75) })),
            },
            promotion: { ...prisma.promotion, update: jest.fn().mockResolvedValue(promotion()) },
          }),
      );

      const result = await service.redeemForReference(
        {
          userId,
          domain: PromotionDomain.RIDE,
          subtotal: 1000,
          promotionId,
          referenceType: 'ride',
          referenceId: 'ride-1',
        },
        { userId },
      );

      expect(result.creditAmount).toBe(75);
      expect(walletService.cashback).toHaveBeenCalledWith(
        expect.objectContaining({ ownerId: userId, amount: 75 }),
      );
      expect(eventBus.emit).toHaveBeenCalledWith(
        'CashbackAwarded',
        expect.objectContaining({ promotionId, userId, amount: '75' }),
        { actorUserId: userId },
      );
    });

    it('rejects redemption when the promotion is restricted to a different domain', async () => {
      prisma.promotion.findFirst.mockResolvedValue(
        promotion({ domains: [PromotionDomain.MARKETPLACE] }),
      );
      await expect(
        service.redeemForReference(
          {
            userId,
            domain: PromotionDomain.RIDE,
            subtotal: 1000,
            promotionId,
            referenceType: 'ride',
            referenceId: 'ride-1',
          },
          { userId },
        ),
      ).rejects.toBeInstanceOf(ValidationDomainException);
    });

    it('rejects a duplicate redemption for the same reference', async () => {
      prisma.promotion.findFirst.mockResolvedValue(
        promotion({ domains: [PromotionDomain.RIDE], percentOff: decimal(10) }),
      );
      prisma.promotionRedemption.findFirst.mockResolvedValue({ id: 'existing-redemption' });
      prisma.$transaction.mockImplementation(
        async (callback: (tx: typeof prisma) => Promise<unknown>) => await callback(prisma),
      );

      await expect(
        service.redeemForReference(
          {
            userId,
            domain: PromotionDomain.RIDE,
            subtotal: 1000,
            promotionId,
            referenceType: 'ride',
            referenceId: 'ride-1',
          },
          { userId },
        ),
      ).rejects.toBeInstanceOf(ConflictDomainException);
    });

    it('enforces perDeviceLimit when a deviceId is supplied', async () => {
      prisma.promotion.findFirst.mockResolvedValue(
        promotion({
          domains: [PromotionDomain.RIDE],
          percentOff: decimal(10),
          perDeviceLimit: 1,
        }),
      );
      prisma.promotionRedemption.count.mockResolvedValue(1);
      prisma.$transaction.mockImplementation(
        async (callback: (tx: typeof prisma) => Promise<unknown>) => await callback(prisma),
      );

      await expect(
        service.redeemForReference(
          {
            userId,
            domain: PromotionDomain.RIDE,
            subtotal: 1000,
            promotionId,
            referenceType: 'ride',
            referenceId: 'ride-1',
            deviceId: 'device-1',
          },
          { userId },
        ),
      ).rejects.toBeInstanceOf(ValidationDomainException);
    });
  });
});
