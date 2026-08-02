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
