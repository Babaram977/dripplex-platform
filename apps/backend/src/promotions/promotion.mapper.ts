import type { Promotion, PromotionRedemption } from '@prisma/client';

export interface PromotionDto {
  id: string;
  code: string | null;
  name: string;
  type: string;
  status: string;
  percentOff: number | null;
  amountOff: number | null;
  buyQty: number | null;
  getQty: number | null;
  priority: number;
  stackable: boolean;
  usageLimit: number | null;
  usageCount: number;
  perUserLimit: number | null;
  minOrderAmount: number | null;
  startsAt: string | null;
  endsAt: string | null;
  merchantId: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface PromotionDiscountDto {
  promotionId: string;
  code: string | null;
  name: string;
  type: string;
  priority: number;
  stackable: boolean;
  discountAmount: number;
}

export interface PromotionEvaluationDto {
  subtotal: number;
  discountTotal: number;
  discounts: PromotionDiscountDto[];
  couponCode: string | null;
  valid: boolean;
}

export interface PromotionRedemptionDto {
  id: string;
  promotionId: string;
  userId: string;
  orderId: string | null;
  amountSaved: number;
  createdAt: string;
}

export function toPromotionDto(promotion: Promotion): PromotionDto {
  return {
    id: promotion.id,
    code: promotion.code,
    name: promotion.name,
    type: promotion.type,
    status: promotion.status,
    percentOff: promotion.percentOff === null ? null : Number(promotion.percentOff),
    amountOff: promotion.amountOff === null ? null : Number(promotion.amountOff),
    buyQty: promotion.buyQty,
    getQty: promotion.getQty,
    priority: promotion.priority,
    stackable: promotion.stackable,
    usageLimit: promotion.usageLimit,
    usageCount: promotion.usageCount,
    perUserLimit: promotion.perUserLimit,
    minOrderAmount: promotion.minOrderAmount === null ? null : Number(promotion.minOrderAmount),
    startsAt: promotion.startsAt?.toISOString() ?? null,
    endsAt: promotion.endsAt?.toISOString() ?? null,
    merchantId: promotion.merchantId,
    metadata: promotion.metadata,
    createdAt: promotion.createdAt.toISOString(),
    updatedAt: promotion.updatedAt.toISOString(),
  };
}

export function toPromotionRedemptionDto(redemption: PromotionRedemption): PromotionRedemptionDto {
  return {
    id: redemption.id,
    promotionId: redemption.promotionId,
    userId: redemption.userId,
    orderId: redemption.orderId,
    amountSaved: Number(redemption.amountSaved),
    createdAt: redemption.createdAt.toISOString(),
  };
}
