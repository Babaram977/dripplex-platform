export const UTILITIES_PERMISSIONS = {
  /** Browse the catalogues and verify a meter or smartcard. Separate from
   * PURCHASE so a suspended customer can still see what a bundle costs
   * without being able to spend. */
  CUSTOMER_READ: 'customer:utilities:read',
  CUSTOMER_PURCHASE: 'customer:utilities:purchase',
  /** Ops: the purchase register, the float balance, and resolving a purchase
   * left PENDING by a provider timeout. */
  ADMIN_MANAGE: 'admin:utilities:manage',
} as const;

export const UTILITIES_AUDIT_ACTIONS = {
  PURCHASE_INITIATED: 'utilities.purchase_initiated',
  PURCHASE_SUCCEEDED: 'utilities.purchase_succeeded',
  PURCHASE_FAILED: 'utilities.purchase_failed',
  PURCHASE_REVERSED: 'utilities.purchase_reversed',
  /** An operator deciding, by hand, what happened to a purchase the provider
   * never answered for. */
  PURCHASE_RESOLVED: 'utilities.purchase_resolved',
} as const;

/**
 * WalletLedgerEntry.referenceType for the debit that pays for a utility
 * purchase, paired with referenceId = UtilityPurchase.id.
 *
 * This is the whole of DrippleX's idempotency for utilities. Peyflex accepts
 * no client reference (DPX-UTILITIES-002 G1), so the guarantee has to live on
 * our side: `WalletService.applyMutation` skips a mutation that already has a
 * ledger entry for the same (walletId, referenceType, referenceId), which is
 * what stops a duplicate tap on a weak connection from debiting twice.
 */
export const UTILITY_WALLET_REFERENCE_TYPE = 'utility_purchase';

/**
 * Reversal credit's referenceType, paired with the SAME referenceId as the
 * debit. referenceId is a UUID column so the reversal cannot suffix the id;
 * a distinct referenceType is what keeps the two entries apart under the
 * uniqueness constraint. Same shape as the withdrawal reversal.
 */
export const UTILITY_WALLET_REVERSAL_REFERENCE_TYPE = 'utility_purchase_reversal';

/**
 * What the customer is told when the provider refuses because the DrippleX
 * float is dry.
 *
 * Peyflex answers `Insufficient wallet balance`, which is about *our* wallet,
 * not theirs. Passed through verbatim it reads as an accusation and sends the
 * customer to top up an account that is already funded.
 */
export const UTILITY_FLOAT_EXHAUSTED_CUSTOMER_MESSAGE =
  'This service is temporarily unavailable. Your money has not been taken — please try again shortly.';

/** Substrings in a provider message that mean the DrippleX float, not the
 * customer, is the problem. Matched case-insensitively. */
export const UTILITY_FLOAT_EXHAUSTED_MARKERS = [
  'insufficient wallet balance',
  'insufficient balance',
  'insufficient funds',
] as const;

/** Airtime top-up bounds. Peyflex publishes no limits for airtime (unlike
 * electricity, which returns min/max per disco), so these are DrippleX's own
 * guard rails against a fat-fingered amount, not a provider contract. */
export const UTILITY_AIRTIME_MIN_AMOUNT = 50;
export const UTILITY_AIRTIME_MAX_AMOUNT = 50_000;

/** How long to wait on a Peyflex call before giving up. A purchase that times
 * out cannot be resolved programmatically (G1/G2), so the timeout is set long
 * enough that a merely-slow provider is not turned into a manual reconcile. */
export const UTILITY_PROVIDER_TIMEOUT_MS = 45_000;

/** Catalogue cache TTL. The plan lists move rarely, but hardcoding them is
 * what makes a customer pay for a bundle that no longer exists, so they are
 * read from Peyflex and merely cached. */
export const UTILITY_CATALOGUE_CACHE_TTL_MS = 10 * 60_000;
