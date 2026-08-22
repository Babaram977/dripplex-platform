-- DPX-HOTEL-003 — weekly hotel settlement, every Monday.
--
-- Founder decision 2026-08-22. Because a guest now pays THROUGH DrippleX,
-- DrippleX holds the money and owes each hotel its share. This is the record of
-- releasing it.
--
-- Additive: one table, one enum, one nullable column on bookings.

CREATE TYPE "BookingSettlementStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

CREATE TABLE "booking_settlements" (
  "id"                     UUID PRIMARY KEY,
  "business_id"            UUID NOT NULL,
  "week_starting"          DATE NOT NULL,
  "status"                 "BookingSettlementStatus" NOT NULL DEFAULT 'PENDING',
  "booking_count"          INTEGER NOT NULL,
  "gross_amount"           DECIMAL(12,2) NOT NULL,
  "commission_amount"      DECIMAL(12,2) NOT NULL,
  "net_amount"             DECIMAL(12,2) NOT NULL,
  "currency"               VARCHAR(3) NOT NULL DEFAULT 'NGN',
  "wallet_ledger_entry_id" UUID,
  "failure_reason"         VARCHAR(1000),
  "settled_at"             TIMESTAMP(3),
  "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"             TIMESTAMP(3) NOT NULL
);

-- One settlement row per hotel per week, as a fact of the schema rather than a
-- convention. A weekly run can fire more than once on the same Monday — a
-- restart, two instances, an operator retrying — and this makes the redundant
-- run bail out immediately instead of doing the work.
--
-- It is NOT what stops a hotel being paid twice; the conditional claim on
-- bookings.settlement_id below is. Verified by dropping this index and running
-- four concurrent settlements: the hotel was still paid exactly once.
CREATE UNIQUE INDEX "booking_settlements_business_id_week_starting_key"
  ON "booking_settlements"("business_id", "week_starting");
CREATE INDEX "booking_settlements_status_idx" ON "booking_settlements"("status");
CREATE INDEX "booking_settlements_week_starting_idx" ON "booking_settlements"("week_starting");

ALTER TABLE "booking_settlements"
  ADD CONSTRAINT "booking_settlements_amounts_consistent"
  CHECK ("gross_amount" >= 0 AND "commission_amount" >= 0 AND "net_amount" >= 0
         AND "net_amount" = "gross_amount" - "commission_amount");

-- Which settlement paid a booking. Set once, never cleared: a booking already
-- carrying a settlement id is never picked up by a later run.
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "settlement_id" UUID;
CREATE INDEX IF NOT EXISTS "bookings_settlement_id_idx" ON "bookings"("settlement_id");

-- Restrict, not Cascade: deleting a settlement must never quietly erase the
-- record of which bookings it paid for. Nothing deletes settlements today, and
-- this is what keeps that true by accident as well as on purpose.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_settlement_id_fkey"
  FOREIGN KEY ("settlement_id") REFERENCES "booking_settlements"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "booking_settlements_business_id_idx"
  ON "booking_settlements"("business_id");

-- Written out rather than inlined in the CREATE TABLE so the ON UPDATE clause
-- matches what Prisma's schema describes; an inline REFERENCES silently means
-- ON UPDATE NO ACTION, and the two drift apart forever after.
ALTER TABLE "booking_settlements"
  ADD CONSTRAINT "booking_settlements_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
