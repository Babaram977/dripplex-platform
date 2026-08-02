import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';

import { AdminDriverCampaignController } from './admin-driver-campaign.controller';
import { AdminReferralsController } from './admin-referrals.controller';
import { CustomerReferralsController } from './customer-referrals.controller';
import { DriverCampaignSweepService } from './driver-campaign-sweep.service';
import { DriverCampaignTripSubscriber } from './driver-campaign-trip.subscriber';
import { DriverCampaignController } from './driver-campaign.controller';
import { DriverCampaignService } from './driver-campaign.service';
import { ReferralRewardSubscriber } from './referral-reward.subscriber';
import { ReferralsService } from './referrals.service';

@Module({
  imports: [PrismaModule, AuditModule, EventsModule, WalletModule],
  controllers: [
    CustomerReferralsController,
    AdminReferralsController,
    DriverCampaignController,
    AdminDriverCampaignController,
  ],
  providers: [
    ReferralsService,
    ReferralRewardSubscriber,
    DriverCampaignService,
    DriverCampaignTripSubscriber,
    DriverCampaignSweepService,
  ],
  exports: [ReferralsService, DriverCampaignService],
})
export class ReferralsModule {}
