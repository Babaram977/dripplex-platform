import { Module } from '@nestjs/common';

import { AddressesModule } from '../addresses/addresses.module';
import { AuditModule } from '../audit/audit.module';
import { CommercialModule } from '../commercial/commercial.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';

import { AdminDeliveryController } from './admin-delivery.controller';
import { AssignmentService } from './assignment.service';
import { CustomerDeliveryController } from './customer-delivery.controller';
import { DeliveryDispatchSweepService } from './delivery-dispatch-sweep.service';
import { DeliveryFeeService } from './delivery-fee.service';
import { DeliveryService } from './delivery.service';
import { OrderReadySubscriber } from './order-ready.subscriber';
import { DELIVERY_REPOSITORY } from './repositories/delivery.repository';
import { PrismaDeliveryRepository } from './repositories/prisma-delivery.repository';
import { RiderDeliveryController } from './rider-delivery.controller';
import { RiderSettlementService } from './rider-settlement.service';
import { RiderSettlementSubscriber } from './rider-settlement.subscriber';
import { TrackingService } from './tracking.service';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    NotificationsModule,
    AddressesModule,
    OrdersModule,
    // DPX-RIDER-006 — paying the rider needs the wallet (prepaid) and the
    // commission account + platform rate (cash).
    WalletModule,
    CommercialModule,
  ],
  controllers: [CustomerDeliveryController, RiderDeliveryController, AdminDeliveryController],
  providers: [
    DeliveryService,
    DeliveryFeeService,
    AssignmentService,
    TrackingService,
    OrderReadySubscriber,
    DeliveryDispatchSweepService,
    RiderSettlementService,
    RiderSettlementSubscriber,
    {
      provide: DELIVERY_REPOSITORY,
      useClass: PrismaDeliveryRepository,
    },
  ],
  exports: [
    DeliveryService,
    DeliveryFeeService,
    AssignmentService,
    TrackingService,
    RiderSettlementService,
  ],
})
export class DeliveryModule {}
