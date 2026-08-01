-- CreateEnum
CREATE TYPE "RidePaymentMethod" AS ENUM ('WALLET', 'PAYSTACK', 'FLUTTERWAVE', 'OPAY', 'CASH');

-- CreateEnum
CREATE TYPE "RidePaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- AlterEnum
ALTER TYPE "WalletOwnerType" ADD VALUE 'DRIVER';
ALTER TYPE "WalletOwnerType" ADD VALUE 'PLATFORM';

-- AlterEnum
ALTER TYPE "PaymentProvider" ADD VALUE 'OPAY';

-- AlterTable
ALTER TABLE "rides" ADD COLUMN     "driver_earning" DECIMAL(12,2),
ADD COLUMN     "payment_method" "RidePaymentMethod",
ADD COLUMN     "payment_status" "RidePaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "platform_commission" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "ride_payment_transactions" (
    "id" UUID NOT NULL,
    "ride_id" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "provider_reference" VARCHAR(100) NOT NULL,
    "provider_transaction_id" VARCHAR(100),
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'NGN',
    "authorization_url" VARCHAR(2048),
    "access_code" VARCHAR(100),
    "gateway_response" JSONB,
    "paid_at" TIMESTAMP(3),
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ride_payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ride_payment_transactions_provider_reference_key" ON "ride_payment_transactions"("provider_reference");

-- CreateIndex
CREATE INDEX "ride_payment_transactions_ride_id_idx" ON "ride_payment_transactions"("ride_id");

-- CreateIndex
CREATE INDEX "ride_payment_transactions_provider_reference_idx" ON "ride_payment_transactions"("provider_reference");

-- CreateIndex
CREATE INDEX "ride_payment_transactions_status_idx" ON "ride_payment_transactions"("status");

-- AddForeignKey
ALTER TABLE "ride_payment_transactions" ADD CONSTRAINT "ride_payment_transactions_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE CASCADE ON UPDATE CASCADE;
