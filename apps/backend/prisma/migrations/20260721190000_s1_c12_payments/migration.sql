-- S1-C12: Payment gateway integration

CREATE TYPE "PaymentProvider" AS ENUM ('PAYSTACK', 'FLUTTERWAVE', 'MONIEPOINT');

CREATE TYPE "TransactionStatus" AS ENUM (
  'PENDING',
  'SUCCESS',
  'FAILED',
  'ABANDONED',
  'CANCELLED',
  'REFUNDED'
);

CREATE TABLE "payment_transactions" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "merchant_id" UUID NOT NULL,
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
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_transactions_provider_reference_key" ON "payment_transactions"("provider_reference");
CREATE INDEX "payment_transactions_order_id_idx" ON "payment_transactions"("order_id");
CREATE INDEX "payment_transactions_provider_reference_idx" ON "payment_transactions"("provider_reference");
CREATE INDEX "payment_transactions_provider_transaction_id_idx" ON "payment_transactions"("provider_transaction_id");
CREATE INDEX "payment_transactions_status_idx" ON "payment_transactions"("status");
CREATE INDEX "payment_transactions_customer_id_idx" ON "payment_transactions"("customer_id");
CREATE INDEX "payment_transactions_merchant_id_idx" ON "payment_transactions"("merchant_id");

ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
