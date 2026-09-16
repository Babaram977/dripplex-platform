import { Module } from '@nestjs/common';

import { AddressesModule } from '../addresses/addresses.module';
import { AuditModule } from '../audit/audit.module';
import { CartModule } from '../cart/cart.module';
import { CommercialModule } from '../commercial/commercial.module';
import { NotificationCenterModule } from '../notification-center/notification-center.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PricingModule } from '../pricing/pricing.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductsModule } from '../products/products.module';
import { UploadsModule } from '../uploads/uploads.module';
import { WalletModule } from '../wallet/wallet.module';

import { AdminOrderRecoveryController } from './admin-order-recovery.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { CheckoutService } from './checkout.service';
import { AdminMerchantCommissionSettingsController } from './controllers/admin-merchant-commission-settings.controller';
import { MerchantSettlementsController } from './controllers/merchant-settlements.controller';
import { CustomerOrdersController } from './customer-orders.controller';
import { CatalogCheckoutInventoryValidator } from './inventory/catalog-checkout-inventory.validator';
import { CHECKOUT_INVENTORY_VALIDATOR } from './inventory/checkout-inventory.validator';
import { InventoryReservationService } from './inventory/inventory-reservation.service';
import { MerchantBankSettlementWebhookController } from './merchant-bank-settlement-webhook.controller';
import { MerchantBankSettlementService } from './merchant-bank-settlement.service';
import { MerchantCommissionSettingsService } from './merchant-commission-settings.service';
import { MerchantOrdersController } from './merchant-orders.controller';
import { MerchantOrdersService } from './merchant-orders.service';
import { MerchantSettlementService } from './merchant-settlement.service';
import { OrderCompletionSweepService } from './order-completion-sweep.service';
import { OrderExceptionSweepService } from './order-exception-sweep.service';
import { OrderPaymentProofService } from './order-payment-proof.service';
import { OrderRecoveryService } from './order-recovery.service';
import { CatalogCheckoutProductValidator } from './pricing/catalog-checkout-product.validator';
import { CHECKOUT_PRODUCT_VALIDATOR } from './pricing/checkout-product.validator';
import { ORDER_RECOVERY_REPOSITORY } from './repositories/order-recovery.repository';
import { ORDERS_REPOSITORY } from './repositories/orders.repository';
import { PrismaOrderRecoveryRepository } from './repositories/prisma-order-recovery.repository';
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
    NotificationCenterModule,
  ],
  controllers: [
    AdminOrderRecoveryController,
    CustomerOrdersController,
    AdminOrdersController,
    MerchantOrdersController,
    AdminMerchantCommissionSettingsController,
    MerchantSettlementsController,
    MerchantBankSettlementWebhookController,
  ],
  providers: [
    CheckoutService,
    MerchantOrdersService,
    InventoryReservationService,
    ReservationCleanupService,
    OrderCompletionSweepService,
    OrderExceptionSweepService,
    MerchantCommissionSettingsService,
    MerchantSettlementService,
    MerchantBankSettlementService,
    OrderPaymentProofService,
    { provide: ORDERS_REPOSITORY, useClass: PrismaOrdersRepository },
    // DPX-ORDER-8D-RECOVERY Increment 1 — case file only. No sweep is
    // registered and no caller invokes recognition, so this ships inert.
    { provide: ORDER_RECOVERY_REPOSITORY, useClass: PrismaOrderRecoveryRepository },
    OrderRecoveryService,
    { provide: CHECKOUT_PRODUCT_VALIDATOR, useClass: CatalogCheckoutProductValidator },
    { provide: CHECKOUT_INVENTORY_VALIDATOR, useClass: CatalogCheckoutInventoryValidator },
  ],
  // MerchantOrdersService is exported so the POS order-sync route drives the
  // order lifecycle through the merchant's own service rather than through a
  // second state machine of its own. Nothing about the lifecycle — its
  // preconditions, its notifications, its refunds — is reimplemented elsewhere.
  exports: [
    CheckoutService,
    InventoryReservationService,
    ORDERS_REPOSITORY,
    ORDER_RECOVERY_REPOSITORY,
    OrderRecoveryService,
    MerchantCommissionSettingsService,
    MerchantOrdersService,
  ],
})
export class OrdersModule {}
