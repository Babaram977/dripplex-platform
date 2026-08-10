-- DPX-RIDER-001 — delivery-rider approval lifecycle, mirroring the driver one.
-- Riders previously had only a bare `is_approved` boolean with no status,
-- approver, reason, or suspension tracking and no approve/reject endpoints.
-- This adds a RiderStatus enum + the lifecycle columns so Ops/Admin can
-- approve/reject/suspend/reactivate riders (see riders module).

-- CreateEnum
CREATE TYPE "RiderStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- AlterTable
ALTER TABLE "rider_profiles"
  ADD COLUMN "status" "RiderStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "approved_by" UUID,
  ADD COLUMN "rejected_reason" VARCHAR(1000),
  ADD COLUMN "suspended_at" TIMESTAMP(3);

-- Backfill: keep the new status consistent with the pre-existing boolean so
-- already-approved riders are APPROVED (and carry their approved_at) rather
-- than being reset to PENDING.
UPDATE "rider_profiles" SET "status" = 'APPROVED' WHERE "is_approved" = true;

-- CreateIndex
CREATE INDEX "rider_profiles_status_idx" ON "rider_profiles"("status");
