-- DPX-RIDER-006 — rider delivery earnings.
--
-- A completed delivery paid the rider nothing: the fee was collected and
-- attributed to no one. These columns freeze the split at settlement time
-- (rider earning + platform commission, both derived from delivery_fee), and
-- settled_at is the idempotency guard so a re-fired completion event can never
-- pay a rider twice.
ALTER TABLE "delivery_jobs"
  ADD COLUMN "rider_earning" DECIMAL(12,2),
  ADD COLUMN "platform_commission" DECIMAL(12,2),
  ADD COLUMN "settled_at" TIMESTAMP(3);
