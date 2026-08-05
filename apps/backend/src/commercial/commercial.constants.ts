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
