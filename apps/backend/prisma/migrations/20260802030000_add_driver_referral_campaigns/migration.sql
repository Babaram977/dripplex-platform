-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'DRIVER_REFERRAL_PASSENGER_REGISTERED';
ALTER TYPE "NotificationType" ADD VALUE 'DRIVER_REFERRAL_PASSENGER_QUALIFIED';
ALTER TYPE "NotificationType" ADD VALUE 'DRIVER_REFERRAL_TIER_SILVER';
ALTER TYPE "NotificationType" ADD VALUE 'DRIVER_REFERRAL_TIER_GOLD';
ALTER TYPE "NotificationType" ADD VALUE 'DRIVER_REFERRAL_REWARD_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'DRIVER_REFERRAL_REWARD_PAID';

-- CreateEnum
CREATE TYPE "ReferralCampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "ReferralCampaignTier" AS ENUM ('NONE', 'SILVER', 'GOLD');

-- CreateEnum
CREATE TYPE "PassengerReferralStatus" AS ENUM ('REGISTERED', 'QUALIFIED');

-- CreateEnum
CREATE TYPE "DriverReferralRewardStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAID');

-- CreateEnum
CREATE TYPE "ReferralFraudCheckType" AS ENUM ('SELF_REFERRAL', 'DUPLICATE_REFEREE', 'MANUAL_FLAG');

-- CreateEnum
CREATE TYPE "ReferralFraudCheckStatus" AS ENUM ('CLEARED', 'FLAGGED', 'REJECTED');

-- CreateTable
CREATE TABLE "referral_campaigns" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "status" "ReferralCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "required_trips_per_passenger" INTEGER NOT NULL DEFAULT 5,
    "silver_threshold" INTEGER NOT NULL DEFAULT 50,
    "silver_reward_amount" DECIMAL(12,2) NOT NULL DEFAULT 40000,
    "gold_threshold" INTEGER NOT NULL DEFAULT 100,
    "gold_reward_amount" DECIMAL(12,2) NOT NULL DEFAULT 100000,
    "gold_qualification_rate" DECIMAL(4,3) NOT NULL DEFAULT 0.750,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_referrals" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_statistics" (
    "id" UUID NOT NULL,
    "driver_referral_id" UUID NOT NULL,
    "invites_sent" INTEGER NOT NULL DEFAULT 0,
    "registered_count" INTEGER NOT NULL DEFAULT 0,
    "qualified_count" INTEGER NOT NULL DEFAULT 0,
    "completed_trips" INTEGER NOT NULL DEFAULT 0,
    "current_tier" "ReferralCampaignTier" NOT NULL DEFAULT 'NONE',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passenger_referrals" (
    "id" UUID NOT NULL,
    "driver_referral_id" UUID NOT NULL,
    "referee_user_id" UUID NOT NULL,
    "status" "PassengerReferralStatus" NOT NULL DEFAULT 'REGISTERED',
    "completed_trips" INTEGER NOT NULL DEFAULT 0,
    "qualified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "passenger_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_rewards" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "tier" "ReferralCampaignTier" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "qualified_passenger_count" INTEGER NOT NULL,
    "status" "DriverReferralRewardStatus" NOT NULL DEFAULT 'PENDING',
    "approved_at" TIMESTAMP(3),
    "approved_by" UUID,
    "rejected_at" TIMESTAMP(3),
    "rejected_by" UUID,
    "rejection_reason" VARCHAR(500),
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_fraud_checks" (
    "id" UUID NOT NULL,
    "passenger_referral_id" UUID,
    "driver_referral_id" UUID,
    "check_type" "ReferralFraudCheckType" NOT NULL,
    "status" "ReferralFraudCheckStatus" NOT NULL DEFAULT 'CLEARED',
    "details" VARCHAR(1000),
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_fraud_checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "referral_campaigns_period_start_period_end_key" ON "referral_campaigns"("period_start", "period_end");

-- CreateIndex
CREATE INDEX "referral_campaigns_status_idx" ON "referral_campaigns"("status");

-- CreateIndex
CREATE UNIQUE INDEX "driver_referrals_code_key" ON "driver_referrals"("code");

-- CreateIndex
CREATE INDEX "driver_referrals_code_idx" ON "driver_referrals"("code");

-- CreateIndex
CREATE INDEX "driver_referrals_driver_id_idx" ON "driver_referrals"("driver_id");

-- CreateIndex
CREATE UNIQUE INDEX "driver_referrals_campaign_id_driver_id_key" ON "driver_referrals"("campaign_id", "driver_id");

-- CreateIndex
CREATE UNIQUE INDEX "referral_statistics_driver_referral_id_key" ON "referral_statistics"("driver_referral_id");

-- CreateIndex
CREATE UNIQUE INDEX "passenger_referrals_referee_user_id_key" ON "passenger_referrals"("referee_user_id");

-- CreateIndex
CREATE INDEX "passenger_referrals_driver_referral_id_idx" ON "passenger_referrals"("driver_referral_id");

-- CreateIndex
CREATE INDEX "passenger_referrals_status_idx" ON "passenger_referrals"("status");

-- CreateIndex
CREATE INDEX "referral_rewards_status_idx" ON "referral_rewards"("status");

-- CreateIndex
CREATE UNIQUE INDEX "referral_rewards_campaign_id_driver_id_key" ON "referral_rewards"("campaign_id", "driver_id");

-- CreateIndex
CREATE INDEX "referral_fraud_checks_status_idx" ON "referral_fraud_checks"("status");

-- CreateIndex
CREATE INDEX "referral_fraud_checks_passenger_referral_id_idx" ON "referral_fraud_checks"("passenger_referral_id");

-- AddForeignKey
ALTER TABLE "driver_referrals" ADD CONSTRAINT "driver_referrals_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "referral_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_referrals" ADD CONSTRAINT "driver_referrals_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_statistics" ADD CONSTRAINT "referral_statistics_driver_referral_id_fkey" FOREIGN KEY ("driver_referral_id") REFERENCES "driver_referrals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passenger_referrals" ADD CONSTRAINT "passenger_referrals_driver_referral_id_fkey" FOREIGN KEY ("driver_referral_id") REFERENCES "driver_referrals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passenger_referrals" ADD CONSTRAINT "passenger_referrals_referee_user_id_fkey" FOREIGN KEY ("referee_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "referral_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_fraud_checks" ADD CONSTRAINT "referral_fraud_checks_passenger_referral_id_fkey" FOREIGN KEY ("passenger_referral_id") REFERENCES "passenger_referrals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
