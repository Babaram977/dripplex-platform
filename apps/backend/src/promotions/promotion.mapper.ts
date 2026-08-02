import type { PromotionRules } from './promotion-rules';
import type { Promotion, PromotionRedemption } from '@prisma/client';

export interface PromotionDto {
  id: string;
  code: string | null;
  name: string;
  type: string;
  status: string;
  domains: string[];
  percentOff: number | null;
  amountOff: number | null;
  creditAmount: number | null;
  maxDiscount: number | null;
  buyQty: number | null;
  getQty: number | null;
  priority: number;
  stackable: boolean;
  usageLimit: number | null;
  usageCount: number;
  perUserLimit: number | null;
  perDeviceLimit: number | null;
  minOrderAmount: number | null;
  rules: PromotionRules | null;
  startsAt: string | null;
  endsAt: string | null;
  pausedAt: string | null;
  archivedAt: string | null;
  merchantId: string | null;
  clonedFromId: string | null;
  createdBy: string | null;
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
  creditAmount: number;
}

export interface PromotionEvaluationDto {
  subtotal: number;
  discountTotal: number;
  discounts: PromotionDiscountDto[];
  couponCode: string | null;
  valid: boolean;
}

export interface PromotionAnalyticsDto {
  promotionId: string;
  totalRedemptions: number;
  uniqueUsers: number;
  totalDiscountCost: number;
  usageLimit: number | null;
  usageCount: number;
  redemptionRate: number | null;
}

export interface PromotionLeaderboardEntryDto {
  promotionId: string;
  code: string | null;
  name: string;
  type: string;
  redemptions: number;
  discountCost: number;
}

export interface PromotionRedemptionDto {
  id: string;
  promotionId: string;
  userId: string;
  orderId: string | null;
  referenceType: string | null;
  referenceId: string | null;
  walletTransactionId: string | null;
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
    domains: promotion.domains,
    percentOff: promotion.percentOff === null ? null : Number(promotion.percentOff),
    amountOff: promotion.amountOff === null ? null : Number(promotion.amountOff),
    creditAmount: promotion.creditAmount === null ? null : Number(promotion.creditAmount),
    maxDiscount: promotion.maxDiscount === null ? null : Number(promotion.maxDiscount),
    buyQty: promotion.buyQty,
    getQty: promotion.getQty,
    priority: promotion.priority,
    stackable: promotion.stackable,
    usageLimit: promotion.usageLimit,
    usageCount: promotion.usageCount,
    perUserLimit: promotion.perUserLimit,
    perDeviceLimit: promotion.perDeviceLimit,
    minOrderAmount: promotion.minOrderAmount === null ? null : Number(promotion.minOrderAmount),
    rules: (promotion.rules as PromotionRules | null) ?? null,
    startsAt: promotion.startsAt?.toISOString() ?? null,
    endsAt: promotion.endsAt?.toISOString() ?? null,
    pausedAt: promotion.pausedAt?.toISOString() ?? null,
    archivedAt: promotion.archivedAt?.toISOString() ?? null,
    merchantId: promotion.merchantId,
    clonedFromId: promotion.clonedFromId,
    createdBy: promotion.createdBy,
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
    referenceType: redemption.referenceType,
    referenceId: redemption.referenceId,
    walletTransactionId: redemption.walletTransactionId,
    amountSaved: Number(redemption.amountSaved),
    createdAt: redemption.createdAt.toISOString(),
  };
}
