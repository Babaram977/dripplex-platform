-- DPX-PROFILE-KYC-001
-- Founder decisions recorded 2026-08-07 (see docs/DPX-PROFILE-KYC-001-DESIGN.md):
--   1. Editable customer profiles (no username) — adds profile_photo_url, date_of_birth,
--      gender to `users`.
--   2. Tiered, risk-based customer KYC (Level 0/1/2, 7-state lifecycle) — new `customer_kyc`
--      table, parallel to the existing (frozen, untouched) `driver_kyc` table.
--
-- This migration was generated via `prisma migrate diff` against the local shadow database
-- and hand-curated to include ONLY the statements produced by this feature's schema changes.
-- The shadow diff also surfaced ~7 statements from unrelated, pre-existing drift between
-- `prisma/migrations` history and the live schema (an index rename mismatch on
-- `promotions_domains_idx`, four `ALTER COLUMN "id" DROP DEFAULT` statements on
-- `driver_identity_verifications`/`inspection_centres`/`inspections`/`vehicles`, a missing
-- `orders.order_number` index, a missing `wallet_ledger_entries` unique constraint, and two
-- constraint-rename mismatches on `analytics_daily_metrics`/`notification_delivery_attempts`).
-- Those are documented pre-existing drift (see docs/REALITY-STAGE-R1.1.md) and are deliberately
-- excluded here so this migration only bundles the change it's actually for.

-- CreateEnum
CREATE TYPE "CustomerKycStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'EXPIRED', 'REQUIRES_RESUBMISSION');

-- CreateEnum
CREATE TYPE "CustomerKycLevel" AS ENUM ('LEVEL_0', 'LEVEL_1', 'LEVEL_2');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "date_of_birth" DATE,
ADD COLUMN     "gender" VARCHAR(50),
ADD COLUMN     "profile_photo_url" VARCHAR(2048);

-- CreateTable
CREATE TABLE "customer_kyc" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "level" "CustomerKycLevel" NOT NULL DEFAULT 'LEVEL_0',
    "status" "CustomerKycStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "document_type" "KycDocumentType",
    "document_number" VARCHAR(100),
    "front_image_url" VARCHAR(2048),
    "back_image_url" VARCHAR(2048),
    "selfie_url" VARCHAR(2048),
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "remarks" VARCHAR(1000),
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_kyc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_kyc_user_id_idx" ON "customer_kyc"("user_id");

-- CreateIndex
CREATE INDEX "customer_kyc_status_idx" ON "customer_kyc"("status");

-- AddForeignKey
ALTER TABLE "customer_kyc" ADD CONSTRAINT "customer_kyc_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
