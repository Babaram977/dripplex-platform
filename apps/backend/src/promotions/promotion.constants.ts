export const PROMOTION_AUDIT_ACTIONS = {
  CREATED: 'promotion.created',
  UPDATED: 'promotion.updated',
  DELETED: 'promotion.deleted',
  REDEEMED: 'promotion.redeemed',
  PAUSED: 'promotion.paused',
  RESUMED: 'promotion.resumed',
  ARCHIVED: 'promotion.archived',
  FORCE_EXPIRED: 'promotion.force_expired',
  CLONED: 'promotion.cloned',
} as const;

export const PROMOTION_PERMISSIONS = {
  CUSTOMER_USE: 'customer:promotions:use',
  ADMIN_MANAGE: 'admin:promotions:manage',
} as const;

/**
 * WalletLedgerEntry.referenceType for promotion-driven wallet credits
 * (WALLET_CREDIT / CASHBACK / BONUS_REWARD promotion types), paired with
 * referenceId = PromotionRedemption.id — same idempotency pattern as
 * RIDE_WALLET_REFERENCE_TYPES / DRIVER_CAMPAIGN_WALLET_REFERENCE_TYPE.
 */
export const PROMOTION_WALLET_REFERENCE_TYPE = 'promotion_redemption';

/** How often the sweep expires campaigns whose endsAt has passed. */
export const PROMOTION_SWEEP_INTERVAL_MS = 5 * 60_000;

/** PromotionType values that pay a flat creditAmount into a wallet instead
 * of reducing the current subtotal — see PromotionsService.calculateEffect. */
export const CREDIT_PROMOTION_TYPES = ['WALLET_CREDIT', 'CASHBACK', 'BONUS_REWARD'] as const;

/**
 * PromotionType values that carry no basket benefit of their own, because they
 * exist to group something else.
 *
 * A REFERRAL promotion is a campaign: an attribution container that promoters
 * are enrolled into. What anybody earns under it lives on `CampaignPromoter`
 * (`reward_amount` XOR `reward_points`, set per promoter at enrolment and
 * enforced by a CHECK constraint), so the campaign itself has no percentOff, no
 * amountOff and no creditAmount — there is nothing for it to discount. It is
 * never applied to a basket: `REFERRAL` appears nowhere in this module's
 * discount path, only in the referrals module that reads it.
 *
 * Without this, `validatePromotionShape` demanded a discount from every type
 * that was neither BOGO nor a credit type, so creating a referral campaign
 * through the API was impossible — "Promotion requires percentOff or amountOff"
 * on a form whose own copy says the rewards are set per promoter, not there.
 * The bug survived because every test creating one inserts the row directly
 * with `prisma.promotion.create`, so the service path was never exercised.
 */
export const ATTRIBUTION_PROMOTION_TYPES = ['REFERRAL'] as const;
