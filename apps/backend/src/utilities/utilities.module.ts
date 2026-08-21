import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AppConfigService } from '../config/app-config.service';
import { AppConfigModule } from '../config/config.module';
import { NotificationCenterModule } from '../notification-center/notification-center.module';
import { PaymentsModule } from '../payments/payments.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';

import { AdminUtilitiesController } from './admin-utilities.controller';
import { CustomerUtilitiesController } from './customer-utilities.controller';
import { NotConfiguredUtilityProvider } from './providers/not-configured-utility.provider';
import { PeyflexUtilityProvider } from './providers/peyflex.provider';
import { UTILITY_PROVIDER } from './providers/utility-provider.port';
import { UtilitiesService } from './utilities.service';
import { UtilityCustomerNotifier } from './utility-customer-notifier.service';
import { UtilityPaymentSweepService } from './utility-payment-sweep.service';
import { UtilityPaymentSubscriber } from './utility-payment.subscriber';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    AppConfigModule,
    WalletModule,
    PaymentsModule,
    // Peyflex answers late or not at all, so the customer has to be told when
    // a purchase finally resolves — they are not watching the screen by then.
    NotificationCenterModule,
  ],
  controllers: [CustomerUtilitiesController, AdminUtilitiesController],
  providers: [
    PeyflexUtilityProvider,
    NotConfiguredUtilityProvider,
    {
      // Peyflex only when a token exists; otherwise the adapter that refuses
      // every call with one honest message. The feature ships deployed but
      // disabled rather than deployed and broken — the same pattern
      // MERCHANT_MODULE_ENABLED uses.
      provide: UTILITY_PROVIDER,
      useFactory: (
        config: AppConfigService,
        peyflex: PeyflexUtilityProvider,
        notConfigured: NotConfiguredUtilityProvider,
      ) => (config.peyflexConfigured ? peyflex : notConfigured),
      inject: [AppConfigService, PeyflexUtilityProvider, NotConfiguredUtilityProvider],
    },
    UtilityCustomerNotifier,
    UtilitiesService,
    // DomainEventBus comes from the @Global() EventsModule, so no import here.
    UtilityPaymentSubscriber,
    // The trigger that does not depend on an event arriving. Both of the
    // others do, and when neither fires a customer is charged and gets
    // nothing.
    UtilityPaymentSweepService,
  ],
  exports: [UtilitiesService],
})
export class UtilitiesModule {}
