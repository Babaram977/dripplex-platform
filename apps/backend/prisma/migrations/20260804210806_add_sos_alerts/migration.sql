-- CreateEnum
CREATE TYPE "SosAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SOS_ALERT_TRIGGERED';
ALTER TYPE "NotificationType" ADD VALUE 'SOS_ALERT_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE 'SOS_ALERT_CUSTOMER_NOTICE';

-- CreateTable
CREATE TABLE "sos_alerts" (
    "id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "ride_id" UUID,
    "vehicle_id" UUID,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "battery_level" INTEGER,
    "status" "SosAlertStatus" NOT NULL DEFAULT 'OPEN',
    "admin_notes" VARCHAR(2000),
    "acknowledged_by" UUID,
    "acknowledged_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "customer_notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sos_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sos_alerts_driver_id_idx" ON "sos_alerts"("driver_id");

-- CreateIndex
CREATE INDEX "sos_alerts_ride_id_idx" ON "sos_alerts"("ride_id");

-- CreateIndex
CREATE INDEX "sos_alerts_status_idx" ON "sos_alerts"("status");

-- AddForeignKey
ALTER TABLE "sos_alerts" ADD CONSTRAINT "sos_alerts_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sos_alerts" ADD CONSTRAINT "sos_alerts_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sos_alerts" ADD CONSTRAINT "sos_alerts_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
