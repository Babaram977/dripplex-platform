-- DPX-LOYALTY-007 — whether a partner persona earns DX Points, and for what.
--
-- Nora's policy, 2026-09-11: drivers and riders earn only under an approved
-- programme, merchants only where a campaign permits, fleets only via explicit
-- incentive programmes.
--
-- Every row is seeded INACTIVE, which is not a cautious default so much as the
-- literal truth of the platform today: no partner earns DX Points at all. So
-- this migration changes nobody's balance. Switching a persona on is a decision
-- somebody makes and the audit trail records, rather than one they have to
-- remember to undo.
CREATE TYPE "LoyaltyEarnerPersona" AS ENUM ('DRIVER', 'RIDER', 'MERCHANT', 'FLEET_OWNER');

CREATE TABLE "loyalty_earning_programmes" (
  "id" UUID NOT NULL,
  "persona" "LoyaltyEarnerPersona" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "points_per_completed_job" INTEGER NOT NULL DEFAULT 0,
  "points_per_qualifying_review" INTEGER NOT NULL DEFAULT 0,
  "min_review_rating" INTEGER NOT NULL DEFAULT 4,
  "daily_points_cap" INTEGER,
  "updated_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "loyalty_earning_programmes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "loyalty_earning_programmes_persona_key"
  ON "loyalty_earning_programmes"("persona");

-- Opening values, all switched off. The point sizes are a starting proposal an
-- operator edits before switching anything on — they buy nothing while active
-- is false, and 200 points is ₦1, so a driver's 20 points a trip is 10 kobo.
INSERT INTO "loyalty_earning_programmes" (
  "id", "persona", "active", "points_per_completed_job",
  "points_per_qualifying_review", "min_review_rating", "daily_points_cap", "updated_at"
) VALUES
  (gen_random_uuid(), 'DRIVER',      false, 20, 50, 4, 2000, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'RIDER',       false, 20, 50, 4, 2000, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'MERCHANT',    false, 10,  0, 4, 5000, CURRENT_TIMESTAMP),
  -- A fleet owner earns nothing per job by default: what a fleet is given is an
  -- explicit incentive, not a per-trip drip, and nobody has specified one.
  (gen_random_uuid(), 'FLEET_OWNER', false,  0,  0, 4, NULL, CURRENT_TIMESTAMP)
ON CONFLICT ("persona") DO NOTHING;
