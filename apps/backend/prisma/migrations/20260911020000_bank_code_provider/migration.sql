-- Record which provider each stored bank code belongs to.
--
-- Bank codes are provider-specific. Paystack calls Guaranty Trust "058";
-- Flutterwave publishes its own list with its own codes, and sending one
-- provider's code to the other either fails outright or — the case that
-- actually matters — names a different institution and pays a stranger.
--
-- Every code stored so far came from Paystack, because the Paystack resolver
-- was the only implementation of BankAccountResolver that existed, so
-- 'PAYSTACK' is the honest default for existing rows rather than a guess.
--
-- fleet_bank_accounts already carries a `provider` column for this, so it is
-- left alone.
ALTER TABLE "customer_bank_accounts"
  ADD COLUMN IF NOT EXISTS "bank_code_provider" VARCHAR(32) NOT NULL DEFAULT 'PAYSTACK';

ALTER TABLE "bank_accounts"
  ADD COLUMN IF NOT EXISTS "bank_code_provider" VARCHAR(32) NOT NULL DEFAULT 'PAYSTACK';
