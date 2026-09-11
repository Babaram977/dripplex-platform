import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { NotificationCenterModule } from '../notification-center/notification-center.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { WalletModule } from '../wallet/wallet.module';

import { AdminLoyaltyRewardsController } from './admin-loyalty-rewards.controller';
import { AdminLoyaltyController } from './admin-loyalty.controller';
import { CustomerLoyaltyRewardsController } from './customer-loyalty-rewards.controller';
import { CustomerLoyaltyController } from './customer-loyalty.controller';
import { LoyaltyEventsSubscriber } from './loyalty-events.subscriber';
import { LoyaltyExpirySweepService } from './loyalty-expiry-sweep.service';
import { LoyaltyRewardsService } from './loyalty-rewards.service';
import { LoyaltySettingsService } from './loyalty-settings.service';
import { LoyaltyStoreRedemptionService } from './loyalty-store-redemption.service';
import { LoyaltyService } from './loyalty.service';
import { MerchantLoyaltyController } from './merchant-loyalty.controller';

@Module({
  imports: [PrismaModule, AuditModule, WalletModule, NotificationCenterModule, PromotionsModule],
  controllers: [
    CustomerLoyaltyController,
    CustomerLoyaltyRewardsController,
    MerchantLoyaltyController,
    AdminLoyaltyController,
    AdminLoyaltyRewardsController,
  ],
  providers: [
    LoyaltyService,
    LoyaltySettingsService,
    LoyaltyStoreRedemptionService,
    LoyaltyRewardsService,
    LoyaltyEventsSubscriber,
    LoyaltyExpirySweepService,
  ],
  exports: [
    LoyaltyService,
    LoyaltySettingsService,
    LoyaltyStoreRedemptionService,
    LoyaltyRewardsService,
  ],
})
export class LoyaltyModule {}
