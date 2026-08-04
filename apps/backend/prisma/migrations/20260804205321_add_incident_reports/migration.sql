-- CreateEnum
CREATE TYPE "IncidentCategory" AS ENUM ('ACCIDENT', 'PASSENGER_ALTERCATION', 'VEHICLE_BREAKDOWN', 'SAFETY_CONCERN', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentReportStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'INCIDENT_REPORT_UPDATED';

-- CreateTable
CREATE TABLE "incident_reports" (
    "id" UUID NOT NULL,
    "driver_id" UUID NOT NULL,
    "ride_id" UUID,
    "category" "IncidentCategory" NOT NULL,
    "severity" "IncidentSeverity" NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "status" "IncidentReportStatus" NOT NULL DEFAULT 'OPEN',
    "admin_notes" VARCHAR(2000),
    "acknowledged_by" UUID,
    "acknowledged_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incident_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "incident_reports_driver_id_idx" ON "incident_reports"("driver_id");

-- CreateIndex
CREATE INDEX "incident_reports_ride_id_idx" ON "incident_reports"("ride_id");

-- CreateIndex
CREATE INDEX "incident_reports_status_idx" ON "incident_reports"("status");

-- CreateIndex
CREATE INDEX "incident_reports_severity_idx" ON "incident_reports"("severity");

-- AddForeignKey
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
