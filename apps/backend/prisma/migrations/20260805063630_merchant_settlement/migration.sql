-- DPX-MERCHANT-002: Marketplace Merchant Settlement
-- See docs/DPX-MERCHANT-002-SETTLEMENT-DESIGN.md

-- CreateEnum
CREATE TYPE "OrderSettlementStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REVERSED');

-- CreateTable
CREATE TABLE "merchant_commission_settings" (
    "id" UUID NOT NULL,
    "commission_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.10,
    "updated_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_commission_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_settlements" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
    "status" "OrderSettlementStatus" NOT NULL DEFAULT 'PENDING',
    "gross_amount" DECIMAL(12,2) NOT NULL,
    "commission_rate" DECIMAL(5,4) NOT NULL,
    "commission_amount" DECIMAL(12,2) NOT NULL,
    "merchant_amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'NGN',
    "wallet_ledger_entry_id" UUID,
    "failure_reason" VARCHAR(1000),
    "reversed_at" TIMESTAMP(3),
    "reversal_reason" VARCHAR(1000),
    "reversal_ledger_entry_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_settlements_order_id_key" ON "order_settlements"("order_id");

-- CreateIndex
CREATE INDEX "order_settlements_merchant_id_idx" ON "order_settlements"("merchant_id");

-- CreateIndex
CREATE INDEX "order_settlements_status_idx" ON "order_settlements"("status");

-- AddForeignKey
ALTER TABLE "order_settlements" ADD CONSTRAINT "order_settlements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
