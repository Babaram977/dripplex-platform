-- AlterEnum
ALTER TYPE "PromotionType" ADD VALUE 'WALLET_CREDIT';
ALTER TYPE "PromotionType" ADD VALUE 'CASHBACK';
ALTER TYPE "PromotionType" ADD VALUE 'FREE_DELIVERY';
ALTER TYPE "PromotionType" ADD VALUE 'BONUS_REWARD';
ALTER TYPE "PromotionType" ADD VALUE 'MULTI_BUY';
ALTER TYPE "PromotionType" ADD VALUE 'THRESHOLD_DISCOUNT';

-- AlterEnum
ALTER TYPE "PromotionStatus" ADD VALUE 'ARCHIVED';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PROMOTION_REDEEMED';
ALTER TYPE "NotificationType" ADD VALUE 'PROMOTION_EXPIRED';
ALTER TYPE "NotificationType" ADD VALUE 'CASHBACK_AWARDED';

-- CreateEnum
CREATE TYPE "PromotionDomain" AS ENUM ('RIDE', 'MARKETPLACE', 'DELIVERY', 'WALLET', 'MERCHANT');

-- AlterTable
ALTER TABLE "promotions"
  ADD COLUMN "domains" "PromotionDomain"[] NOT NULL DEFAULT '{}',
  ADD COLUMN "credit_amount" DECIMAL(12,2),
  ADD COLUMN "max_discount" DECIMAL(12,2),
  ADD COLUMN "per_device_limit" INTEGER,
  ADD COLUMN "rules" JSONB,
  ADD COLUMN "paused_at" TIMESTAMP(3),
  ADD COLUMN "archived_at" TIMESTAMP(3),
  ADD COLUMN "cloned_from_id" UUID,
  ADD COLUMN "created_by" UUID;

-- AlterTable
ALTER TABLE "promotion_redemptions"
  ADD COLUMN "reference_type" VARCHAR(50),
  ADD COLUMN "reference_id" UUID,
  ADD COLUMN "device_id" VARCHAR(255),
  ADD COLUMN "wallet_transaction_id" UUID;

-- CreateIndex (GIN — domains is a scalar-list column; queried via "has"/"hasSome" containment, not exact-array equality)
CREATE INDEX "promotions_domains_idx" ON "promotions" USING GIN ("domains");

-- CreateIndex
CREATE INDEX "promotion_redemptions_reference_type_reference_id_idx" ON "promotion_redemptions"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "promotion_redemptions_device_id_idx" ON "promotion_redemptions"("device_id");

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_cloned_from_id_fkey" FOREIGN KEY ("cloned_from_id") REFERENCES "promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "rides"
  ADD COLUMN "promotion_id" UUID,
  ADD COLUMN "promo_discount" DECIMAL(12,2) NOT NULL DEFAULT 0;
