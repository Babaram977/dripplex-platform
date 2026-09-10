-- DPX fleet settlement authorization: a fleet owner may request a payout,
-- but only Operations can approve an independently owed receivable.
--
-- This migration may run after the reconciliation migration that introduced
-- the same settlement-request infrastructure, so every DDL operation is safe
-- when the object already exists.

DO $$
BEGIN
  CREATE TYPE "FleetSettlementRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAID', 'PROCESSING');
EXCEPTION
  WHEN duplicate_object THEN
    BEGIN
      ALTER TYPE "FleetSettlementRequestStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
    EXCEPTION WHEN undefined_object THEN
      NULL;
    END;
END $$;

CREATE TABLE IF NOT EXISTS "fleet_settlement_requests" (
  "id" UUID NOT NULL,
  "fleet_id" UUID NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "status" "FleetSettlementRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requested_by" UUID NOT NULL,
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approved_by" UUID,
  "approved_at" TIMESTAMP(3),
  "rejection_reason" TEXT,
  "transfer_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fleet_settlement_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "fleet_settlement_requests_fleet_id_fkey" FOREIGN KEY ("fleet_id") REFERENCES "fleets"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "fleet_settlement_requests_fleet_id_status_idx" ON "fleet_settlement_requests"("fleet_id", "status");
CREATE INDEX IF NOT EXISTS "fleet_settlement_requests_requested_by_idx" ON "fleet_settlement_requests"("requested_by");
CREATE UNIQUE INDEX IF NOT EXISTS "fleet_settlement_requests_transfer_id_key"
  ON "fleet_settlement_requests"("transfer_id") WHERE "transfer_id" IS NOT NULL;

ALTER TABLE "fleet_settlement_transfers"
  ADD COLUMN IF NOT EXISTS "settlement_request_id" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "fleet_settlement_transfers_settlement_request_id_key"
  ON "fleet_settlement_transfers"("settlement_request_id")
  WHERE "settlement_request_id" IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fleet_settlement_transfers_settlement_request_id_fkey'
  ) THEN
    ALTER TABLE "fleet_settlement_transfers"
      ADD CONSTRAINT "fleet_settlement_transfers_settlement_request_id_fkey"
      FOREIGN KEY ("settlement_request_id") REFERENCES "fleet_settlement_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
