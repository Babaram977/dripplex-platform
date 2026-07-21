import { LoyaltyTier } from '@prisma/client';

export const LOYALTY_PERMISSIONS = {
  CUSTOMER_READ: 'customer:loyalty:read',
  CUSTOMER_REDEEM: 'customer:loyalty:redeem',
  ADMIN_MANAGE: 'admin:loyalty:manage',
} as const;

export const LOYALTY_AUDIT_ACTIONS = {
  POINTS_AWARDED: 'loyalty.points_awarded',
  POINTS_REDEEMED: 'loyalty.points_redeemed',
  POINTS_EXPIRED: 'loyalty.points_expired',
  ACHIEVEMENT_CREATED: 'loyalty.achievement_created',
  ACHIEVEMENT_UPDATED: 'loyalty.achievement_updated',
  ACHIEVEMENT_DELETED: 'loyalty.achievement_deleted',
} as const;

export const LOYALTY_EVENT_POINTS = {
  ORDER_PAID: 50,
  DELIVERY_COMPLETED: 25,
  CUSTOMER_REGISTERED: 100,
  COUPON_REDEEMED: 10,
  CASHBACK: 1,
} as const;

export const LOYALTY_POINT_EXPIRY_DAYS = 365;

export const LOYALTY_TIER_THRESHOLDS: Record<LoyaltyTier, number> = {
  [LoyaltyTier.BRONZE]: 0,
  [LoyaltyTier.SILVER]: 1_000,
  [LoyaltyTier.GOLD]: 5_000,
  [LoyaltyTier.PLATINUM]: 15_000,
  [LoyaltyTier.VIP]: 50_000,
};

export const LOYALTY_MILESTONE_ACHIEVEMENTS = [
  { code: 'POINTS_100', lifetimePoints: 100 },
  { code: 'POINTS_1000', lifetimePoints: 1_000 },
  { code: 'POINTS_5000', lifetimePoints: 5_000 },
  { code: 'POINTS_15000', lifetimePoints: 15_000 },
  { code: 'POINTS_50000', lifetimePoints: 50_000 },
] as const;

export const LOYALTY_REFERENCE_TYPES = {
  ORDER: 'ORDER',
  DELIVERY: 'DELIVERY',
  CUSTOMER: 'CUSTOMER',
  COUPON: 'COUPON',
  CASHBACK: 'CASHBACK',
  REDEMPTION: 'REDEMPTION',
  ACHIEVEMENT: 'ACHIEVEMENT',
  EXPIRATION: 'POINT_EXPIRATION',
} as const;
