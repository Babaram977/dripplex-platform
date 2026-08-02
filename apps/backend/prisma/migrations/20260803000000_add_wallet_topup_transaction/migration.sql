-- CreateTable
CREATE TABLE "wallet_topup_transactions" (
    "id" UUID NOT NULL,
    "wallet_owner_type" "WalletOwnerType" NOT NULL,
    "wallet_owner_id" UUID NOT NULL,
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

    CONSTRAINT "wallet_topup_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_topup_transactions_provider_reference_key" ON "wallet_topup_transactions"("provider_reference");

-- CreateIndex
CREATE INDEX "wallet_topup_transactions_wallet_owner_type_wallet_owner_id_idx" ON "wallet_topup_transactions"("wallet_owner_type", "wallet_owner_id");

-- CreateIndex
CREATE INDEX "wallet_topup_transactions_provider_reference_idx" ON "wallet_topup_transactions"("provider_reference");

-- CreateIndex
CREATE INDEX "wallet_topup_transactions_status_idx" ON "wallet_topup_transactions"("status");
