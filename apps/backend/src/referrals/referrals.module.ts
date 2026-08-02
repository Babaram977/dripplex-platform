import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';

import { AdminReferralsController } from './admin-referrals.controller';
import { CustomerReferralsController } from './customer-referrals.controller';
import { ReferralRewardSubscriber } from './referral-reward.subscriber';
import { ReferralsService } from './referrals.service';

@Module({
  imports: [PrismaModule, AuditModule, EventsModule, WalletModule],
  controllers: [CustomerReferralsController, AdminReferralsController],
  providers: [ReferralsService, ReferralRewardSubscriber],
  exports: [ReferralsService],
})
export class ReferralsModule {}
