-- Phase 0 of DPX-WALLET-001: name enquiry on withdrawal destinations.
--
-- Additive and idempotent. Existing rows keep NULL, which reads as "saved
-- before verification existed" — deliberately NOT the same as "failed
-- verification". Nothing is invalidated and no existing withdrawal flow
-- changes; an operator can now see which destinations were confirmed with
-- the bank and which were only typed by the customer.
ALTER TABLE "customer_bank_accounts"
  ADD COLUMN IF NOT EXISTS "account_name_verified_at" TIMESTAMP(3);
