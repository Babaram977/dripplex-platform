import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { DriversModule } from '../drivers/drivers.module';
import { PrismaModule } from '../prisma/prisma.module';

import { OperationsCasesController } from './controllers/operations-cases.controller';
import { OperationsDashboardController } from './controllers/operations-dashboard.controller';
import { OperationsFleetController } from './controllers/operations-fleet.controller';
import { OperationsQueuesController } from './controllers/operations-queues.controller';
import { OperationsRidesController } from './controllers/operations-rides.controller';
import { OperationsStaffController } from './controllers/operations-staff.controller';
import { OperationsCasesService } from './operations-cases.service';
import { OperationsDashboardService } from './operations-dashboard.service';
import { OperationsFleetService } from './operations-fleet.service';
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
 * `apps/backend/src/rides/` is a frozen module and is never imported or
 * modified here; `Ride` is read directly via `PrismaService`, the same
 * cross-module-read pattern established throughout Driver Slice 2. */
@Module({
  imports: [PrismaModule, AuditModule, DriversModule],
  controllers: [
    OperationsFleetController,
    OperationsRidesController,
    OperationsQueuesController,
    OperationsCasesController,
    OperationsDashboardController,
    OperationsStaffController,
  ],
  providers: [
    OperationsFleetService,
    OperationsRideQueueService,
    OperationsCasesService,
    OperationsDashboardService,
  ],
  exports: [
    OperationsFleetService,
    OperationsRideQueueService,
    OperationsCasesService,
    OperationsDashboardService,
  ],
})
export class OperationsModule {}
