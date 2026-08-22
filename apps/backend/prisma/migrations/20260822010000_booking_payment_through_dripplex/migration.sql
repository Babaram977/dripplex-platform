-- Hotel booking: the payment model the founder set on 2026-08-22.
--
-- Anyone may apply for a reservation with no money at stake. Only once the
-- hotel accepts does the guest pay, through the DrippleX gateway, within 24
-- hours. A five-character PIN is issued on payment and is what the guest reads
-- out at the desk.
--
-- Supersedes the wallet-hold model (DPX-HOTEL-001 decision 8): no hold is
-- placed at any point now.
--
-- Additive. One new enum value, four new nullable columns, one index. Existing
-- rows keep working: any booking already CONFIRMED under the old model simply
-- has a null pin and null payment fields, which is the truth about it.

ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'AWAITING_PAYMENT' BEFORE 'CONFIRMED';

ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "pin" VARCHAR(8);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "payment_deadline" TIMESTAMP(3);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "payment_reference" VARCHAR(100);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMP(3);

-- One gateway payment can never be claimed by two bookings.
CREATE UNIQUE INDEX IF NOT EXISTS "bookings_payment_reference_key"
  ON "bookings"("payment_reference");

-- The payment sweep's query: accepted bookings whose 24 hours ran out.
CREATE INDEX IF NOT EXISTS "bookings_status_payment_deadline_idx"
  ON "bookings"("status", "payment_deadline");
