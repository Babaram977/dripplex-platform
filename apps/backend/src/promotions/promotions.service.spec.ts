import { PromotionStatus, PromotionType } from '@prisma/client';

import {
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';

import { PromotionsService } from './promotions.service';

import type { AuditService } from '../audit/audit.service';
import type { DomainEventBus } from '../events/domain-event-bus';
import type { PrismaService } from '../prisma/prisma.service';
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
  percentOff: decimal(10),
  amountOff: null,
  buyQty: null,
  getQty: null,
  priority: 0,
  stackable: false,
  usageLimit: null,
  usageCount: 0,
  perUserLimit: null,
  minOrderAmount: null,
  startsAt: null,
  endsAt: null,
  merchantId: null,
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
      create: jest.fn(),
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

  const service = new PromotionsService(prisma as unknown as PrismaService, auditService, eventBus);
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
        },
        {
          promotionId: '2',
          code: null,
          name: 'Single',
          type: PromotionType.FIXED,
          priority: 1,
          stackable: false,
          discountAmount: 500,
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
        },
        {
          promotionId: '2',
          code: null,
          name: 'Stack 2',
          type: PromotionType.FIXED,
          priority: 4,
          stackable: true,
          discountAmount: 250,
        },
        {
          promotionId: '3',
          code: null,
          name: 'Single',
          type: PromotionType.FIXED,
          priority: 9,
          stackable: false,
          discountAmount: 400,
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
});
