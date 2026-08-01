import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';

import { CustomerRidesController } from './controllers/customer-rides.controller';
import { DriverRidesController } from './controllers/driver-rides.controller';
import { RideDispatchService } from './ride-dispatch.service';
import { RideFareService } from './ride-fare.service';
import { RideOfferSweepService } from './ride-offer-sweep.service';
import { RidesService } from './rides.service';

@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule],
  controllers: [CustomerRidesController, DriverRidesController],
  providers: [RidesService, RideFareService, RideDispatchService, RideOfferSweepService],
  exports: [RidesService, RideFareService, RideDispatchService],
})
export class RidesModule {}
