import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { CartModule } from '../cart/cart.module';
import { AppConfigModule } from '../config/config.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';
import { PrismaModule } from '../prisma/prisma.module';

import { CustomerPaymentsController } from './customer-payments.controller';
import {
  INVENTORY_DEDUCTION_SERVICE,
  ReservationBackedInventoryDeductionService,
} from './inventory-deduction.service';
import { PaymentWebhooksController } from './payment-webhooks.controller';
import { PaymentService } from './payment.service';
import { FlutterwaveProvider } from './providers/flutterwave.provider';
import { MoniepointProvider } from './providers/moniepoint.provider';
import { PAYMENT_PROVIDER_ADAPTERS } from './providers/payment-provider.adapter';
import { PaystackProvider } from './providers/paystack.provider';
import { PAYMENT_TRANSACTION_REPOSITORY } from './repositories/payment-transaction.repository';
import { PrismaPaymentTransactionRepository } from './repositories/prisma-payment-transaction.repository';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    NotificationsModule,
    OrdersModule,
    CartModule,
    AppConfigModule,
  ],
  controllers: [CustomerPaymentsController, PaymentWebhooksController],
  providers: [
    PaymentService,
    PaystackProvider,
    FlutterwaveProvider,
    MoniepointProvider,
    {
      provide: PAYMENT_PROVIDER_ADAPTERS,
      useFactory: (
        paystack: PaystackProvider,
        flutterwave: FlutterwaveProvider,
        moniepoint: MoniepointProvider,
      ) => [paystack, flutterwave, moniepoint],
      inject: [PaystackProvider, FlutterwaveProvider, MoniepointProvider],
    },
    {
      provide: PAYMENT_TRANSACTION_REPOSITORY,
      useClass: PrismaPaymentTransactionRepository,
    },
    {
      provide: INVENTORY_DEDUCTION_SERVICE,
      useClass: ReservationBackedInventoryDeductionService,
    },
  ],
  exports: [PaymentService],
})
export class PaymentsModule {}
