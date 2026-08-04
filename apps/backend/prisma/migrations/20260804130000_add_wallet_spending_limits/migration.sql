-- Wallet Slice 5: customer-configurable spending limits (Wallet Settings)
ALTER TABLE "wallets"
  ADD COLUMN "daily_limit" DECIMAL(14,2),
  ADD COLUMN "single_transaction_limit" DECIMAL(14,2);
