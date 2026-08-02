-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'REFERRAL_REDEEMED';
ALTER TYPE "NotificationType" ADD VALUE 'REFERRAL_REWARDED';

-- CreateEnum
CREATE TYPE "ReferralRedemptionStatus" AS ENUM ('PENDING', 'REWARDED', 'EXPIRED');

-- CreateTable
CREATE TABLE "referrals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_redemptions" (
    "id" UUID NOT NULL,
    "referral_id" UUID NOT NULL,
    "referee_user_id" UUID NOT NULL,
    "status" "ReferralRedemptionStatus" NOT NULL DEFAULT 'PENDING',
    "rewarded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "referrals_user_id_key" ON "referrals"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_code_key" ON "referrals"("code");

-- CreateIndex
CREATE INDEX "referrals_code_idx" ON "referrals"("code");

-- CreateIndex
CREATE UNIQUE INDEX "referral_redemptions_referee_user_id_key" ON "referral_redemptions"("referee_user_id");

-- CreateIndex
CREATE INDEX "referral_redemptions_referral_id_idx" ON "referral_redemptions"("referral_id");

-- CreateIndex
CREATE INDEX "referral_redemptions_status_idx" ON "referral_redemptions"("status");

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_redemptions" ADD CONSTRAINT "referral_redemptions_referral_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "referrals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referral_redemptions" ADD CONSTRAINT "referral_redemptions_referee_user_id_fkey" FOREIGN KEY ("referee_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
