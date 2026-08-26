export const REFERRAL_AUDIT_ACTIONS = {
  CODE_GENERATED: 'referral.code_generated',
  REDEEMED: 'referral.redeemed',
  REWARDED: 'referral.rewarded',
} as const;

export const REFERRAL_PERMISSIONS = {
  CUSTOMER_USE: 'customer:referrals:use',
  /** A driver's own referral code. Separate from the customer permission so a
   *  driver is never issued a code whose payout would be filed as a
   *  customer's — `Referral.ownerType` is fixed at creation and decides which
   *  wallet the ₦350 lands in. */
  DRIVER_USE: 'driver:referrals:use',
  ADMIN_MANAGE: 'admin:referrals:manage',
} as const;

/**
 * WalletLedgerEntry.referenceType values used for referral rewards, paired
 * with referenceId = redemption.id — mirrors RIDE_WALLET_REFERENCE_TYPES
 * (ride.constants.ts). Makes each reward credit idempotent: replaying the
 * reward trigger for the same redemption never double-credits either wallet.
 */
export const REFERRAL_WALLET_REFERENCE_TYPES = {
  REFERRER_REWARD: 'referral_referrer_reward',
  REFEREE_REWARD: 'referral_referee_reward',
} as const;

/**
 * Reward amounts in NGN.
 *
 * Founder decision, 2026-08-25: "350 not 500" — both sides. This was a
 * placeholder until then, and the customer app was already promising the
 * unapproved 500 on screen. No longer a placeholder; change it here and every
 * caller and the API's own stats response follow, because nothing hardcodes
 * a number.
 */
export const REFERRAL_REWARD_AMOUNTS = {
  REFERRER: 350,
  REFEREE: 350,
} as const;

/**
 * Excludes visually ambiguous characters (0/O, 1/I/L) so a code read aloud
 * or handwritten doesn't get mistyped.
 */
export const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const REFERRAL_CODE_LENGTH = 8;
export const REFERRAL_CODE_MAX_GENERATION_ATTEMPTS = 10;
export const REFERRAL_CODE_PATTERN = /^[A-Z0-9]{4,16}$/;
