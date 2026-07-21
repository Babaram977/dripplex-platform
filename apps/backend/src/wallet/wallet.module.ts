import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';

import { AdminWalletController } from './admin-wallet.controller';
import { CustomerWalletController } from './customer-wallet.controller';
import { MerchantWalletController } from './merchant-wallet.controller';
import { RiderWalletController } from './rider-wallet.controller';
import { WalletEventsSubscriber } from './wallet-events.subscriber';
import { WalletService } from './wallet.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [
    CustomerWalletController,
    MerchantWalletController,
    RiderWalletController,
    AdminWalletController,
  ],
  providers: [WalletService, WalletEventsSubscriber],
  exports: [WalletService],
})
export class WalletModule {}
