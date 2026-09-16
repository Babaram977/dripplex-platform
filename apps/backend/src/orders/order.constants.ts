export const ORDER_AUDIT_ACTIONS = {
  CREATED: 'order.created',
  CANCELLED: 'order.cancelled',
  INVENTORY_RESERVED: 'inventory.reserved',
  INVENTORY_RELEASED: 'inventory.released',
  ACCEPTED: 'order.accepted',
  REJECTED: 'order.rejected',
  READY: 'order.ready',
  /// DPX-ORDER-B — the merchant confirmed a "Pay to Merchant Bank" transfer
  /// landed in their own account. DrippleX never sees the transfer, so this
  /// audit record is the only trace of who asserted it and when.
  PAYMENT_CONFIRMED: 'order.payment_confirmed',
  DELAYED: 'order.delayed',
  COMPLETED: 'order.completed',
  REFUNDED: 'order.refunded',
  /// DPX-ORDER-PROOF-001 — the customer filed a bank receipt for a
  /// MERCHANT_DIRECT transfer. Recorded separately from PAYMENT_CONFIRMED:
  /// this is the customer's claim, that is the merchant's acknowledgement.
  PAYMENT_PROOF_SUBMITTED: 'order.payment_proof_submitted',
  DISPUTE_RAISED: 'order.dispute_raised',
  DISPUTE_RESOLVED: 'order.dispute_resolved',
  SETTLEMENT_COMPLETED: 'order.settlement.completed',
  SETTLEMENT_FAILED: 'order.settlement.failed',
  SETTLEMENT_REVERSED: 'order.settlement.reversed',
  COMMISSION_SETTINGS_UPDATED: 'merchant_commission_settings.updated',
  /** A rate agreed with one merchant, or an agreement cleared. */
  MERCHANT_RATE_NEGOTIATED: 'merchant_commission.rate_negotiated',
} as const;

export const ORDER_PERMISSIONS = {
  CHECKOUT: 'customer:checkout',
  ORDERS: 'customer:orders',
  ADMIN_READ: 'admin:orders:read',
  ADMIN_MANAGE: 'admin:orders:manage',
  MERCHANT_MANAGE: 'merchant:orders:manage',
  ADMIN_SETTLEMENT_COMMISSION_MANAGE: 'admin:merchant-settlement:commission:manage',
  /**
   * DPX-ORDER-8D-RECOVERY — authority to act on a stalled-order recovery case.
   *
   * Deliberately NOT ADMIN_MANAGE. That permission already authorises dispute
   * resolution and wallet refunds, so reusing it would hand every recovery
   * operator the power to move money on any order as a side effect. Recovery
   * authority is narrower than order management and is granted separately.
   *
   * Increment 1 defines and seeds it. NOTHING CONSUMES IT YET — no endpoint,
   * no control. It exists so the later increments attach to a permission that
   * was granted deliberately rather than minted alongside the first mutation.
   */
  ADMIN_RECOVERY_MANAGE: 'admin:orders:recovery:manage',
} as const;

/// DPX-MERCHANT-002 — the singleton MerchantCommissionSetting row's fixed
/// id, same pattern as DRIVER_SECURITY_SETTINGS_ID.
export const MERCHANT_COMMISSION_SETTING_ID = '00000000-0000-0000-0000-000000000002';

export const DEFAULT_MERCHANT_COMMISSION_RATE = 0.1;

/** WalletLedgerEntry.referenceType for a merchant order settlement credit,
 * paired with referenceId = order.id — same idempotency-supporting
 * pattern as ORDER_WALLET_REFERENCE_TYPE/ORDER_WALLET_PAYMENT_REFERENCE_TYPE. */
export const ORDER_SETTLEMENT_WALLET_REFERENCE_TYPE = 'order_settlement';

/** Distinct referenceType for a settlement reversal (post-completion
 * refund), so the composite (walletId, referenceType, referenceId)
 * uniqueness constraint keeps the original credit and its reversal as
 * separate ledger entries. */
export const ORDER_SETTLEMENT_REVERSAL_WALLET_REFERENCE_TYPE = 'order_settlement_reversal';

export const RESERVATION_TTL_MS = 30 * 60 * 1000;
export const RESERVATION_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/** How long a DELIVERED/COMPLETED-eligible order waits for the customer to
 * either confirm receipt or raise a dispute before the sweep auto-completes
 * it. Mirrors the reservation-cleanup sweep pattern. */
/**
 * 8D-C — how long an order may sit in CONFIRMED, unactioned, before it is
 * considered **potentially** stranded.
 *
 * 30 minutes. Founder ruling, 2026-09-15 — a product decision, not an
 * engineering default. Changing this value changes the policy, which is why it
 * is a named constant rather than a literal inside a query.
 *
 * Chosen because 30 minutes is the platform's existing standard for how long an
 * unactioned order may hold stock at the PENDING stage (RESERVATION_TTL_MS),
 * reused here as a consistent principle: a confirmed order is no more entitled
 * to sit unactioned than an unpaid one. It is NOT derived from the reservation
 * TTL applying to CONFIRMED orders — it does not. A CONFIRMED order's
 * reservation is never released by expiry, because the cleanup sweep filters on
 * PENDING.
 *
 * "Potentially" is load-bearing. The data cannot tell an order the POS failed to
 * advance from one the merchant simply never accepted; both look identical.
 * Attribution needs separate evidence.
 *
 * REMEDIATION RULING, 2026-09-16. This constant now has a call site:
 * OrderExceptionSweepService raises an OrderException when an order crosses it.
 * What it still does NOT do is cancel, decline, refund, release inventory or
 * advance anything. The ruling is explicit that 30 minutes is a detection and
 * escalation threshold, not an automatic cancellation rule — making it one
 * needs the refund, payment, inventory and merchant consequences defined first,
 * which is a separate ruling. Detection stays separate from state mutation.
 */
export const ORDER_POTENTIALLY_STRANDED_AFTER_MS = 30 * 60 * 1000;

export const ORDER_AUTO_COMPLETE_AFTER_MS = 24 * 60 * 60 * 1000;
export const ORDER_COMPLETION_SWEEP_INTERVAL_MS = 15 * 60 * 1000;

/** WalletLedgerEntry.referenceType for order refunds, paired with
 * referenceId = order.id — same idempotency pattern as
 * RIDE_WALLET_REFERENCE_TYPES / PROMOTION_WALLET_REFERENCE_TYPE. */
export const ORDER_WALLET_REFERENCE_TYPE = 'order_refund';

/** WalletLedgerEntry.referenceType for paying an order with Dx Wallet
 * balance, paired with referenceId = order.id. Deliberately distinct from
 * ORDER_WALLET_REFERENCE_TYPE (refunds) so the composite
 * (walletId, referenceType, referenceId) uniqueness constraint keeps a
 * payment and its later refund as separate ledger entries. */
export const ORDER_WALLET_PAYMENT_REFERENCE_TYPE = 'order_payment';

/**
 * How often the stalled-order sweep runs. Deliberately shorter than
 * ORDER_POTENTIALLY_STRANDED_AFTER_MS so an order is detected within half a
 * sweep of crossing the threshold, rather than up to a full interval late.
 */
export const ORDER_EXCEPTION_SWEEP_INTERVAL_MS = 15 * 60 * 1000;
