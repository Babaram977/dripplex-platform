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
  /// DPX-LAUNCH — editing the platform (ride) commission rate. Its own
  /// permission for the same reason as the credit-settings and merchant
  /// commission-rate splits: changing the commercial commission policy is a
  /// more sensitive action than routine admin work. Granted to
  /// administrator / super_administrator only (line ops staff do not hold it).
  ADMIN_COMMISSION_SETTINGS_MANAGE: 'admin:commercial:commission-settings:manage',
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
  COMMISSION_SETTING_UPDATED: 'platform_commission_setting.updated',
  PAYMENT_RECORDED: 'commission_account.payment_recorded',
  BLOCKED: 'commission_account.blocked',
  UNBLOCKED: 'commission_account.unblocked',
} as const;

/// DPX-LAUNCH — singleton row id for the Ops-configurable platform
/// commission setting (mirrors MERCHANT_COMMISSION_SETTING_ID). One fixed id
/// so getEffective() upserts a single authoritative row.
export const PLATFORM_COMMISSION_SETTING_ID = '00000000-0000-0000-0000-000000000003';

/// Seed-only fallback — read exactly once, the first time
/// PlatformCommissionSettingsService.getEffective() finds no row. Founder-locked
/// launch rate: 15%. Every subsequent read comes from the DB row, which an
/// administrator can change without a code change or deploy. Never referenced
/// directly by settlement once the row exists.
export const DEFAULT_PLATFORM_COMMISSION_RATE = 0.15;

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

/// DPX-D4 — distinct referenceType for reversing a CASH ride's driver
/// commission accrual on refund, paired with referenceId = ride.id. Kept
/// separate from COMMISSION_REFERENCE_TYPES.RIDE (the original accrual) so
/// the (accountId, referenceType, referenceId) uniqueness constraint keeps
/// the accrual and its reversal as two distinct ledger entries — exactly the
/// COMMISSION_ORDER_REVERSAL_REFERENCE_TYPE pattern, for the Ride domain.
export const COMMISSION_RIDE_REVERSAL_REFERENCE_TYPE = 'ride_commission_reversal';

/// DPX-D4 — referenceType for a recoverable driver liability recorded when a
/// ride refund's driver-earning clawback cannot be taken from the driver's
/// Wallet (already drawn down). An ADJUSTMENT/INCREASE on the driver's
/// CommissionAccount, paired with referenceId = ride.id, so the money owed
/// back to the platform is never silently lost; report-only reconciliation
/// surfaces it (D4 builds no auto-repair engine).
export const COMMISSION_RIDE_EARNING_DEBT_REFERENCE_TYPE = 'ride_earning_clawback_debt';
