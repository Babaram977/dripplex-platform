-- DPX-PROMO-REF-001 — the campaign x promoter x private-token layer.
--
-- Additive only. No column is dropped, no type narrowed, no existing row
-- rewritten, so a rollback is a DROP of what this adds rather than a restore.
--
-- What this does NOT do, deliberately:
--
--   * It does not touch `referral_redemptions.referee_user_id`'s UNIQUE. That
--     constraint is what makes a customer acquirable once, platform-wide, and
--     widening it to (referee_user_id, campaign_promoter_id) is exactly the
--     campaign-stacking bug the founder ruled against. It is the tempting edit.
--   * It does not add members to "ReferralOwnerType". That enum decides which
--     wallet a reward is paid into, and every participant class here already
--     routes to a wallet that exists — an influencer's reward reaches the
--     personal wallet they withdraw from, the same route a fleet owner's
--     referral reward already takes.
--   * It creates nothing for the universal 20% acquisition discount. That is a
--     platform-wide `promotions` row plus a rule in the existing JSON `rules`
--     column, and needs no schema at all.
--
-- ON DELETE RESTRICT on all three foreign keys is a deliberate divergence from
-- `driver_referrals`, which cascades from its campaign. Cascading suits rows
-- derived from a monthly programme; here it would delete the promoter row that
-- reward history points at. Both parents are soft-deleted in practice —
-- `promotions.deleted_at` and AccountDeletionService's `users.deleted_at` — so
-- RESTRICT changes nothing today and makes a future hard delete fail loudly
-- rather than quietly erase who was paid for what.


-- CreateEnum
CREATE TYPE "CampaignParticipantType" AS ENUM ('CUSTOMER', 'RIDER', 'DRIVER', 'PIONEER_DRIVER', 'INFLUENCER', 'CREATOR', 'AMBASSADOR');

-- CreateEnum
CREATE TYPE "CampaignPromoterStatus" AS ENUM ('ACTIVE', 'REMOVED');

-- AlterTable
ALTER TABLE "referral_redemptions" ADD COLUMN     "campaign_promoter_id" UUID,
ADD COLUMN     "points_per_naira_at_grant" INTEGER,
ADD COLUMN     "referrer_reward_points" INTEGER;

-- CreateTable
CREATE TABLE "campaign_promoters" (
    "id" UUID NOT NULL,
    "promotion_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "participant_type" "CampaignParticipantType" NOT NULL,
    "token" VARCHAR(32) NOT NULL,
    "reward_amount" DECIMAL(12,2),
    "reward_points" INTEGER,
    "status" "CampaignPromoterStatus" NOT NULL DEFAULT 'ACTIVE',
    "added_by" UUID,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_by" UUID,
    "removed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_promoters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "campaign_promoters_token_key" ON "campaign_promoters"("token");

-- CreateIndex
CREATE INDEX "campaign_promoters_promotion_id_status_idx" ON "campaign_promoters"("promotion_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_promoters_promotion_id_user_id_key" ON "campaign_promoters"("promotion_id", "user_id");

-- CreateIndex
CREATE INDEX "referral_redemptions_campaign_promoter_id_idx" ON "referral_redemptions"("campaign_promoter_id");

-- CreateIndex
CREATE INDEX "referral_redemptions_campaign_promoter_id_status_idx" ON "referral_redemptions"("campaign_promoter_id", "status");

-- AddForeignKey
ALTER TABLE "campaign_promoters" ADD CONSTRAINT "campaign_promoters_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_promoters" ADD CONSTRAINT "campaign_promoters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_redemptions" ADD CONSTRAINT "referral_redemptions_campaign_promoter_id_fkey" FOREIGN KEY ("campaign_promoter_id") REFERENCES "campaign_promoters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- A promoter is paid in naira or in DX Points, never both and never neither.
--
-- Prisma cannot express "exactly one of these two columns", so it is a CHECK
-- constraint rather than a convention somebody remembers. Without it a row with
-- both set is a reward with two prices and no rule for which one pays, and a row
-- with neither is a promoter who earns nothing while looking configured.
--
-- Points are converted at `loyalty_settings.points_per_naira` (100 since the
-- founder ruling of 2026-09-12) and the rate in force is snapshotted onto the
-- redemption at qualification, so re-pricing never rewrites an earned reward.
ALTER TABLE "campaign_promoters"
  ADD CONSTRAINT "campaign_promoters_reward_exactly_one"
  CHECK (("reward_amount" IS NOT NULL) <> ("reward_points" IS NOT NULL));
