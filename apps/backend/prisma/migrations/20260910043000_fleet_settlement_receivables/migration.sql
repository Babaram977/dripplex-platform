-- DPX-FLEET settlement authorization ledger.
-- A fleet can only request money against an independently approved payable.
--
-- This migration is intentionally reconciliation-safe because an earlier fleet
-- settlement authorization migration may already have created
-- fleet_settlement_requests in production.

CREATE TABLE IF NOT EXISTS "fleet_settlement_receivables" (
  "id" UUID NOT NULL,
  "fleet_id" UUID NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "remaining_amount" DECIMAL(14,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'NGN',
  "status" VARCHAR(16) NOT NULL DEFAULT 'APPROVED',
  "reference_type" VARCHAR(80) NOT NULL,
  "reference_id" VARCHAR(160) NOT NULL,
  "description" VARCHAR(500),
  "approved_by" UUID NOT NULL,
  "approved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fleet_settlement_receivables_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fleet_settlement_receivables_amount_check" CHECK ("amount" > 0 AND "remaining_amount" >= 0 AND "remaining_amount" <= "amount"),
  CONSTRAINT "fleet_settlement_receivables_status_check" CHECK ("status" IN ('APPROVED','CONSUMED'))
);

CREATE INDEX IF NOT EXISTS "fleet_settlement_receivables_fleet_status_idx" ON "fleet_settlement_receivables"("fleet_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "fleet_settlement_receivables_reference_unique" ON "fleet_settlement_receivables"("fleet_id", "reference_type", "reference_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fleet_settlement_receivables_fleet_id_fkey'
  ) THEN
    ALTER TABLE "fleet_settlement_receivables"
      ADD CONSTRAINT "fleet_settlement_receivables_fleet_id_fkey"
      FOREIGN KEY ("fleet_id") REFERENCES "fleets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Reconcile an already-existing request table instead of failing on CREATE TABLE.
CREATE TABLE IF NOT EXISTS "fleet_settlement_requests" (
  "id" UUID NOT NULL,
  "fleet_id" UUID NOT NULL,
  "receivable_id" UUID NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'NGN',
  "status" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  "requested_by" UUID NOT NULL,
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approved_by" UUID,
  "approved_at" TIMESTAMP(3),
  "rejection_reason" VARCHAR(500),
  "transfer_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fleet_settlement_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fleet_settlement_requests_status_check" CHECK ("status" IN ('PENDING','APPROVED','PROCESSING','PAID','REJECTED'))
);

ALTER TABLE "fleet_settlement_requests"
  ADD COLUMN IF NOT EXISTS "receivable_id" UUID;

-- The earlier authorization migration used a PostgreSQL enum for status.
-- Keep that existing type compatible with the newer PROCESSING state.
DO $$
DECLARE
  status_type TEXT;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
    INTO status_type
  FROM pg_attribute a
  WHERE a.attrelid = 'fleet_settlement_requests'::regclass
    AND a.attname = 'status'
    AND NOT a.attisdropped;

  IF status_type = 'FleetSettlementRequestStatus' THEN
    BEGIN
      ALTER TYPE "FleetSettlementRequestStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
    EXCEPTION WHEN undefined_object THEN
      NULL;
    END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "fleet_settlement_requests_fleet_status_idx" ON "fleet_settlement_requests"("fleet_id", "status");
CREATE INDEX IF NOT EXISTS "fleet_settlement_requests_receivable_id_idx" ON "fleet_settlement_requests"("receivable_id");
CREATE INDEX IF NOT EXISTS "fleet_settlement_requests_requested_by_idx" ON "fleet_settlement_requests"("requested_by");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fleet_settlement_requests_fleet_id_fkey'
  ) THEN
    ALTER TABLE "fleet_settlement_requests"
      ADD CONSTRAINT "fleet_settlement_requests_fleet_id_fkey"
      FOREIGN KEY ("fleet_id") REFERENCES "fleets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fleet_settlement_requests_receivable_id_fkey'
  ) THEN
    ALTER TABLE "fleet_settlement_requests"
      ADD CONSTRAINT "fleet_settlement_requests_receivable_id_fkey"
      FOREIGN KEY ("receivable_id") REFERENCES "fleet_settlement_receivables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "fleet_settlement_transfers"
  ADD COLUMN IF NOT EXISTS "settlement_request_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fleet_settlement_transfers_settlement_request_id_fkey'
  ) THEN
    ALTER TABLE "fleet_settlement_transfers"
      ADD CONSTRAINT "fleet_settlement_transfers_settlement_request_id_fkey"
      FOREIGN KEY ("settlement_request_id") REFERENCES "fleet_settlement_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "fleet_settlement_transfers_settlement_request_id_idx"
  ON "fleet_settlement_transfers"("settlement_request_id");
