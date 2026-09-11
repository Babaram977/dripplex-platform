export const REFERRAL_AUDIT_ACTIONS = {
  CODE_GENERATED: 'referral.code_generated',
  REDEEMED: 'referral.redeemed',
  /** The referee met their milestone and screening passed. The hold starts. */
  QUALIFIED: 'referral.qualified',
  /** Released by an operator before the hold elapsed, or after clearing a flag. */
  APPROVED: 'referral.approved',
  /** Both wallets credited. Keeps its original name because it is the same
   *  event the platform has always recorded here, and renaming an audit action
   *  breaks every query anyone has written against the trail. */
  REWARDED: 'referral.rewarded',
  REJECTED: 'referral.rejected',
  REVERSED: 'referral.reversed',
  PROGRAMME_UPDATED: 'referral.programme_updated',
} as const;

export const REFERRAL_PERMISSIONS = {
  CUSTOMER_USE: 'customer:referrals:use',
  /** A driver's own referral code. Separate from the customer permission so a
   *  driver is never issued a code whose payout would be filed as a
   *  customer's — `Referral.ownerType` is fixed at creation and decides which
   *  wallet the ₦350 lands in. */
  DRIVER_USE: 'driver:referrals:use',
  /** A rider's own referral code. Separate from the driver and customer
   *  permissions for the same reason those are separate from each other:
   *  `Referral.ownerType` is fixed at creation and decides which wallet the
   *  ₦350 is paid into. */
  RIDER_USE: 'rider:referrals:use',
  /** A merchant's own referral code. Same reasoning as the split above:
   *  `Referral.ownerType` is fixed at creation and decides which wallet the
   *  ₦350 lands in — a merchant's goes to the merchant wallet their portal
   *  shows and can withdraw from. */
  MERCHANT_USE: 'merchant:referrals:use',
  /** A fleet owner's own referral code. Their reward is paid into their
   *  personal customer wallet rather than the fleet's receivables: a referral
   *  is the owner's own marketing, while receivables are what DrippleX owes
   *  the fleet for work its riders did. */
  FLEET_OWNER_USE: 'fleet:referrals:use',
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
  /** Clawing a paid reward back. Its own reference type rather than a second
   *  entry under the reward's, because the ledger's uniqueness is per
   *  (wallet, referenceType, referenceId) and the credit and the debit have to
   *  coexist — and because a statement should say which of the two it is. */
  REFERRER_REVERSAL: 'referral_referrer_reversal',
  REFEREE_REVERSAL: 'referral_referee_reversal',
} as const;

/**
 * How many redemptions one sweep pass will move.
 *
 * Bounded so a backlog is worked through over several passes rather than in one
 * transaction-heavy burst that competes with live traffic for the database.
 */
export const REFERRAL_SWEEP_BATCH_SIZE = 200;

/** How often the lifecycle sweep runs. Hold periods are measured in days, so
 *  nothing needs to be noticed sooner than this. */
export const REFERRAL_SWEEP_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Reward amounts in NGN — the fallback when no programme row exists.
 *
 * Founder decision, 2026-08-25: "350 not 500" — both sides.
 *
 * DPX-REFERRAL-003 moved the live numbers into `referral_programmes`, where an
 * operator edits them without a deployment. These constants remain as the
 * figure quoted to a user whose programme row is missing, which is the only
 * state in which nothing has agreed an amount. They are never what gets paid:
 * a referral with no programme does not qualify, so it cannot pay the wrong
 * number — it simply does not pay.
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
