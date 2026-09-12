import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';

import { AdminDriverCampaignController } from './admin-driver-campaign.controller';
import { AdminReferralsController } from './admin-referrals.controller';
import { CampaignAttributionService } from './campaign-attribution.service';
import { CampaignPromoterService } from './campaign-promoter.service';
import { CustomerReferralsController } from './customer-referrals.controller';
import { DriverCampaignSweepService } from './driver-campaign-sweep.service';
import { DriverCampaignTripSubscriber } from './driver-campaign-trip.subscriber';
import { DriverCampaignController } from './driver-campaign.controller';
import { DriverCampaignService } from './driver-campaign.service';
import { DriverReferralsController } from './driver-referrals.controller';
import { FleetReferralsController } from './fleet-referrals.controller';
import { MerchantReferralsController } from './merchant-referrals.controller';
import { ReferralAntiAbuseService } from './referral-anti-abuse.service';
import { ReferralLifecycleSweepService } from './referral-lifecycle-sweep.service';
import { ReferralLifecycleService } from './referral-lifecycle.service';
import { ReferralQualificationService } from './referral-qualification.service';
import { ReferralRewardSubscriber } from './referral-reward.subscriber';
import { ReferralsService } from './referrals.service';
import { RiderReferralsController } from './rider-referrals.controller';

@Module({
  imports: [PrismaModule, AuditModule, EventsModule, WalletModule],
  controllers: [
    CustomerReferralsController,
    DriverReferralsController,
    RiderReferralsController,
    MerchantReferralsController,
    FleetReferralsController,
    AdminReferralsController,
    DriverCampaignController,
    AdminDriverCampaignController,
  ],
  providers: [
    ReferralsService,
    ReferralLifecycleService,
    ReferralLifecycleSweepService,
    ReferralQualificationService,
    ReferralAntiAbuseService,
    ReferralRewardSubscriber,
    DriverCampaignService,
    DriverCampaignTripSubscriber,
    DriverCampaignSweepService,
    CampaignPromoterService,
    CampaignAttributionService,
  ],
  exports: [
    ReferralsService,
    ReferralLifecycleService,
    DriverCampaignService,
    CampaignPromoterService,
    CampaignAttributionService,
  ],
})
export class ReferralsModule {}
