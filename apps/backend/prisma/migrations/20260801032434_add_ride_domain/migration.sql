-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "RideType" AS ENUM ('ECONOMY', 'TRICYCLE');

-- CreateEnum
CREATE TYPE "RideStatus" AS ENUM ('REQUESTED', 'SEARCHING', 'DRIVER_ASSIGNED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_DRIVERS_FOUND');

-- CreateEnum
CREATE TYPE "RideCancelledBy" AS ENUM ('CUSTOMER', 'DRIVER', 'SYSTEM');

-- AlterEnum
ALTER TYPE "KycDocumentType" ADD VALUE 'VEHICLE_REGISTRATION';

-- AlterTable
ALTER TABLE "driver_profiles" ADD COLUMN     "approved_by" UUID,
ADD COLUMN     "rejected_reason" VARCHAR(1000),
ADD COLUMN     "status" "DriverStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "suspended_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "rides" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "driver_id" UUID,
    "ride_type" "RideType" NOT NULL,
    "status" "RideStatus" NOT NULL DEFAULT 'REQUESTED',
    "pickup_latitude" DECIMAL(10,7) NOT NULL,
    "pickup_longitude" DECIMAL(10,7) NOT NULL,
    "pickup_address" VARCHAR(500),
    "dropoff_latitude" DECIMAL(10,7) NOT NULL,
    "dropoff_longitude" DECIMAL(10,7) NOT NULL,
    "dropoff_address" VARCHAR(500),
    "estimated_distance_meters" INTEGER,
    "estimated_duration_seconds" INTEGER,
    "base_fare" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "distance_fare" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "time_fare" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_fare" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_at" TIMESTAMP(3),
    "arrived_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by" "RideCancelledBy",
    "cancellation_reason" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ride_tracking" (
    "id" UUID NOT NULL,
    "ride_id" UUID NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "heading" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ride_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_availability" (
    "driver_id" UUID NOT NULL,
    "online" BOOLEAN NOT NULL DEFAULT false,
    "accepting_rides" BOOLEAN NOT NULL DEFAULT false,
    "vehicle_type" "RideType" NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "active_ride_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_availability_pkey" PRIMARY KEY ("driver_id")
);

-- CreateTable
CREATE TABLE "driver_kyc" (
    "id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "document_type" "KycDocumentType" NOT NULL,
    "document_number" VARCHAR(100) NOT NULL,
    "front_image" VARCHAR(2048) NOT NULL,
    "back_image" VARCHAR(2048),
    "verification_status" "KycVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "remarks" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_kyc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rides_customer_id_idx" ON "rides"("customer_id");

-- CreateIndex
CREATE INDEX "rides_driver_id_idx" ON "rides"("driver_id");

-- CreateIndex
CREATE INDEX "rides_status_idx" ON "rides"("status");

-- CreateIndex
CREATE INDEX "rides_requested_at_idx" ON "rides"("requested_at");

-- CreateIndex
CREATE INDEX "ride_tracking_ride_id_created_at_idx" ON "ride_tracking"("ride_id", "created_at");

-- CreateIndex
CREATE INDEX "driver_availability_online_accepting_rides_vehicle_type_idx" ON "driver_availability"("online", "accepting_rides", "vehicle_type");

-- CreateIndex
CREATE INDEX "driver_kyc_driver_id_idx" ON "driver_kyc"("driver_id");

-- CreateIndex
CREATE INDEX "driver_kyc_verification_status_idx" ON "driver_kyc"("verification_status");

-- CreateIndex
CREATE INDEX "driver_profiles_status_idx" ON "driver_profiles"("status");

-- AddForeignKey
ALTER TABLE "rides" ADD CONSTRAINT "rides_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rides" ADD CONSTRAINT "rides_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_tracking" ADD CONSTRAINT "ride_tracking_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_availability" ADD CONSTRAINT "driver_availability_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_kyc" ADD CONSTRAINT "driver_kyc_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

