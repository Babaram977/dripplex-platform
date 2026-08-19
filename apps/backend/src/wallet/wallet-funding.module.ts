import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AppConfigModule } from '../config/config.module';
import { PaymentsModule } from '../payments/payments.module';
import { PrismaModule } from '../prisma/prisma.module';

import { CustomerWalletFundingController } from './customer-wallet-funding.controller';
import { WalletFundingService } from './wallet-funding.service';
import { WalletFundingSubscriber } from './wallet-funding.subscriber';
import { WalletModule } from './wallet.module';

/**
 * Separate from WalletModule to avoid a circular import: WalletFundingService
 * needs PAYMENT_PROVIDER_ADAPTERS from PaymentsModule, and PaymentsModule
 * already imports WalletModule (for WalletService — see the DI-boot-failure
 * fix in payments.module.ts). This module sits above both instead of
 * either depending on the other.
 */
@Module({
  imports: [PrismaModule, AuditModule, AppConfigModule, WalletModule, PaymentsModule],
  controllers: [CustomerWalletFundingController],
  // DomainEventBus comes from the @Global() EventsModule, so no import here.
  providers: [WalletFundingService, WalletFundingSubscriber],
})
export class WalletFundingModule {}
