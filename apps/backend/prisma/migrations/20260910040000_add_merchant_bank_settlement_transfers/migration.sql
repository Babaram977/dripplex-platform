-- DPX-FIN-SETTLEMENT-001
-- Durable, exactly-once state for transferring an already-booked merchant
-- settlement from the DrippleX merchant wallet to the verified bank account.
CREATE TABLE "merchant_settlement_transfers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "settlement_id" UUID NOT NULL,
  "merchant_id" UUID NOT NULL,
  "bank_account_id" UUID NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'NGN',
  "provider" VARCHAR(32) NOT NULL,
  "provider_reference" VARCHAR(100),
  "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "failure_reason" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "merchant_settlement_transfers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "merchant_settlement_transfers_settlement_id_key" UNIQUE ("settlement_id"),
  CONSTRAINT "merchant_settlement_transfers_provider_reference_key" UNIQUE ("provider_reference"),
  CONSTRAINT "merchant_settlement_transfers_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "merchant_settlement_transfers_status_check" CHECK ("status" IN ('PENDING','SUCCESS','FAILED','REVERSED')),
  CONSTRAINT "merchant_settlement_transfers_settlement_fk" FOREIGN KEY ("settlement_id") REFERENCES "order_settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "merchant_settlement_transfers_bank_account_fk" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "merchant_settlement_transfers_merchant_status_idx" ON "merchant_settlement_transfers"("merchant_id", "status");
CREATE INDEX "merchant_settlement_transfers_provider_status_idx" ON "merchant_settlement_transfers"("provider", "status");
