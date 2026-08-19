/// DPX-COMMERCIAL-001 — the shared commercial engine (commission credit
/// accounts, admin-configurable credit limits) spanning both Marketplace
/// merchants and Ride/Delivery drivers/riders. Slice 1 only: schema +
/// settings + admin-manual payment recording. Real accrual call sites
/// (Marketplace "Pay to Merchant", Cash on Delivery, Ride cash) land in
/// later slices — see docs/DPX-COMMERCIAL-001-REVENUE-SETTLEMENT-CREDIT-POLICY.md.

/// Mirrors WalletOwnerType's MERCHANT/DRIVER/RIDER split (Rider =
/// Marketplace delivery courier, Driver = Ride-hailing driver — already
/// distinct identities/wallets in this codebase).
export type CommissionOwnerType = 'MERCHANT' | 'DRIVER' | 'RIDER';

export type CommissionEntryType = 'ACCRUAL' | 'PAYMENT' | 'ADJUSTMENT';

export interface CommissionAccountDto {
  id: string;
  ownerType: CommissionOwnerType;
  ownerId: string;
  outstandingBalance: number;
  creditLimit: number;
  blocked: boolean;
  blockedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * A commission account plus who it belongs to — the row of the Ops Console's
 * commissions desk.
 *
 * The account endpoints were keyed by (ownerType, ownerId) only, so an
 * operator could read an account only if they already knew whose it was. A
 * merchant blocked from taking orders was therefore invisible to Ops while
 * their customers saw "blocked due to an outstanding commission balance".
 */
export interface AdminCommissionAccountDto extends CommissionAccountDto {
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
}

export interface CommissionLedgerEntryDto {
  id: string;
  accountId: string;
  type: CommissionEntryType;
  amount: number;
  balanceAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  description: string | null;
  createdAt: string;
}

export interface CommercialCreditSettingDto {
  id: string;
  ownerType: CommissionOwnerType;
  creditLimit: number;
  updatedBy: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface UpdateCommercialCreditSettingRequest {
  ownerType: CommissionOwnerType;
  creditLimit: number;
}

/// DPX-LAUNCH — the Ops-configurable platform (ride) commission rate.
export interface PlatformCommissionSettingDto {
  id: string;
  /// Decimal fraction, e.g. 0.1 = 10%.
  commissionRate: number;
  updatedBy: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface UpdatePlatformCommissionSettingRequest {
  /// Decimal fraction in [0, 1], e.g. 0.1 = 10%.
  commissionRate: number;
}

export interface RecordCommissionPaymentRequest {
  amount: number;
  description?: string;
}

export type CommercialAuditAction =
  | 'commercial_credit_setting.updated'
  | 'platform_commission_setting.updated'
  | 'commission_account.payment_recorded'
  | 'commission_account.blocked'
  | 'commission_account.unblocked';

export const COMMERCIAL_AUDIT_ACTIONS = {
  CREDIT_SETTING_UPDATED: 'commercial_credit_setting.updated',
  COMMISSION_SETTING_UPDATED: 'platform_commission_setting.updated',
  PAYMENT_RECORDED: 'commission_account.payment_recorded',
  BLOCKED: 'commission_account.blocked',
  UNBLOCKED: 'commission_account.unblocked',
} as const;
