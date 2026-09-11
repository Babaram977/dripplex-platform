-- DPX-MERCHANT-016 — the merchant's agreed rate, as it stood when a sale settled.
--
-- Founder/architecture decision 2026-09-11, locking the financial precedence
-- Campaign > Negotiated > Platform: "Preserve the negotiated rate as a
-- historical snapshot on financially settled transactions so changing a
-- merchant's agreement later cannot alter historical settlements."
--
-- `commission_rate` already snapshots what was charged, so no past settlement
-- can be re-priced. What it cannot answer is *why* that figure applied: when a
-- campaign set it, the row carries no trace of the merchant's standing
-- agreement, and when no campaign ran it cannot tell an agreed rate from a
-- platform default that happened to match. This column closes that gap.
--
-- Deliberately NOT backfilled. NULL means "no agreement was in force", which is
-- true of every row written before this feature existed — merchants had no
-- negotiated rate to be in force. Backfilling today's agreement onto a sale
-- that settled before it was made would invent history, which is the precise
-- failure this column exists to prevent.
ALTER TABLE "order_settlements"
  ADD COLUMN "negotiated_rate" DECIMAL(5,4);
