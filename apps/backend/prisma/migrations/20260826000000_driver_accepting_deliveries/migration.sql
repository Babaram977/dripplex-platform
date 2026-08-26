-- Drivers may opt in to merchant delivery jobs (founder decision, 2026-08-25).
--
-- Separate from `accepting_rides` and defaulting to false, so the column is
-- inert on every existing row: no driver starts receiving deliveries because
-- of this migration. A ride fare is worth more than a parcel drop, and a
-- driver online for rides must not be pulled onto one they did not ask for.
ALTER TABLE "driver_availability"
  ADD COLUMN "accepting_deliveries" BOOLEAN NOT NULL DEFAULT false;

-- Delivery dispatch scans for opted-in, online drivers and ranks by distance,
-- mirroring the (online, accepting_rides, vehicle_type) index the ride side
-- already has. Without this the fallback pool is a sequential scan of every
-- driver on the platform on every unassigned job, every 30 seconds.
CREATE INDEX "driver_availability_online_accepting_deliveries_idx"
  ON "driver_availability" ("online", "accepting_deliveries");

-- Which pool the assignee came from, recorded on the job.
--
-- Not re-derived from the assignee's profiles at read time: settlement uses
-- it to choose the CommissionOwnerType a cash delivery accrues against, and a
-- courier who later also becomes a driver would otherwise retroactively
-- re-file every delivery they had ever made.
CREATE TYPE "DeliveryCourierType" AS ENUM ('RIDER', 'DRIVER');

ALTER TABLE "delivery_jobs"
  ADD COLUMN "courier_type" "DeliveryCourierType";

-- Every delivery that exists today was carried by a courier; there was no
-- other possibility before this migration. Backfilled so historical rows are
-- not indistinguishable from unassigned ones.
UPDATE "delivery_jobs" SET "courier_type" = 'RIDER' WHERE "rider_id" IS NOT NULL;
