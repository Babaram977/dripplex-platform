/// DPX-COMMERCIAL-001 Slice 1 — permissions, audit actions, and default
/// seed values for the shared commercial engine (Commission Account/
/// Ledger, admin-configurable credit limits). See
/// docs/DPX-COMMERCIAL-001-REVENUE-SETTLEMENT-CREDIT-POLICY.md.

export const COMMERCIAL_PERMISSIONS = {
  /// Editing the commercial credit-limit policy is a more sensitive action
  /// than routine admin work — separate permission, same reasoning as
  /// Driver-001's security-settings / DPX-MERCHANT-002's commission-rate
  /// permission split.
  ADMIN_CREDIT_SETTINGS_MANAGE: 'admin:commercial:credit-settings:manage',
  /// Reading a commission account/ledger and recording a manual external
  /// payment against it — kept as one permission for Slice 1 (both are
  /// admin financial-reconciliation actions); can be split later if a
  /// read-only admin role is ever needed.
  ADMIN_ACCOUNT_MANAGE: 'admin:commercial:account:manage',
  /// Slice 5 — a merchant/driver reading their own CommissionAccount and
  /// ledger. Mirrors WALLET_PERMISSIONS.MERCHANT_READ/DRIVER_READ exactly
  /// (self-only read, no write, no cross-owner access).
  MERCHANT_READ: 'merchant:commercial:read',
  DRIVER_READ: 'driver:commercial:read',
} as const;

export const COMMERCIAL_AUDIT_ACTIONS = {
  CREDIT_SETTING_UPDATED: 'commercial_credit_setting.updated',
  PAYMENT_RECORDED: 'commission_account.payment_recorded',
  BLOCKED: 'commission_account.blocked',
  UNBLOCKED: 'commission_account.unblocked',
} as const;

/// Seed-only fallback values — read exactly once, the first time
/// CommercialCreditSettingsService.getEffective(ownerType) finds no row for
/// that owner type. Every subsequent read comes from the database row; an
/// admin can change the limit from the Admin Portal without a code change
/// or deploy. Never referenced directly by accrual/blocking logic.
export const DEFAULT_MERCHANT_CREDIT_LIMIT = 10_000;
export const DEFAULT_DRIVER_CREDIT_LIMIT = 10_000;

/// CommissionLedgerEntry.referenceType values used by real accrual call
/// sites landing in Slice 2-4; declared here now so every slice references
/// the same literal instead of re-inventing one.
export const COMMISSION_REFERENCE_TYPES = {
  ORDER: 'order',
  RIDE: 'ride',
  DELIVERY_JOB: 'delivery_job',
} as const;

/// Slice 2 — distinct referenceType for reversing a mode-B order's
/// accrual on refund, paired with referenceId = order.id. Kept separate
/// from COMMISSION_REFERENCE_TYPES.ORDER so the (accountId, referenceType,
/// referenceId) uniqueness constraint keeps the original accrual and its
/// reversal as two distinct ledger entries — same pattern as
/// ORDER_SETTLEMENT_REVERSAL_WALLET_REFERENCE_TYPE.
export const COMMISSION_ORDER_REVERSAL_REFERENCE_TYPE = 'order_commission_reversal';

/// Slice 2 — referenceType for the automatic deduction a mode-A
/// settlement applies against a merchant's outstanding commission
/// balance, paired with referenceId = order.id. Distinct from
/// ORDER_SETTLEMENT_WALLET_REFERENCE_TYPE (the Wallet-side reference for
/// the same order) so the two ledgers' entries are independently
/// idempotent.
export const COMMISSION_AUTOMATIC_DEDUCTION_REFERENCE_TYPE = 'order_settlement_deduction';
