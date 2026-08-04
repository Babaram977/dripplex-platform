-- DPX-DRIVER-002: structured vehicle management + mandatory inspection engine
-- + onboarding field additions (insurance doc type, KYC expiry, emergency
-- contact, agreement acceptance). See docs/DPX-DRIVER-002-INSPECTION-STANDARD.md.

-- AlterEnum
ALTER TYPE "KycDocumentType" ADD VALUE 'INSURANCE';

-- AlterTable
ALTER TABLE "driver_kyc" ADD COLUMN "expires_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "driver_profiles"
  ADD COLUMN "emergency_contact_name" VARCHAR(150),
  ADD COLUMN "emergency_contact_phone" VARCHAR(20),
  ADD COLUMN "agreement_accepted_at" TIMESTAMP(3),
  ADD COLUMN "agreement_version" VARCHAR(20);

-- CreateEnum
CREATE TYPE "VehicleApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "vehicles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "driver_id" UUID NOT NULL,
  "plate_number" VARCHAR(20) NOT NULL,
  "make" VARCHAR(50) NOT NULL,
  "model" VARCHAR(50) NOT NULL,
  "color" VARCHAR(30) NOT NULL,
  "year" INTEGER NOT NULL,
  "ride_category" "RideType" NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "approval_status" "VehicleApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "approved_at" TIMESTAMP(3),
  "approved_by" UUID,
  "rejected_reason" VARCHAR(1000),
  "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vehicles_plate_number_key" ON "vehicles"("plate_number");
CREATE INDEX "vehicles_driver_id_idx" ON "vehicles"("driver_id");
CREATE INDEX "vehicles_approval_status_idx" ON "vehicles"("approval_status");

ALTER TABLE "vehicles"
  ADD CONSTRAINT "vehicles_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "inspection_centres" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(150) NOT NULL,
  "address" VARCHAR(500) NOT NULL,
  "city" VARCHAR(100) NOT NULL,
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "inspection_centres_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inspection_centres_is_active_idx" ON "inspection_centres"("is_active");
CREATE INDEX "inspection_centres_city_idx" ON "inspection_centres"("city");

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('SCHEDULED', 'PASSED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "inspections" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "driver_id" UUID NOT NULL,
  "vehicle_id" UUID NOT NULL,
  "centre_id" UUID NOT NULL,
  "inspector_id" UUID,
  "status" "InspectionStatus" NOT NULL DEFAULT 'SCHEDULED',
  "scheduled_at" TIMESTAMP(3) NOT NULL,
  "completed_at" TIMESTAMP(3),
  "checklist" JSONB,
  "notes" VARCHAR(2000),
  "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "reinspection_of_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "inspections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inspections_driver_id_idx" ON "inspections"("driver_id");
CREATE INDEX "inspections_vehicle_id_idx" ON "inspections"("vehicle_id");
CREATE INDEX "inspections_centre_id_idx" ON "inspections"("centre_id");
CREATE INDEX "inspections_status_idx" ON "inspections"("status");
CREATE INDEX "inspections_scheduled_at_idx" ON "inspections"("scheduled_at");

ALTER TABLE "inspections"
  ADD CONSTRAINT "inspections_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "inspections_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "inspections_centre_id_fkey" FOREIGN KEY ("centre_id") REFERENCES "inspection_centres"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "inspections_reinspection_of_id_fkey" FOREIGN KEY ("reinspection_of_id") REFERENCES "inspections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
