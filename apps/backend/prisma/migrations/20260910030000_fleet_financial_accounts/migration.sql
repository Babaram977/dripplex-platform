-- DPX-FLEET financial hardening.
-- Fleet ownership remains commercial (fleet owes DrippleX commission), but the
-- platform must have a verified destination whenever a separate fleet payable
-- exists (earnings, refunds, incentives or other approved settlement).
CREATE TABLE "fleet_bank_accounts" (
  "id" UUID NOT NULL,
  "fleet_id" UUID NOT NULL,
  "bank_name" VARCHAR(150) NOT NULL,
  "bank_code" VARCHAR(32) NOT NULL,
  "account_name" VARCHAR(160) NOT NULL,
  "account_number" VARCHAR(32) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'NGN',
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "verified_at" TIMESTAMP(3),
  "provider_recipient_code" VARCHAR(120),
  "provider" VARCHAR(32) NOT NULL DEFAULT 'PAYSTACK',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fleet_bank_accounts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "fleet_bank_accounts_fleet_id_idx" ON "fleet_bank_accounts"("fleet_id");
CREATE INDEX "fleet_bank_accounts_fleet_id_verified_at_idx" ON "fleet_bank_accounts"("fleet_id", "verified_at");
CREATE UNIQUE INDEX "fleet_bank_accounts_default_unique" ON "fleet_bank_accounts"("fleet_id") WHERE "is_default" = true;
ALTER TABLE "fleet_bank_accounts" ADD CONSTRAINT "fleet_bank_accounts_fleet_id_fkey" FOREIGN KEY ("fleet_id") REFERENCES "fleets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "FleetSettlementTransferStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REVERSED');
CREATE TABLE "fleet_settlement_transfers" (
  "id" UUID NOT NULL,
  "fleet_id" UUID NOT NULL,
  "bank_account_id" UUID NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'NGN',
  "provider" VARCHAR(32) NOT NULL DEFAULT 'PAYSTACK',
  "status" "FleetSettlementTransferStatus" NOT NULL DEFAULT 'PENDING',
  "provider_reference" VARCHAR(120),
  "failure_reason" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "fleet_settlement_transfers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fleet_settlement_transfers_idempotency_unique" ON "fleet_settlement_transfers"("fleet_id", "id");
CREATE INDEX "fleet_settlement_transfers_status_idx" ON "fleet_settlement_transfers"("status");
CREATE INDEX "fleet_settlement_transfers_provider_reference_idx" ON "fleet_settlement_transfers"("provider_reference");
ALTER TABLE "fleet_settlement_transfers" ADD CONSTRAINT "fleet_settlement_transfers_fleet_id_fkey" FOREIGN KEY ("fleet_id") REFERENCES "fleets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fleet_settlement_transfers" ADD CONSTRAINT "fleet_settlement_transfers_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "fleet_bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
