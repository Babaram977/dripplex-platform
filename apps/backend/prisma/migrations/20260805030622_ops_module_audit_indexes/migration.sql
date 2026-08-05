-- DPX-OPS-001 module-level production audit (2026-08-05)
--
-- Adds indexes for timestamp columns that are filtered/sorted by Operations
-- Console queries with no supporting index today:
--   * The Live Activity Feed (`OperationsDashboardService.getActivityFeed()`,
--     polled by every operator every 15 seconds) sorts SosAlert/
--     IncidentReport/Inspection/DriverShift/Ride by createdAt/completedAt/
--     startedAt/endedAt/cancelledAt.
--   * OperationsAnalyticsService range-filters RideOffer.offeredAt,
--     DriverShift.startedAt, Ride.completedAt, and OperationsCase.createdAt
--     with no other predicate in the WHERE clause.
-- None of these columns had a leading-column index, so each query would
-- degrade to a full table scan + sort as the underlying tables grow.
-- Purely additive — no data change, no locked behavior change.

-- CreateIndex
CREATE INDEX "sos_alerts_created_at_idx" ON "sos_alerts"("created_at");

-- CreateIndex
CREATE INDEX "incident_reports_created_at_idx" ON "incident_reports"("created_at");

-- CreateIndex
CREATE INDEX "inspections_completed_at_idx" ON "inspections"("completed_at");

-- CreateIndex
CREATE INDEX "driver_shifts_started_at_idx" ON "driver_shifts"("started_at");

-- CreateIndex
CREATE INDEX "driver_shifts_ended_at_idx" ON "driver_shifts"("ended_at");

-- CreateIndex
CREATE INDEX "rides_cancelled_at_idx" ON "rides"("cancelled_at");

-- CreateIndex
CREATE INDEX "rides_completed_at_idx" ON "rides"("completed_at");

-- CreateIndex
CREATE INDEX "ride_offers_offered_at_idx" ON "ride_offers"("offered_at");

-- CreateIndex
CREATE INDEX "operations_cases_created_at_idx" ON "operations_cases"("created_at");
