-- DPX-COMMERCIAL-001 Slice 1: additive-only schema for the shared commercial
-- engine (Commission Account/Ledger, admin-configurable credit limits).
-- No existing table, column, or index is altered. See
-- docs/DPX-COMMERCIAL-001-REVENUE-SETTLEMENT-CREDIT-POLICY.md.

-- CreateEnum
CREATE TYPE "CommissionOwnerType" AS ENUM ('MERCHANT', 'DRIVER', 'RIDER');

-- CreateEnum
CREATE TYPE "CommissionEntryType" AS ENUM ('ACCRUAL', 'PAYMENT', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "commission_accounts" (
    "id" UUID NOT NULL,
    "owner_type" "CommissionOwnerType" NOT NULL,
    "owner_id" UUID NOT NULL,
    "outstanding_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit_limit" DECIMAL(14,2) NOT NULL,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "blocked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_ledger_entries" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "type" "CommissionEntryType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "balance_after" DECIMAL(14,2) NOT NULL,
    "reference_type" VARCHAR(100),
    "reference_id" UUID,
    "description" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial_credit_settings" (
    "id" UUID NOT NULL,
    "owner_type" "CommissionOwnerType" NOT NULL,
    "credit_limit" DECIMAL(14,2) NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commercial_credit_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "commission_accounts_owner_type_idx" ON "commission_accounts"("owner_type");

-- CreateIndex
CREATE INDEX "commission_accounts_blocked_idx" ON "commission_accounts"("blocked");

-- CreateIndex
CREATE UNIQUE INDEX "commission_accounts_owner_type_owner_id_key" ON "commission_accounts"("owner_type", "owner_id");

-- CreateIndex
CREATE INDEX "commission_ledger_entries_account_id_idx" ON "commission_ledger_entries"("account_id");

-- CreateIndex
CREATE INDEX "commission_ledger_entries_account_id_created_at_idx" ON "commission_ledger_entries"("account_id", "created_at");

-- CreateIndex
CREATE INDEX "commission_ledger_entries_type_idx" ON "commission_ledger_entries"("type");

-- CreateIndex
CREATE INDEX "commission_ledger_entries_reference_type_reference_id_idx" ON "commission_ledger_entries"("reference_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "commission_ledger_entries_account_reference_key" ON "commission_ledger_entries"("account_id", "reference_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "commercial_credit_settings_owner_type_key" ON "commercial_credit_settings"("owner_type");

-- AddForeignKey
ALTER TABLE "commission_ledger_entries" ADD CONSTRAINT "commission_ledger_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "commission_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
