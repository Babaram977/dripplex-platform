import { Module } from '@nestjs/common';

import { AddressesModule } from '../addresses/addresses.module';
import { AuditModule } from '../audit/audit.module';
import { CartModule } from '../cart/cart.module';
import { CommercialModule } from '../commercial/commercial.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PricingModule } from '../pricing/pricing.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductsModule } from '../products/products.module';
import { UploadsModule } from '../uploads/uploads.module';
import { WalletModule } from '../wallet/wallet.module';

import { AdminOrdersController } from './admin-orders.controller';
import { CheckoutService } from './checkout.service';
import { AdminMerchantCommissionSettingsController } from './controllers/admin-merchant-commission-settings.controller';
import { MerchantSettlementsController } from './controllers/merchant-settlements.controller';
import { CustomerOrdersController } from './customer-orders.controller';
import { CatalogCheckoutInventoryValidator } from './inventory/catalog-checkout-inventory.validator';
import { CHECKOUT_INVENTORY_VALIDATOR } from './inventory/checkout-inventory.validator';
import { InventoryReservationService } from './inventory/inventory-reservation.service';
import { MerchantCommissionSettingsService } from './merchant-commission-settings.service';
import { MerchantOrdersController } from './merchant-orders.controller';
import { MerchantOrdersService } from './merchant-orders.service';
import { MerchantSettlementService } from './merchant-settlement.service';
import { OrderCompletionSweepService } from './order-completion-sweep.service';
import { OrderPaymentProofService } from './order-payment-proof.service';
import { CatalogCheckoutProductValidator } from './pricing/catalog-checkout-product.validator';
import { CHECKOUT_PRODUCT_VALIDATOR } from './pricing/checkout-product.validator';
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
    WalletModule,
    PricingModule,
    CommercialModule,
    UploadsModule,
  ],
  controllers: [
    CustomerOrdersController,
    AdminOrdersController,
    MerchantOrdersController,
    AdminMerchantCommissionSettingsController,
    MerchantSettlementsController,
  ],
  providers: [
    CheckoutService,
    MerchantOrdersService,
    InventoryReservationService,
    ReservationCleanupService,
    OrderCompletionSweepService,
    MerchantCommissionSettingsService,
    MerchantSettlementService,
    OrderPaymentProofService,
    { provide: ORDERS_REPOSITORY, useClass: PrismaOrdersRepository },
    { provide: CHECKOUT_PRODUCT_VALIDATOR, useClass: CatalogCheckoutProductValidator },
    {
      provide: CHECKOUT_INVENTORY_VALIDATOR,
      useClass: CatalogCheckoutInventoryValidator,
    },
  ],
  exports: [CheckoutService, InventoryReservationService, ORDERS_REPOSITORY],
})
export class OrdersModule {}
