-- Dispatch needs to know how old a driver's *position* is, not how recently
-- the row changed. `updated_at` is bumped by any write — including the
-- active_ride_count increment at accept and the decrement at completion — so a
-- driver who had not moved in hours still looked freshly located.

ALTER TABLE "driver_availability"
  ADD COLUMN IF NOT EXISTS "location_updated_at" TIMESTAMP(3);

-- Backfill: for rows that already carry coordinates, `updated_at` is the best
-- evidence we have of when they were written. It can only over-state freshness
-- (never under-state it), and every online driver re-pings within seconds of
-- this deploy, so any over-statement corrects itself immediately. Rows with no
-- coordinates are left NULL — they have no location to be fresh about, and
-- dispatch already skips them.
UPDATE "driver_availability"
   SET "location_updated_at" = "updated_at"
 WHERE "latitude" IS NOT NULL
   AND "longitude" IS NOT NULL
   AND "location_updated_at" IS NULL;

CREATE INDEX IF NOT EXISTS "driver_availability_online_accepting_vehicle_location_idx"
  ON "driver_availability" ("online", "accepting_rides", "vehicle_type", "location_updated_at");
