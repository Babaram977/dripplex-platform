export const REFERRAL_AUDIT_ACTIONS = {
  CODE_GENERATED: 'referral.code_generated',
  REDEEMED: 'referral.redeemed',
  REWARDED: 'referral.rewarded',
} as const;

export const REFERRAL_PERMISSIONS = {
  CUSTOMER_USE: 'customer:referrals:use',
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
 * Reward amounts in NGN. Placeholder pending founder approval — same
 * placeholder discipline as RIDE_FARE_RATES in ride.constants.ts.
 * TODO: confirm actual amounts before production; trivial to change since
 * every caller reads from here rather than hardcoding a number.
 */
export const REFERRAL_REWARD_AMOUNTS = {
  REFERRER: 500,
  REFEREE: 500,
} as const;

/**
 * Excludes visually ambiguous characters (0/O, 1/I/L) so a code read aloud
 * or handwritten doesn't get mistyped.
 */
export const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const REFERRAL_CODE_LENGTH = 8;
export const REFERRAL_CODE_MAX_GENERATION_ATTEMPTS = 10;
export const REFERRAL_CODE_PATTERN = /^[A-Z0-9]{4,16}$/;
