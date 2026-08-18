import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AppConfigService } from '../config/app-config.service';
import { AppConfigModule } from '../config/config.module';
import { PaymentsModule } from '../payments/payments.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';

import { AdminUtilitiesController } from './admin-utilities.controller';
import { CustomerUtilitiesController } from './customer-utilities.controller';
import { NotConfiguredUtilityProvider } from './providers/not-configured-utility.provider';
import { PeyflexUtilityProvider } from './providers/peyflex.provider';
import { UTILITY_PROVIDER } from './providers/utility-provider.port';
import { UtilitiesService } from './utilities.service';

@Module({
  imports: [PrismaModule, AuditModule, AppConfigModule, WalletModule, PaymentsModule],
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
    UtilitiesService,
  ],
  exports: [UtilitiesService],
})
export class UtilitiesModule {}
