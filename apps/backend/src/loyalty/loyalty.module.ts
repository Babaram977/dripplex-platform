import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { NotificationCenterModule } from '../notification-center/notification-center.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';

import { AdminLoyaltyController } from './admin-loyalty.controller';
import { CustomerLoyaltyController } from './customer-loyalty.controller';
import { LoyaltyEventsSubscriber } from './loyalty-events.subscriber';
import { LoyaltyExpirySweepService } from './loyalty-expiry-sweep.service';
import { LoyaltyStoreRedemptionService } from './loyalty-store-redemption.service';
import { LoyaltyService } from './loyalty.service';
import { MerchantLoyaltyController } from './merchant-loyalty.controller';

@Module({
  imports: [PrismaModule, AuditModule, WalletModule, NotificationCenterModule],
  controllers: [CustomerLoyaltyController, MerchantLoyaltyController, AdminLoyaltyController],
  providers: [
    LoyaltyService,
    LoyaltyStoreRedemptionService,
    LoyaltyEventsSubscriber,
    LoyaltyExpirySweepService,
  ],
  exports: [LoyaltyService, LoyaltyStoreRedemptionService],
})
export class LoyaltyModule {}
