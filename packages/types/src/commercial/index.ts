/// DPX-COMMERCIAL-001 — the shared commercial engine (commission credit
/// accounts, admin-configurable credit limits) spanning both Marketplace
/// merchants and Ride/Delivery drivers/riders. Slice 1 only: schema +
/// settings + admin-manual payment recording. Real accrual call sites
/// (Marketplace "Pay to Merchant", Cash on Delivery, Ride cash) land in
/// later slices — see docs/DPX-COMMERCIAL-001-REVENUE-SETTLEMENT-CREDIT-POLICY.md.

/// Mirrors WalletOwnerType's MERCHANT/DRIVER/RIDER split (Rider =
/// Marketplace delivery courier, Driver = Ride-hailing driver — already
/// distinct identities/wallets in this codebase).
/**
 * DPX-FLEET added `FLEET` on 2026-08-30. A fleet owner is DrippleX's
 * commercial counterparty in the same way a merchant is: it accrues, owes and
 * settles through the same account, so it belongs in the same union rather
 * than a parallel one.
 */
export type CommissionOwnerType = 'MERCHANT' | 'DRIVER' | 'RIDER' | 'FLEET';

export type CommissionEntryType = 'ACCRUAL' | 'PAYMENT' | 'ADJUSTMENT';

export interface CommissionAccountDto {
  id: string;
  ownerType: CommissionOwnerType;
  ownerId: string;
  outstandingBalance: number;
  /** The ceiling actually in force — the negotiated limit when one exists,
   * otherwise the owner-type default. */
  creditLimit: number;
  /** A limit agreed with this partner individually. Null means none has been
   * agreed and the owner-type default applies. */
  negotiatedCreditLimit: number | null;
  negotiatedAt: string | null;
  negotiationNote: string | null;
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

/**
 * Everything DrippleX has with one merchant, driver or rider, on one screen.
 *
 * The money existed in two places that never met: a Wallet (what DrippleX
 * holds *for* the partner) and a CommissionAccount (what the partner owes
 * DrippleX). An operator could read either, but nothing put them side by side,
 * so "what is our position with this merchant?" had no answer short of two
 * lookups and mental arithmetic.
 *
 * Signs are from DrippleX's point of view: `walletAvailable` is a liability we
 * owe out, `commissionOutstanding` is an asset owed in, and `netPosition` is
 * what would change hands if the relationship were settled today — positive
 * means we pay them, negative means they still owe us after their wallet is
 * emptied.
 */
export interface PartnerFinancialPositionDto {
  ownerType: CommissionOwnerType;
  ownerId: string;
  name: string | null;
  email: string | null;
  phone: string | null;

  /** Money DrippleX holds for this partner. Theirs, not ours. */
  walletAvailable: number;
  walletPending: number;

  /** Money this partner owes DrippleX. */
  commissionOutstanding: number;
  commissionCreditLimit: number;
  /** Set when the limit above was agreed with this partner rather than
   * inherited from the owner-type default. */
  negotiatedCreditLimit: number | null;
  negotiatedAt: string | null;
  negotiationNote: string | null;
  blocked: boolean;
  blockedAt: string | null;

  /** walletAvailable − commissionOutstanding. */
  netPosition: number;

  /** Since the relationship began. Accrued minus paid should equal the
   * outstanding balance; when it does not, something has been adjusted
   * outside the ledger and an operator needs to see that. */
  lifetimeCommissionAccrued: number;
  lifetimeCommissionPaid: number;
  lifetimeWalletCredited: number;
  lifetimeWalletDebited: number;

  /** Withdrawals requested and not yet settled — money already spoken for. */
  pendingWithdrawalAmount: number;
  pendingWithdrawalCount: number;
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

/** Record (or, with a null limit, clear) the credit limit agreed with one
 * partner. */
export interface NegotiateCreditLimitRequest {
  creditLimit: number | null;
  note?: string;
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
  | 'commission_account.unblocked'
  | 'commission_account.credit_limit_negotiated';

export const COMMERCIAL_AUDIT_ACTIONS = {
  CREDIT_SETTING_UPDATED: 'commercial_credit_setting.updated',
  COMMISSION_SETTING_UPDATED: 'platform_commission_setting.updated',
  PAYMENT_RECORDED: 'commission_account.payment_recorded',
  BLOCKED: 'commission_account.blocked',
  UNBLOCKED: 'commission_account.unblocked',
  CREDIT_LIMIT_NEGOTIATED: 'commission_account.credit_limit_negotiated',
} as const;
