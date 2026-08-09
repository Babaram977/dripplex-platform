-- DPX-LAUNCH — Ops-configurable platform (ride) commission rate.
-- Singleton settings row (default 10%) mirroring merchant_commission_settings,
-- plus a per-ride snapshot of the rate that applied at settlement so refunds
-- and reversals always use the historical rate.

-- CreateTable
CREATE TABLE "platform_commission_settings" (
    "id" UUID NOT NULL,
    "commission_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.10,
    "updated_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_commission_settings_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "rides" ADD COLUMN "platform_commission_rate" DECIMAL(5,4);
