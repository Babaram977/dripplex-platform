-- CreateEnum
CREATE TYPE "RideRatingRole" AS ENUM ('CUSTOMER', 'DRIVER');

-- CreateEnum
CREATE TYPE "RideProblemCategory" AS ENUM ('WRONG_FARE', 'DRIVER_BEHAVIOUR', 'UNSAFE_DRIVING', 'LOST_ITEM', 'VEHICLE_ISSUE', 'OTHER');

-- CreateEnum
CREATE TYPE "RideProblemStatus" AS ENUM ('OPEN', 'RESOLVED');

-- AlterTable
ALTER TABLE "rides" ADD COLUMN     "tip_amount" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "ride_ratings" (
    "id" UUID NOT NULL,
    "ride_id" UUID NOT NULL,
    "rater_id" UUID NOT NULL,
    "ratee_id" UUID NOT NULL,
    "rater_role" "RideRatingRole" NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" VARCHAR(1000),
    "category_ratings" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ride_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ride_problem_reports" (
    "id" UUID NOT NULL,
    "ride_id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "category" "RideProblemCategory" NOT NULL,
    "description" VARCHAR(2000),
    "status" "RideProblemStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "ride_problem_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ride_ratings_ratee_id_idx" ON "ride_ratings"("ratee_id");

-- CreateIndex
CREATE UNIQUE INDEX "ride_ratings_ride_id_rater_role_key" ON "ride_ratings"("ride_id", "rater_role");

-- CreateIndex
CREATE INDEX "ride_problem_reports_ride_id_idx" ON "ride_problem_reports"("ride_id");

-- CreateIndex
CREATE INDEX "ride_problem_reports_status_idx" ON "ride_problem_reports"("status");

-- AddForeignKey
ALTER TABLE "ride_ratings" ADD CONSTRAINT "ride_ratings_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_problem_reports" ADD CONSTRAINT "ride_problem_reports_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE CASCADE ON UPDATE CASCADE;
