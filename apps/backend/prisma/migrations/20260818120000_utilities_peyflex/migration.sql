-- DPX-UTILITIES-001 / -002 — the Utilities tab (airtime, data, electricity, cable TV)
-- behind the Peyflex aggregator.

-- CreateEnum
CREATE TYPE "UtilityServiceType" AS ENUM ('AIRTIME', 'DATA', 'ELECTRICITY', 'CABLE_TV');

-- CreateEnum
CREATE TYPE "UtilityPaymentMethod" AS ENUM ('WALLET', 'PAYSTACK', 'FLUTTERWAVE');

-- CreateEnum
-- AWAITING_PAYMENT is the card path before the gateway confirms; PENDING is a
-- purchase the provider never answered for and that a human must resolve
-- (Peyflex offers no idempotency key and no status lookup).
CREATE TYPE "UtilityPurchaseStatus" AS ENUM ('AWAITING_PAYMENT', 'PENDING', 'SUCCESSFUL', 'FAILED', 'REVERSED');

-- CreateTable
CREATE TABLE "utility_purchases" (
    "id" UUID NOT NULL,
    "service_type" "UtilityServiceType" NOT NULL,
    "customer_id" UUID NOT NULL,
    "customer_identifier" VARCHAR(64) NOT NULL,
    "provider_code" VARCHAR(64) NOT NULL,
    "plan_code" VARCHAR(64),
    "amount_charged" DECIMAL(12,2) NOT NULL,
    "provider_cost" DECIMAL(12,2),
    "payment_method" "UtilityPaymentMethod" NOT NULL,
    "payment_reference" VARCHAR(100),
    "status" "UtilityPurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "provider_reference" VARCHAR(100),
    "delivered_token" VARCHAR(255),
    "failure_reason" VARCHAR(500),
    "provider_response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "utility_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "utility_purchases_payment_reference_key" ON "utility_purchases"("payment_reference");

-- CreateIndex
CREATE INDEX "utility_purchases_customer_id_created_at_idx" ON "utility_purchases"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "utility_purchases_status_idx" ON "utility_purchases"("status");

-- CreateIndex
CREATE INDEX "utility_purchases_service_type_created_at_idx" ON "utility_purchases"("service_type", "created_at");

-- CreateIndex
CREATE INDEX "utility_purchases_provider_reference_idx" ON "utility_purchases"("provider_reference");

-- AddForeignKey
ALTER TABLE "utility_purchases" ADD CONSTRAINT "utility_purchases_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
