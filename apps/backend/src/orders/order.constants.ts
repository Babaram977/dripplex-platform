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
} as const;

export const ORDER_PERMISSIONS = {
  CHECKOUT: 'customer:checkout',
  ORDERS: 'customer:orders',
  ADMIN_READ: 'admin:orders:read',
  ADMIN_MANAGE: 'admin:orders:manage',
  MERCHANT_MANAGE: 'merchant:orders:manage',
  ADMIN_SETTLEMENT_COMMISSION_MANAGE: 'admin:merchant-settlement:commission:manage',
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
