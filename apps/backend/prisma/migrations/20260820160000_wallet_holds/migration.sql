-- Wallet holds: money set aside without being taken.
--
-- Purely additive. Three new enum values; no table or column changes at all
-- (`pending_balance` has existed since the wallet was created and was simply
-- never written to). Every existing wallet keeps a zero pending balance and
-- behaves exactly as before.

ALTER TYPE "WalletTransactionType" ADD VALUE IF NOT EXISTS 'HOLD';
ALTER TYPE "WalletTransactionType" ADD VALUE IF NOT EXISTS 'HOLD_COMMIT';
ALTER TYPE "WalletTransactionType" ADD VALUE IF NOT EXISTS 'HOLD_RELEASE';
