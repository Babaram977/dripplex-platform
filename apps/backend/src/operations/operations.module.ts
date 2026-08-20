import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { DriversModule } from '../drivers/drivers.module';
import { PrismaModule } from '../prisma/prisma.module';

import { OperationsAnalyticsController } from './controllers/operations-analytics.controller';
import { OperationsCasesController } from './controllers/operations-cases.controller';
import { OperationsDashboardController } from './controllers/operations-dashboard.controller';
import { OperationsFleetController } from './controllers/operations-fleet.controller';
import { OperationsQueuesController } from './controllers/operations-queues.controller';
import { OperationsRidesController } from './controllers/operations-rides.controller';
import { OperationsStaffController } from './controllers/operations-staff.controller';
import { OperationsAnalyticsService } from './operations-analytics.service';
import { OperationsCasesService } from './operations-cases.service';
import { OperationsDashboardService } from './operations-dashboard.service';
import { OperationsDispatchSupportService } from './operations-dispatch-support.service';
import { OperationsEligibilityService } from './operations-eligibility.service';
import { OperationsFleetService } from './operations-fleet.service';
import { OperationsRideDetailService } from './operations-ride-detail.service';
import { OperationsRideQueueService } from './operations-ride-queue.service';

/** DPX-OPS-001 — Operations Command Centre backend.
 *
 * Slice 1 (Live Operations Dashboard): read-only fleet snapshot and live
 * ride queue, composed entirely from existing tables (`DriverProfile`,
 * `DriverAvailability`, `Vehicle`, `Inspection`, `DriverShift`, `SosAlert`,
 * `Ride`) via direct Prisma reads — no new schema, no writes.
 *
 * Slice 2 (Operations Work Queues, founder-approved 2026-08-04): the SOS/
 * Incident/Support work queues, layered over the same three frozen Driver
 * Slice 2 tables via the new `OperationsCase`/`OperationsCaseEvent` wrapper
 * models. `DriversModule` is imported (not modified) so
 * `OperationsCasesService` can compose `SosAlertService`/
 * `IncidentReportService`/`DriverSupportService`'s existing public update
 * methods — the source tables' own driver-facing status and notifications
 * stay exactly as Driver Slice 2 built them.
 *
 * Slice 3 (Dispatch Management, founder-approved 2026-08-05,
 * reality-audited first — see docs/DPX-OPS-001-SLICE-3-REALITY-AUDIT.md):
 * ride detail, driver allocation history (`RideOffer`), trip monitoring
 * (`RideTracking`), and the DPX-RIDE-201 decision-support panel
 * (`DriverAvailability`/`Vehicle`/`RideRating`) — all read-only, all
 * composed inside `operations/`. No manual-reassignment action exists;
 * that stays deferred to DPX-RIDE-201's own future founder-approved pass.
 *
 * Slice 4 (Operations Analytics, founder-approved 2026-08-05,
 * reality-audited first — see docs/DPX-OPS-001-SLICE-4-REALITY-AUDIT.md):
 * live-query aggregation over `Ride`/`RideOffer`/`DriverShift`/
 * `OperationsCase` for driver utilization, shift, ride, dispatch,
 * response-time, and geographic-demand analytics. No pre-aggregation
 * table, no reuse of the dormant Marketplace-scoped `analytics/` module —
 * its own permission (`operations:analytics:read`).
 *
 * `apps/backend/src/rides/` is a frozen module and is never imported or
 * modified here; `Ride` and its related tables are read directly via
 * `PrismaService`, the same cross-module-read pattern established
 * throughout Driver Slice 2 and every DPX-OPS-001 slice since. */
@Module({
  imports: [PrismaModule, AuditModule, DriversModule],
  controllers: [
    OperationsFleetController,
    OperationsRidesController,
    OperationsQueuesController,
    OperationsCasesController,
    OperationsDashboardController,
    OperationsStaffController,
    OperationsAnalyticsController,
  ],
  providers: [
    OperationsFleetService,
    OperationsEligibilityService,
    OperationsRideQueueService,
    OperationsRideDetailService,
    OperationsDispatchSupportService,
    OperationsCasesService,
    OperationsDashboardService,
    OperationsAnalyticsService,
  ],
  exports: [
    OperationsFleetService,
    OperationsEligibilityService,
    OperationsRideQueueService,
    OperationsRideDetailService,
    OperationsDispatchSupportService,
    OperationsCasesService,
    OperationsDashboardService,
    OperationsAnalyticsService,
  ],
})
export class OperationsModule {}
