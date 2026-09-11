import { LoyaltyTier } from '@prisma/client';

export const LOYALTY_PERMISSIONS = {
  CUSTOMER_READ: 'customer:loyalty:read',
  CUSTOMER_REDEEM: 'customer:loyalty:redeem',
  /**
   * Authorising a merchant to take your points at their counter. Held by
   * customers, drivers and riders alike — a DX point balance is keyed on the
   * user, not the persona, and the founder's decision was explicitly that all
   * three can spend theirs in a shop.
   */
  REDEMPTION_CODE_CREATE: 'loyalty:redemption-code:create',
  /** Taking a holder's points at the counter, in exchange for goods. */
  MERCHANT_REDEEM: 'merchant:loyalty:redeem',
  ADMIN_MANAGE: 'admin:loyalty:manage',
} as const;

export const LOYALTY_AUDIT_ACTIONS = {
  POINTS_AWARDED: 'loyalty.points_awarded',
  POINTS_REDEEMED: 'loyalty.points_redeemed',
  POINTS_EXPIRED: 'loyalty.points_expired',
  ACHIEVEMENT_CREATED: 'loyalty.achievement_created',
  ACHIEVEMENT_UPDATED: 'loyalty.achievement_updated',
  ACHIEVEMENT_DELETED: 'loyalty.achievement_deleted',
  REDEMPTION_CODE_ISSUED: 'loyalty.redemption_code_issued',
  REDEMPTION_CODE_CANCELLED: 'loyalty.redemption_code_cancelled',
  MERCHANT_REDEEMED: 'loyalty.merchant_redeemed',
  REWARD_REDEEMED: 'loyalty.reward_redeemed',
  REWARD_FULFILMENT_UPDATED: 'loyalty.reward_fulfilment_updated',
  SETTINGS_UPDATED: 'loyalty.settings_updated',
  POINTS_ADJUSTED: 'loyalty.points_adjusted',
  POINTS_REVERSED: 'loyalty.points_reversed',
} as const;

export const LOYALTY_EVENT_POINTS = {
  ORDER_PAID: 50,
  DELIVERY_COMPLETED: 25,
  CUSTOMER_REGISTERED: 100,
  COUPON_REDEEMED: 10,
  CASHBACK: 1,
} as const;

/** The fixed id of the singleton `LoyaltySetting` row — same pattern as
 *  PLATFORM_COMMISSION_SETTING_ID. */
export const LOYALTY_SETTING_ID = '00000000-0000-4000-8000-00000000100a';

/**
 * What a DX point is worth. Founder decision: 200 points = ₦1.
 *
 * Redemptions are required to be whole multiples of this, so no fraction of a
 * naira is ever silently rounded away from a customer.
 *
 * DPX-LOYALTY-005 moved the live figure into `loyalty_settings`, where an
 * operator edits it without a deployment. This constant now only seeds that
 * row, and is the fallback for a read that somehow finds no row at all.
 */
export const LOYALTY_POINTS_PER_NAIRA = 200;

/** Founder decision: points are good for a year from the day they are earned. */
export const LOYALTY_POINT_EXPIRY_DAYS = 365;

/**
 * Founder-decided customer benefit thresholds.
 *
 * `DELIVERY_DISCOUNT_BALANCE` is measured against the points a customer is
 * holding; `MONTHLY_ELITE_EARNED` against the points they earned within the
 * current calendar month in Lagos time. The *size* of each benefit is not
 * fixed here — it is configured per campaign — so only the qualifying line
 * lives in code.
 */
export const LOYALTY_BENEFIT_THRESHOLDS = {
  DELIVERY_DISCOUNT_BALANCE: 10_000,
  MONTHLY_ELITE_EARNED: 50_000,
} as const;

/** How often the expiry sweep looks for points that have fallen due. */
export const LOYALTY_EXPIRY_SWEEP_INTERVAL_MS = 60 * 60 * 1000;

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
  STORE_REDEMPTION: 'STORE_REDEMPTION',
  REWARD: 'REWARD',
  /** An Operations adjustment. No reference id — it points at nothing but the
   *  decision, which is recorded on the audit trail instead. */
  ADJUSTMENT: 'ADJUSTMENT',
} as const;

/**
 * How a redemption is labelled on the *wallet* side of the ledger. The wallet
 * credit is keyed on this plus the loyalty ledger entry's id, and
 * `wallet_ledger_entries` has a unique index over that pair — so a redemption
 * can never pay out twice, whatever happens between the two ledgers.
 */
export const LOYALTY_WALLET_REFERENCE_TYPE = 'LOYALTY_REDEMPTION';

/** How a merchant's side of an in-store redemption is labelled on the wallet. */
export const LOYALTY_MERCHANT_WALLET_REFERENCE_TYPE = 'LOYALTY_STORE_REDEMPTION';

/**
 * How a coupon redeemed at a counter is labelled, on both the promotion
 * redemption and the merchant's wallet credit. Paired with the till code's id,
 * which is what makes the payment idempotent: the wallet's unique index on
 * (wallet, reference type, reference id) means a retry pays once.
 */
export const LOYALTY_STORE_COUPON_REFERENCE_TYPE = 'LOYALTY_STORE_COUPON';

/**
 * How long a counter code is good for. Long enough to find the app, read it out
 * and have it typed in; short enough that a code glimpsed over a shoulder is
 * worthless by the time anybody could use it.
 */
export const LOYALTY_REDEMPTION_CODE_TTL_MS = 10 * 60 * 1000;

/**
 * The code alphabet, minus the characters people confuse when reading one out
 * across a counter: no O/0, no I/1, no S/5. Eight characters from 29 symbols is
 * about 5e11 possibilities — brute force is not the attack to worry about, and
 * the endpoint is throttled besides.
 */
export const LOYALTY_REDEMPTION_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRTUVWXYZ';
export const LOYALTY_REDEMPTION_CODE_LENGTH = 8;
