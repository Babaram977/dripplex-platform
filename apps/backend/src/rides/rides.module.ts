import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CommercialModule } from '../commercial/commercial.module';
import { DriversModule } from '../drivers/drivers.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { WalletModule } from '../wallet/wallet.module';

import { AdminRideReportsController } from './controllers/admin-ride-reports.controller';
import { CustomerRidesController } from './controllers/customer-rides.controller';
import { DriverRidesController } from './controllers/driver-rides.controller';
import { RideDispatchService } from './ride-dispatch.service';
import { RIDE_EVENTS_PUBLISHER } from './ride-events.publisher';
import { RideFareService } from './ride-fare.service';
import { RideOfferSweepService } from './ride-offer-sweep.service';
import { RidePaymentService } from './ride-payment.service';
import { RideProblemReportService } from './ride-problem-report.service';
import { RideRatingService } from './ride-rating.service';
import { RideReceiptService } from './ride-receipt.service';
import { RideTrackingReadService } from './ride-tracking-read.service';
import { RideTripService } from './ride-trip.service';
import { RideGateway } from './ride.gateway';
import { RidesService } from './rides.service';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    NotificationsModule,
    AuthModule,
    WalletModule,
    PaymentsModule,
    PromotionsModule,
    DriversModule,
    CommercialModule,
  ],
  controllers: [CustomerRidesController, DriverRidesController, AdminRideReportsController],
  providers: [
    RidesService,
    RideFareService,
    RideDispatchService,
    RideOfferSweepService,
    RideTripService,
    RidePaymentService,
    RideRatingService,
    RideReceiptService,
    RideProblemReportService,
    RideTrackingReadService,
    RideGateway,
    { provide: RIDE_EVENTS_PUBLISHER, useExisting: RideGateway },
  ],
  exports: [
    RidesService,
    RideFareService,
    RideDispatchService,
    RideTripService,
    RidePaymentService,
    RideRatingService,
    RideReceiptService,
    RideProblemReportService,
    RideTrackingReadService,
  ],
})
export class RidesModule {}
