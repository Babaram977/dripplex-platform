-- DPX-LOYALTY-006 — the DX Points ledger becomes auditable by state.
--
-- Before this the only thing distinguishing one line from another was the sign
-- of `points` and a free-text `reference_type`, so every question an auditor
-- actually asks — how much was given away as bonuses, how much was clawed back,
-- how much did support hand out by hand — could only be answered by
-- pattern-matching strings.
CREATE TYPE "LoyaltyLedgerEntryType" AS ENUM (
  'EARNED',
  'BONUS',
  'REDEEMED',
  'EXPIRED',
  'REVERSED',
  'ADJUSTED'
);

ALTER TABLE "loyalty_ledger_entries"
  ADD COLUMN "type" "LoyaltyLedgerEntryType" NOT NULL DEFAULT 'EARNED';

-- Classify the rows that predate the column from what each one actually is,
-- rather than leaving every historical line claiming to be EARNED. The sign is
-- the primary evidence and the reference type refines it; both are already on
-- the row, so nothing here is a guess.
UPDATE "loyalty_ledger_entries"
   SET "type" = CASE
     -- Milestone achievements are given, not earned.
     WHEN "points" > 0 AND "reference_type" = 'ACHIEVEMENT' THEN 'BONUS'
     WHEN "points" > 0 THEN 'EARNED'
     WHEN "reference_type" = 'POINT_EXPIRATION' THEN 'EXPIRED'
     -- Every other negative line is the holder spending: a wallet cash-out, a
     -- counter redemption, or a reward from the catalogue.
     ELSE 'REDEEMED'
   END::"LoyaltyLedgerEntryType";

CREATE INDEX "loyalty_ledger_entries_type_created_at_idx"
  ON "loyalty_ledger_entries"("type", "created_at");
