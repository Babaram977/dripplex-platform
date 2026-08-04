-- CreateEnum
CREATE TYPE "DriverShiftStatus" AS ENUM ('ACTIVE', 'ON_BREAK', 'ENDED');

-- CreateTable
CREATE TABLE "driver_shifts" (
    "id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "status" "DriverShiftStatus" NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "break_started_at" TIMESTAMP(3),
    "continuous_since" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_break_seconds" INTEGER NOT NULL DEFAULT 0,
    "force_ended_by" UUID,
    "admin_notes" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_planned_availability" (
    "id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_planned_availability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "driver_shifts_driver_id_status_idx" ON "driver_shifts"("driver_id", "status");

-- CreateIndex
CREATE INDEX "driver_shifts_driver_id_started_at_idx" ON "driver_shifts"("driver_id", "started_at");

-- CreateIndex
CREATE INDEX "driver_shifts_status_idx" ON "driver_shifts"("status");

-- CreateIndex
CREATE INDEX "driver_planned_availability_driver_id_idx" ON "driver_planned_availability"("driver_id");

-- AddForeignKey
ALTER TABLE "driver_shifts" ADD CONSTRAINT "driver_shifts_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_shifts" ADD CONSTRAINT "driver_shifts_force_ended_by_fkey" FOREIGN KEY ("force_ended_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_planned_availability" ADD CONSTRAINT "driver_planned_availability_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
