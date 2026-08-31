export const WALLET_PERMISSIONS = {
  CUSTOMER_READ: 'customer:wallet:read',
  CUSTOMER_TRANSFER: 'customer:wallet:transfer',
  CUSTOMER_FUND: 'customer:wallet:fund',
  CUSTOMER_WITHDRAW: 'customer:wallet:withdraw',
  MERCHANT_READ: 'merchant:wallet:read',
  RIDER_READ: 'rider:wallet:read',
  DRIVER_READ: 'driver:wallet:read',
  /// A rider or driver asking for their earnings to be paid out. Separate
  /// permissions from the customer's so a partner payout can be withdrawn
  /// from a role without touching consumer wallets.
  RIDER_WITHDRAW: 'rider:wallet:withdraw',
  DRIVER_WITHDRAW: 'driver:wallet:withdraw',
  ADMIN_MANAGE: 'admin:wallet:manage',
  ADMIN_WITHDRAWALS_MANAGE: 'admin:wallet:withdrawals:manage',
} as const;

export const WALLET_AUDIT_ACTIONS = {
  CREDITED: 'wallet.credited',
  DEBITED: 'wallet.debited',
  TRANSFERRED: 'wallet.transferred',
  RECONCILED: 'wallet.reconciled',
  /** Money set aside without being taken, and the two ways that ends. */
  HELD: 'wallet.held',
  HOLD_COMMITTED: 'wallet.hold_committed',
  HOLD_RELEASED: 'wallet.hold_released',
  FUNDING_INITIATED: 'wallet.funding_initiated',
  FUNDING_SUCCEEDED: 'wallet.funding_succeeded',
  FUNDING_FAILED: 'wallet.funding_failed',
  WITHDRAWAL_REQUESTED: 'wallet.withdrawal_requested',
  WITHDRAWAL_COMPLETED: 'wallet.withdrawal_completed',
  WITHDRAWAL_FAILED: 'wallet.withdrawal_failed',
  BANK_ACCOUNT_ADDED: 'wallet.bank_account_added',
  BANK_ACCOUNT_REMOVED: 'wallet.bank_account_removed',
  PIN_SET: 'wallet.pin_set',
  PIN_CHANGED: 'wallet.pin_changed',
  LIMITS_UPDATED: 'wallet.limits_updated',
} as const;

export const WALLET_DEFAULT_CURRENCY = 'NGN';

/** WalletLedgerEntry.referenceType for a card top-up credit, paired with
 * referenceId = WalletTopUpTransaction.id. */
export const WALLET_TOPUP_REFERENCE_TYPE = 'wallet_topup';

/** WalletLedgerEntry.referenceType for a withdrawal debit/reversal, paired
 * with referenceId = WithdrawalRequest.id. Shared by both the initial debit
 * and a FAILED-outcome reversal credit, so both are idempotent under the
 * same (walletId, referenceType, referenceId) uniqueness constraint every
 * other wallet mutation already relies on. */
export const WALLET_WITHDRAWAL_REFERENCE_TYPE = 'wallet_withdrawal';

/** Reversal credit's referenceType, paired with the SAME referenceId
 * (WithdrawalRequest.id) as the original debit — referenceId is a UUID
 * column, so the reversal can't suffix the id; a distinct referenceType is
 * what keeps the two ledger entries distinct under WalletLedgerEntry's
 * (walletId, referenceType, referenceId) uniqueness constraint. */
export const WALLET_WITHDRAWAL_REVERSAL_REFERENCE_TYPE = 'wallet_withdrawal_reversal';

/**
 * WalletLedgerEntry.referenceType for a customer-to-customer wallet transfer,
 * paired with referenceId = a UUID minted per transfer.
 *
 * A transfer writes two ledger rows — the sender's DEBIT and the recipient's
 * CREDIT — and until this existed they were related only by having been written
 * inside the same database transaction and by metadata naming the other party.
 * Nothing named *the transfer itself*, so there was no id to quote on a receipt
 * or to search on when the two sides disagree about what happened.
 *
 * The same referenceId sits on both rows. That is safe under
 * WalletLedgerEntry's (walletId, referenceType, referenceId) uniqueness
 * constraint because the two rows belong to different wallets, and it is what
 * makes the two legs of one transfer findable together.
 */
export const WALLET_TRANSFER_REFERENCE_TYPE = 'wallet_transfer';

/// DPX-PAYOUT-002 — the slice of a payout request that goes to clearing what a
/// rider or driver owes DrippleX on cash jobs, rather than to their bank. Its
/// own reference type so the wallet ledger shows plainly where the money went:
/// a partner reading their statement sees "settled against commission owed",
/// not a payout that silently shrank.
export const WALLET_COMMISSION_SETTLEMENT_REFERENCE_TYPE = 'wallet_commission_settlement';

/** Minimum/maximum withdrawal amounts — same order of magnitude as Top Up's
 * bounds (apps/customer-web's TopUpScreen), not yet founder-approved as a
 * final policy. */
export const WALLET_WITHDRAWAL_MIN_AMOUNT = 100;
export const WALLET_WITHDRAWAL_MAX_AMOUNT = 1_000_000;

/** PIN is a fixed 4-digit numeric code, matching the OTP length convention
 * already used elsewhere in the platform (see auth OTP flows). */
export const WALLET_PIN_LENGTH = 4;

/**
 * Well-known fixed owner id for the single platform-owned wallet
 * (WalletOwnerType.PLATFORM). Wallet.ownerId is a UUID column, so this must
 * be a valid UUID even though it doesn't reference a real User row.
 */
export const PLATFORM_WALLET_OWNER_ID = '00000000-0000-0000-0000-000000000001';
