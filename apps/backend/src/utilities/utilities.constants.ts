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

/**
 * The same outage, told to somebody who paid by card.
 *
 * "Your money has not been taken" is true on the wallet path and false on the
 * card path: the gateway really did charge them, and DrippleX returns it to
 * the DrippleX wallet rather than to the card (DPX-D4). A customer who has
 * just watched ₦100 leave their card being told it was never taken is a trust
 * problem, and it contradicted the same screen's own "money returned" header.
 */
export const UTILITY_FLOAT_EXHAUSTED_CARD_CUSTOMER_MESSAGE =
  'This service is temporarily unavailable. Your payment has been returned to your DrippleX Wallet — please try again shortly.';

/** A card purchase that failed for any other provider reason. Same point: say
 * where the money went, rather than implying it never moved. */
export const UTILITY_CARD_REVERSAL_SUFFIX =
  'Your payment has been returned to your DrippleX Wallet.';

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

/** Betting-wallet funding bounds. Peyflex publishes none — its own example
 * funds ₦14 — so like airtime these are DrippleX's guard rails against a
 * fat-fingered amount, not a provider contract. The ceiling matches the
 * largest figure Peyflex themselves advertise (a ₦100,000 SportyBet top-up),
 * rounded up. */
export const UTILITY_BETTING_MIN_AMOUNT = 100;
export const UTILITY_BETTING_MAX_AMOUNT = 500_000;

/** How many exam PINs one purchase may buy.
 *
 * Also DrippleX's own rail. It bounds the blast radius of a mistyped
 * quantity on a ₦5,350 unit price, and it bounds the delivered-PIN string,
 * which arrives as one `||`-separated blob. Raise it freely — nothing in the
 * provider contract objects. */
export const UTILITY_EDUCATION_MIN_QUANTITY = 1;
export const UTILITY_EDUCATION_MAX_QUANTITY = 10;

/** How long to wait on a Peyflex call before giving up. A purchase that times
 * out cannot be resolved programmatically (G1/G2), so the timeout is set long
 * enough that a merely-slow provider is not turned into a manual reconcile. */
export const UTILITY_PROVIDER_TIMEOUT_MS = 45_000;

/** Catalogue cache TTL. The plan lists move rarely, but hardcoding them is
 * what makes a customer pay for a bundle that no longer exists, so they are
 * read from Peyflex and merely cached. */
export const UTILITY_CATALOGUE_CACHE_TTL_MS = 10 * 60_000;

/**
 * How often to look for card purchases that were paid but never completed.
 *
 * The card path has two triggers and both are event-driven: the customer
 * returning to the app, and the gateway webhook. Neither is guaranteed. A
 * customer who closes the tab AND a webhook that never lands leaves the money
 * taken, the row on AWAITING_PAYMENT, and Peyflex never called — which is
 * exactly what happened to a ₦1,000 airtime purchase on 2026-08-19. This
 * sweep is the trigger that does not depend on anything arriving.
 */
export const UTILITY_PAYMENT_SWEEP_INTERVAL_MS = 5 * 60_000;

/**
 * How long to leave a purchase alone before sweeping it.
 *
 * The customer is still at the gateway during this window. Sweeping
 * immediately would ask the gateway about a payment that is legitimately
 * still in progress, and would race the two fast paths for no benefit.
 */
export const UTILITY_PAYMENT_SWEEP_GRACE_MS = 10 * 60_000;

/**
 * How far back to keep looking.
 *
 * Bounded for two reasons. An abandoned checkout — a customer who opened the
 * gateway and never paid — is a row that will never confirm, and polling it
 * forever spends a gateway call every five minutes for nothing. And a
 * purchase old enough to have been forgotten should be an operator's
 * decision, not a surprise delivery weeks later. Past this age the row stops
 * being swept and stays for the Ops resolve desk.
 */
export const UTILITY_PAYMENT_SWEEP_MAX_AGE_MS = 7 * 24 * 60 * 60_000;

/** Rows examined per sweep, oldest first. Bounds the gateway calls one pass
 * can make; a backlog simply drains across several passes. */
export const UTILITY_PAYMENT_SWEEP_BATCH = 25;
