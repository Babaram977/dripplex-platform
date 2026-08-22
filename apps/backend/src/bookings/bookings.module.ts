import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AppConfigModule } from '../config/config.module';
import { NotificationCenterModule } from '../notification-center/notification-center.module';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';

import { AdminBookingsController } from './admin-bookings.controller';
import { BookingCustomerNotifier } from './booking-customer-notifier.service';
import { BookingExpirySweepService } from './booking-expiry-sweep.service';
import { BookingSettlementSweepService } from './booking-settlement-sweep.service';
import { BookingSettlementService } from './booking-settlement.service';
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
  imports: [
    PrismaModule,
    AuditModule,
    WalletModule,
    OrdersModule,
    // The guest pays through the DrippleX gateway (founder decision
    // 2026-08-22), so bookings need the same payment adapters orders use.
    PaymentsModule,
    // Slice E: a guest is told what happened to their booking, since every
    // state change is decided by somebody else while they are not watching.
    NotificationCenterModule,
    AppConfigModule,
  ],
  controllers: [CustomerBookingsController, MerchantBookingsController, AdminBookingsController],
  providers: [
    RoomInventoryService,
    BookingsService,
    BookingCustomerNotifier,
    BookingExpirySweepService,
    BookingSettlementService,
    BookingSettlementSweepService,
  ],
  exports: [RoomInventoryService, BookingsService, BookingSettlementService],
})
export class BookingsModule {}
