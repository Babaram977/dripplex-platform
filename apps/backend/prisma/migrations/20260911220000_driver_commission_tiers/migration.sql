-- DPX-TIER-001 — driver commission tiers, earned on completed trips and
-- sustained customer rating.
--
-- Nora's specification, 2026-09-11. Every threshold and percentage is
-- configuration rather than business logic: changing a rate or a qualification
-- bar must not require a deployment.
--
-- The rate a ride settles at is already snapshotted on the ride; this adds the
-- tier that produced it, so a driver who later drops to STANDARD cannot make a
-- GOLD ride look like it was ever charged at 10%.

DO $$ BEGIN
  CREATE TYPE "DriverTier" AS ENUM ('STANDARD', 'SILVER', 'GOLD', 'PLATINUM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "driver_tier_settings" (
  "id"                    UUID NOT NULL,
  "tier"                  "DriverTier" NOT NULL,
  "commission_rate"       DECIMAL(5, 4) NOT NULL,
  "min_completed_trips"   INTEGER NOT NULL,
  "min_rated_trips"       INTEGER NOT NULL,
  "min_average_rating"    DECIMAL(3, 2) NOT NULL,
  "max_cancellation_rate" DECIMAL(5, 4),
  "active"                BOOLEAN NOT NULL DEFAULT true,
  "updated_by"            UUID,
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3) NOT NULL,
  CONSTRAINT "driver_tier_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "driver_tier_settings_tier_key"
  ON "driver_tier_settings" ("tier");

ALTER TABLE "rides"
  ADD COLUMN IF NOT EXISTS "driver_tier" "DriverTier";

-- Nora's proposed opening figures. Seeded here rather than in application code
-- so the table is the source of truth from its first row onward, and Ops can
-- change any of it without a deployment. STANDARD matches the existing
-- platform rate exactly, so seeding this changes nothing for a driver who has
-- not yet earned a tier.
INSERT INTO "driver_tier_settings" (
  "id", "tier", "commission_rate", "min_completed_trips", "min_rated_trips",
  "min_average_rating", "active", "updated_at"
)
VALUES
  (gen_random_uuid(), 'STANDARD',  0.1000,   0,   0, 0.00, true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'SILVER',    0.0950, 100,  50, 4.60, true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'GOLD',      0.0900, 300, 100, 4.70, true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'PLATINUM',  0.0850, 600, 200, 4.80, true, CURRENT_TIMESTAMP)
ON CONFLICT ("tier") DO NOTHING;
