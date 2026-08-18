-- Ride fares out of code and into the database, plus named surcharge zones.
--
-- RIDE_FARE_RATES was a hardcoded constant that still carried its own warning
-- that it was "not a founder-approved fare table". Changing a price meant a
-- code change and a deploy, and there was no way to charge more for an airport
-- run at all.

CREATE TYPE "RideSurchargeType" AS ENUM ('FLAT', 'MULTIPLIER');
CREATE TYPE "RideSurchargeTrigger" AS ENUM ('PICKUP', 'DROPOFF', 'EITHER');

CREATE TABLE "ride_fare_rates" (
  "ride_type"       "RideType"     NOT NULL,
  "base_fare"       DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "per_km_rate"     DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "per_minute_rate" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "minimum_fare"    DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "updated_by"      UUID,
  "updated_at"      TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at"      TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ride_fare_rates_pkey" PRIMARY KEY ("ride_type")
);

-- Seeded from the constants that were in force at the time of this migration
-- (apps/backend/src/rides/ride.constants.ts), so the fare a passenger is quoted
-- the minute after this deploys is identical to the minute before. The ₦1,500
-- minimum is the founder-locked figure from 2026-08-16, applied to every type
-- exactly as the single global constant did.
INSERT INTO "ride_fare_rates" ("ride_type", "base_fare", "per_km_rate", "per_minute_rate", "minimum_fare")
VALUES
  ('ECONOMY',  300, 120, 20, 1500),
  ('COMFORT',  450, 160, 25, 1500),
  ('XL',       600, 200, 30, 1500),
  ('TRICYCLE', 150,  80, 10, 1500)
ON CONFLICT ("ride_type") DO NOTHING;

CREATE TABLE "ride_surcharge_zones" (
  "id"             UUID                   NOT NULL,
  "name"           VARCHAR(120)           NOT NULL,
  "latitude"       DECIMAL(10, 7)         NOT NULL,
  "longitude"      DECIMAL(10, 7)         NOT NULL,
  "radius_meters"  INTEGER                NOT NULL,
  "surcharge_type" "RideSurchargeType"    NOT NULL,
  "amount"         DECIMAL(12, 4)         NOT NULL,
  "applies_to"     "RideSurchargeTrigger" NOT NULL DEFAULT 'EITHER',
  "active"         BOOLEAN                NOT NULL DEFAULT true,
  "updated_by"     UUID,
  "updated_at"     TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at"     TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ride_surcharge_zones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ride_surcharge_zones_active_idx" ON "ride_surcharge_zones" ("active");

-- No zones are seeded. Where an airport boundary sits and what it should cost
-- are commercial decisions; inventing a radius and a price here would put a
-- number on a customer's receipt that nobody chose. The console creates them.

ALTER TABLE "rides"
  ADD COLUMN "surcharge_amount"    DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "surcharge_zone_id"   UUID,
  ADD COLUMN "surcharge_zone_name" VARCHAR(120);

-- SetNull, not Cascade: removing a zone must never remove the rides it priced.
ALTER TABLE "rides"
  ADD CONSTRAINT "rides_surcharge_zone_id_fkey"
  FOREIGN KEY ("surcharge_zone_id") REFERENCES "ride_surcharge_zones" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
