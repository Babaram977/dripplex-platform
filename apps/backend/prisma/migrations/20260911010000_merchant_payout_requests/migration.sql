-- Let a merchant request a payout through the same queue as everyone else.
--
-- Merchants were the only earning persona with no way to ask for money. They
-- are paid by automatic settlement when an online order completes, which stays
-- exactly as it is — this adds the owner-initiated request alongside it, going
-- through the same Operations approval as a driver's or a rider's.
--
-- The obstacle was the destination, not the flow. withdrawal_requests points at
-- customer_bank_accounts, while a merchant's verified settlement account lives
-- in bank_accounts. Rather than a third payout pathway, or making merchants
-- link a second bank account they would have to keep in step with the first,
-- the request now carries whichever destination that persona already has, and
-- exactly one of the two.
ALTER TABLE "withdrawal_requests" ALTER COLUMN "bank_account_id" DROP NOT NULL;

ALTER TABLE "withdrawal_requests"
  ADD COLUMN IF NOT EXISTS "merchant_bank_account_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'withdrawal_requests_merchant_bank_account_id_fkey'
  ) THEN
    ALTER TABLE "withdrawal_requests"
      ADD CONSTRAINT "withdrawal_requests_merchant_bank_account_id_fkey"
      FOREIGN KEY ("merchant_bank_account_id") REFERENCES "bank_accounts"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Exactly one destination, enforced by the database rather than by remembering.
-- A row with neither is a payout with nowhere to go; a row with both is a
-- payout with two, and nothing downstream would know which one was meant.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'withdrawal_requests_one_destination_check'
  ) THEN
    ALTER TABLE "withdrawal_requests"
      ADD CONSTRAINT "withdrawal_requests_one_destination_check"
      CHECK (num_nonnulls("bank_account_id", "merchant_bank_account_id") = 1);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "withdrawal_requests_merchant_bank_account_id_idx"
  ON "withdrawal_requests"("merchant_bank_account_id");
