import { Module } from '@nestjs/common';

import { AddressesModule } from '../addresses/addresses.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';
import { PrismaModule } from '../prisma/prisma.module';

import { AdminDeliveryController } from './admin-delivery.controller';
import { AssignmentService } from './assignment.service';
import { CustomerDeliveryController } from './customer-delivery.controller';
import { DeliveryFeeService } from './delivery-fee.service';
import { DeliveryService } from './delivery.service';
import { DELIVERY_REPOSITORY } from './repositories/delivery.repository';
import { PrismaDeliveryRepository } from './repositories/prisma-delivery.repository';
import { RiderDeliveryController } from './rider-delivery.controller';
import { TrackingService } from './tracking.service';

@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule, AddressesModule, OrdersModule],
  controllers: [CustomerDeliveryController, RiderDeliveryController, AdminDeliveryController],
  providers: [
    DeliveryService,
    DeliveryFeeService,
    AssignmentService,
    TrackingService,
    {
      provide: DELIVERY_REPOSITORY,
      useClass: PrismaDeliveryRepository,
    },
  ],
  exports: [DeliveryService, DeliveryFeeService, AssignmentService, TrackingService],
})
export class DeliveryModule {}
