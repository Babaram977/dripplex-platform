import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { OperationsFleetController } from './controllers/operations-fleet.controller';
import { OperationsRidesController } from './controllers/operations-rides.controller';
import { OperationsFleetService } from './operations-fleet.service';
import { OperationsRideQueueService } from './operations-ride-queue.service';

/** DPX-OPS-001 — Operations Command Centre backend. Slice 1 (Live
 * Operations Dashboard): read-only fleet snapshot and live ride queue,
 * composed entirely from existing tables (`DriverProfile`,
 * `DriverAvailability`, `Vehicle`, `Inspection`, `DriverShift`, `SosAlert`,
 * `Ride`) via direct Prisma reads — no new schema, no migration, no writes.
 * `apps/backend/src/rides/` is a frozen module and is never imported or
 * modified here; `Ride` is read directly via `PrismaService`, the same
 * cross-module-read pattern established throughout Driver Slice 2. */
@Module({
  imports: [PrismaModule],
  controllers: [OperationsFleetController, OperationsRidesController],
  providers: [OperationsFleetService, OperationsRideQueueService],
  exports: [OperationsFleetService, OperationsRideQueueService],
})
export class OperationsModule {}
