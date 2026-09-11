-- DPX-REFERRAL-003 — referral lifecycle, qualification programmes and anti-abuse.
--
-- Three states could not express the two facts that matter for money: that a
-- referral has earned its reward but is not yet payable, and that a reward
-- which was paid has been taken back.

-- 1. The lifecycle.
--
-- REWARDED becomes PAID rather than being kept alongside it. Two names for
-- "the money moved" is a trap: every query that forgets one of them is wrong,
-- and the one that decides whether to pay again is wrong about money. The
-- rename is a rewording of an existing fact, so nothing is re-paid or unpaid.
ALTER TYPE "ReferralRedemptionStatus" RENAME TO "ReferralRedemptionStatus_old";

CREATE TYPE "ReferralRedemptionStatus" AS ENUM (
  'PENDING',
  'QUALIFIED',
  'APPROVED',
  'PAID',
  'REJECTED',
  'REVERSED',
  'EXPIRED'
);

ALTER TABLE "referral_redemptions" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "referral_redemptions"
  ALTER COLUMN "status" TYPE "ReferralRedemptionStatus"
  USING (
    CASE WHEN "status"::text = 'REWARDED' THEN 'PAID' ELSE "status"::text END
  )::"ReferralRedemptionStatus";

ALTER TABLE "referral_redemptions"
  ALTER COLUMN "status" SET DEFAULT 'PENDING'::"ReferralRedemptionStatus";

DROP TYPE "ReferralRedemptionStatus_old";

-- 2. Why a referral was refused, and what the referee signed up as.
CREATE TYPE "ReferralRejectionReason" AS ENUM (
  'SELF_REFERRAL',
  'RECIPROCAL_RELATIONSHIP',
  'SHARED_DEVICE',
  'SHARED_PHONE',
  'SHARED_EMAIL',
  'SHARED_IDENTITY',
  'OPERATIONS_DECISION'
);

CREATE TYPE "ReferralRefereeType" AS ENUM ('CUSTOMER', 'MERCHANT', 'FLEET');

-- 3. What DrippleX pays, per kind of referee. Rows rather than constants, so
--    an operator changes any of it without a deployment.
CREATE TABLE "referral_programmes" (
  "id" UUID NOT NULL,
  "referee_type" "ReferralRefereeType" NOT NULL,
  "referrer_reward_amount" DECIMAL(12, 2) NOT NULL DEFAULT 350,
  "referee_reward_amount" DECIMAL(12, 2) NOT NULL DEFAULT 350,
  "hold_days" INTEGER NOT NULL DEFAULT 7,
  "qualification_window_days" INTEGER NOT NULL DEFAULT 90,
  "require_kyc_verified" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "updated_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "referral_programmes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "referral_programmes_referee_type_key"
  ON "referral_programmes"("referee_type");

-- The opening programmes, exactly as specified 2026-09-11.
--
-- ₦350 each way for a customer or a merchant; ₦2,500 to the referrer for a
-- fleet and nothing to the fleet itself, because a fleet is signed up by its
-- owner as a business rather than tempted in by a welcome bonus. A referee
-- amount of zero means no credit is attempted at all.
--
-- require_kyc_verified is false everywhere. DrippleX pays a customer referral
-- today on the referred customer's first completed ride with no verification
-- gate; switching one on here would stop paying referrals that are earned under
-- the rule in force. It is an Operations decision, recorded in this row.
INSERT INTO "referral_programmes" (
  "id", "referee_type", "referrer_reward_amount", "referee_reward_amount",
  "hold_days", "qualification_window_days", "require_kyc_verified", "active",
  "updated_at"
) VALUES
  (gen_random_uuid(), 'CUSTOMER', 350,  350, 7, 90,  false, true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'MERCHANT', 350,  350, 7, 180, false, true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'FLEET',    2500,   0, 7, 180, false, true, CURRENT_TIMESTAMP)
ON CONFLICT ("referee_type") DO NOTHING;

-- 4. The redemption row learns what it was priced at, when each step happened,
--    and why it was refused.
ALTER TABLE "referral_redemptions"
  ADD COLUMN "referee_type" "ReferralRefereeType" NOT NULL DEFAULT 'CUSTOMER',
  ADD COLUMN "programme_id" UUID,
  ADD COLUMN "referrer_reward_amount" DECIMAL(12, 2),
  ADD COLUMN "referee_reward_amount" DECIMAL(12, 2),
  ADD COLUMN "qualified_at" TIMESTAMP(3),
  ADD COLUMN "approved_at" TIMESTAMP(3),
  ADD COLUMN "rejected_at" TIMESTAMP(3),
  ADD COLUMN "reversed_at" TIMESTAMP(3),
  ADD COLUMN "rejection_reason" "ReferralRejectionReason",
  -- A signal that fired but did not refuse. Two accounts on one handset is
  -- routine here; two accounts on one identity document is not. The weak signal
  -- flags for review during the hold rather than rejecting in bulk.
  ADD COLUMN "flagged_reason" "ReferralRejectionReason",
  ADD COLUMN "review_note" VARCHAR(500),
  ADD COLUMN "reviewed_by" UUID,
  ADD COLUMN "expires_at" TIMESTAMP(3);

-- Rows that were already paid have their qualification and approval implied by
-- the payment: they qualified and were approved under the rule in force at the
-- time, which had no hold. Backfilling those two timestamps from rewarded_at
-- keeps "a paid row has a full history" true for every row rather than only for
-- rows created after today.
UPDATE "referral_redemptions"
   SET "qualified_at" = "rewarded_at",
       "approved_at" = "rewarded_at"
 WHERE "rewarded_at" IS NOT NULL;

ALTER TABLE "referral_redemptions"
  ADD CONSTRAINT "referral_redemptions_programme_id_fkey"
  FOREIGN KEY ("programme_id") REFERENCES "referral_programmes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "referral_redemptions_status_expires_at_idx"
  ON "referral_redemptions"("status", "expires_at");

CREATE INDEX "referral_redemptions_status_qualified_at_idx"
  ON "referral_redemptions"("status", "qualified_at");
