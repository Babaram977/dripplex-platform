-- S1-C13: Delivery & fulfillment

CREATE TYPE "DeliveryStatus" AS ENUM (
  'PENDING',
  'ASSIGNED',
  'ACCEPTED',
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED',
  'DELIVERED',
  'FAILED',
  'RETURNED',
  'CANCELLED'
);

CREATE TYPE "AssignmentMethod" AS ENUM ('AUTO', 'MANUAL');

CREATE TYPE "ProofType" AS ENUM ('PHOTO', 'OTP', 'SIGNATURE', 'PHOTO_AND_OTP');

CREATE TABLE "delivery_jobs" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "rider_id" UUID,
    "merchant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "assignment_method" "AssignmentMethod" NOT NULL DEFAULT 'AUTO',
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "pickup_latitude" DECIMAL(10,7) NOT NULL,
    "pickup_longitude" DECIMAL(10,7) NOT NULL,
    "dropoff_latitude" DECIMAL(10,7) NOT NULL,
    "dropoff_longitude" DECIMAL(10,7) NOT NULL,
    "estimated_distance_meters" INTEGER,
    "estimated_duration_seconds" INTEGER,
    "delivery_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "assigned_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "picked_up_at" TIMESTAMP(3),
    "arrived_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "returned_at" TIMESTAMP(3),
    "cancellation_reason" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "delivery_jobs_order_id_key" ON "delivery_jobs"("order_id");
CREATE INDEX "delivery_jobs_rider_id_idx" ON "delivery_jobs"("rider_id");
CREATE INDEX "delivery_jobs_merchant_id_idx" ON "delivery_jobs"("merchant_id");
CREATE INDEX "delivery_jobs_customer_id_idx" ON "delivery_jobs"("customer_id");
CREATE INDEX "delivery_jobs_status_idx" ON "delivery_jobs"("status");
CREATE INDEX "delivery_jobs_created_at_idx" ON "delivery_jobs"("created_at");

ALTER TABLE "delivery_jobs" ADD CONSTRAINT "delivery_jobs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "delivery_jobs" ADD CONSTRAINT "delivery_jobs_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "delivery_jobs" ADD CONSTRAINT "delivery_jobs_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "delivery_jobs" ADD CONSTRAINT "delivery_jobs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "delivery_tracking" (
    "id" UUID NOT NULL,
    "delivery_job_id" UUID NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "heading" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_tracking_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "delivery_tracking_delivery_job_id_idx" ON "delivery_tracking"("delivery_job_id");
CREATE INDEX "delivery_tracking_delivery_job_id_created_at_idx" ON "delivery_tracking"("delivery_job_id", "created_at");

ALTER TABLE "delivery_tracking" ADD CONSTRAINT "delivery_tracking_delivery_job_id_fkey" FOREIGN KEY ("delivery_job_id") REFERENCES "delivery_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "delivery_proofs" (
    "id" UUID NOT NULL,
    "delivery_job_id" UUID NOT NULL,
    "proof_type" "ProofType" NOT NULL,
    "photo_url" VARCHAR(2048),
    "otp" VARCHAR(12),
    "signature_url" VARCHAR(2048),
    "notes" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_proofs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "delivery_proofs_delivery_job_id_idx" ON "delivery_proofs"("delivery_job_id");

ALTER TABLE "delivery_proofs" ADD CONSTRAINT "delivery_proofs_delivery_job_id_fkey" FOREIGN KEY ("delivery_job_id") REFERENCES "delivery_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "rider_availability" (
    "rider_id" UUID NOT NULL,
    "online" BOOLEAN NOT NULL DEFAULT false,
    "accepting_orders" BOOLEAN NOT NULL DEFAULT false,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "active_job_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rider_availability_pkey" PRIMARY KEY ("rider_id")
);

CREATE INDEX "rider_availability_online_accepting_orders_idx" ON "rider_availability"("online", "accepting_orders");

ALTER TABLE "rider_availability" ADD CONSTRAINT "rider_availability_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
