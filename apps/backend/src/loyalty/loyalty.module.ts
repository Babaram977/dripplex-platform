import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';

import { AdminLoyaltyController } from './admin-loyalty.controller';
import { CustomerLoyaltyController } from './customer-loyalty.controller';
import { LoyaltyEventsSubscriber } from './loyalty-events.subscriber';
import { LoyaltyExpirySweepService } from './loyalty-expiry-sweep.service';
import { LoyaltyService } from './loyalty.service';

@Module({
  imports: [PrismaModule, AuditModule, WalletModule],
  controllers: [CustomerLoyaltyController, AdminLoyaltyController],
  providers: [LoyaltyService, LoyaltyEventsSubscriber, LoyaltyExpirySweepService],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
