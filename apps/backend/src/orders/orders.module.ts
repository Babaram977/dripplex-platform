import { Module } from '@nestjs/common';

import { AddressesModule } from '../addresses/addresses.module';
import { AuditModule } from '../audit/audit.module';
import { CartModule } from '../cart/cart.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductsModule } from '../products/products.module';

import { AdminOrdersController } from './admin-orders.controller';
import { CheckoutService } from './checkout.service';
import { CustomerOrdersController } from './customer-orders.controller';
import { CatalogCheckoutInventoryValidator } from './inventory/catalog-checkout-inventory.validator';
import { CHECKOUT_INVENTORY_VALIDATOR } from './inventory/checkout-inventory.validator';
import { InventoryReservationService } from './inventory/inventory-reservation.service';
import { CatalogCheckoutProductValidator } from './pricing/catalog-checkout-product.validator';
import { CHECKOUT_PRODUCT_VALIDATOR } from './pricing/checkout-product.validator';
import { CouponCalculator, ZeroCouponCalculator } from './pricing/coupon-calculator';
import { DeliveryCalculator, ZeroDeliveryCalculator } from './pricing/delivery-calculator';
import { TaxCalculator, ZeroTaxCalculator } from './pricing/tax-calculator';
import { ORDERS_REPOSITORY } from './repositories/orders.repository';
import { PrismaOrdersRepository } from './repositories/prisma-orders.repository';
import { ReservationCleanupService } from './reservation-cleanup.service';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    NotificationsModule,
    CartModule,
    AddressesModule,
    ProductsModule,
  ],
  controllers: [CustomerOrdersController, AdminOrdersController],
  providers: [
    CheckoutService,
    InventoryReservationService,
    ReservationCleanupService,
    { provide: ORDERS_REPOSITORY, useClass: PrismaOrdersRepository },
    { provide: TaxCalculator, useClass: ZeroTaxCalculator },
    { provide: DeliveryCalculator, useClass: ZeroDeliveryCalculator },
    { provide: CouponCalculator, useClass: ZeroCouponCalculator },
    { provide: CHECKOUT_PRODUCT_VALIDATOR, useClass: CatalogCheckoutProductValidator },
    {
      provide: CHECKOUT_INVENTORY_VALIDATOR,
      useClass: CatalogCheckoutInventoryValidator,
    },
  ],
  exports: [CheckoutService, InventoryReservationService, ORDERS_REPOSITORY],
})
export class OrdersModule {}
