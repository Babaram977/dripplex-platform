-- DPX fleet settlement authorization: a fleet owner may request a payout,
-- but only Operations can approve an independently owed receivable.
CREATE TYPE "FleetSettlementRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAID');

CREATE TABLE "fleet_settlement_requests" (
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

CREATE INDEX "fleet_settlement_requests_fleet_id_status_idx" ON "fleet_settlement_requests"("fleet_id", "status");
CREATE INDEX "fleet_settlement_requests_requested_by_idx" ON "fleet_settlement_requests"("requested_by");
CREATE UNIQUE INDEX "fleet_settlement_requests_transfer_id_key" ON "fleet_settlement_requests"("transfer_id") WHERE "transfer_id" IS NOT NULL;

ALTER TABLE "fleet_settlement_transfers"
  ADD COLUMN "settlement_request_id" UUID;

CREATE UNIQUE INDEX "fleet_settlement_transfers_settlement_request_id_key"
  ON "fleet_settlement_transfers"("settlement_request_id")
  WHERE "settlement_request_id" IS NOT NULL;

ALTER TABLE "fleet_settlement_transfers"
  ADD CONSTRAINT "fleet_settlement_transfers_settlement_request_id_fkey"
  FOREIGN KEY ("settlement_request_id") REFERENCES "fleet_settlement_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
