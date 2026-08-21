import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { OrdersModule } from '../orders/orders.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';

import { AdminBookingsController } from './admin-bookings.controller';
import { BookingExpirySweepService } from './booking-expiry-sweep.service';
import { BookingsService } from './bookings.service';
import { CustomerBookingsController } from './customer-bookings.controller';
import { MerchantBookingsController } from './merchant-bookings.controller';
import { RoomInventoryService } from './room-inventory.service';

/**
 * DPX-HOTEL-001 — hotel booking on the merchant rails.
 *
 * OrdersModule is imported for `MerchantCommissionSettingsService`, the
 * Ops-adjustable 10% rate founder decision 4 points at. Reused rather than
 * duplicated: a hotel is a merchant, and two rates that could drift apart is
 * exactly what "the existing commission config, no new mechanism" rules out.
 */
@Module({
  imports: [PrismaModule, AuditModule, WalletModule, OrdersModule],
  controllers: [CustomerBookingsController, MerchantBookingsController, AdminBookingsController],
  providers: [RoomInventoryService, BookingsService, BookingExpirySweepService],
  exports: [RoomInventoryService, BookingsService],
})
export class BookingsModule {}
