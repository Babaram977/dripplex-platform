import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';

import { CustomerRidesController } from './controllers/customer-rides.controller';
import { DriverRidesController } from './controllers/driver-rides.controller';
import { RideDispatchService } from './ride-dispatch.service';
import { RIDE_EVENTS_PUBLISHER } from './ride-events.publisher';
import { RideFareService } from './ride-fare.service';
import { RideOfferSweepService } from './ride-offer-sweep.service';
import { RideTripService } from './ride-trip.service';
import { RideGateway } from './ride.gateway';
import { RidesService } from './rides.service';

@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule, AuthModule],
  controllers: [CustomerRidesController, DriverRidesController],
  providers: [
    RidesService,
    RideFareService,
    RideDispatchService,
    RideOfferSweepService,
    RideTripService,
    RideGateway,
    { provide: RIDE_EVENTS_PUBLISHER, useExisting: RideGateway },
  ],
  exports: [RidesService, RideFareService, RideDispatchService, RideTripService],
})
export class RidesModule {}
