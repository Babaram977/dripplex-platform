-- DPX-LOYALTY-002 — a holder's authorisation for a merchant to take some of
-- their DX points, in person.
--
-- The plaintext code is never stored: only a SHA-256 of it, matched when a
-- merchant presents the code. Same reasoning as OtpService.

CREATE TABLE IF NOT EXISTS "loyalty_redemption_codes" (
  "id"              UUID NOT NULL,
  "user_id"         UUID NOT NULL,
  "code_hash"       VARCHAR(64) NOT NULL,
  "points"          INTEGER NOT NULL,
  "amount"          DECIMAL(12, 2) NOT NULL,
  "expires_at"      TIMESTAMP(3) NOT NULL,
  "redeemed_at"     TIMESTAMP(3),
  "redeemed_by"     UUID,
  "cancelled_at"    TIMESTAMP(3),
  "ledger_entry_id" UUID,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loyalty_redemption_codes_pkey" PRIMARY KEY ("id")
);

-- A merchant redeems by presenting the code, which is hashed and looked up
-- here; the uniqueness is also what makes a generated code unambiguous.
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_redemption_codes_code_hash_key"
  ON "loyalty_redemption_codes" ("code_hash");
CREATE INDEX IF NOT EXISTS "loyalty_redemption_codes_user_id_created_at_idx"
  ON "loyalty_redemption_codes" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "loyalty_redemption_codes_redeemed_by_idx"
  ON "loyalty_redemption_codes" ("redeemed_by");
CREATE INDEX IF NOT EXISTS "loyalty_redemption_codes_expires_at_idx"
  ON "loyalty_redemption_codes" ("expires_at");

DO $$ BEGIN
  ALTER TABLE "loyalty_redemption_codes"
    ADD CONSTRAINT "loyalty_redemption_codes_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- The holder is told when a merchant takes their points. Its own type, not
-- GENERIC: preferences are keyed on (channel, type), and somebody spending a
-- balance is not something to be muted alongside offers.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LOYALTY_POINTS_SPENT';
