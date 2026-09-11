import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { NotificationCenterModule } from '../notification-center/notification-center.module';
import { PrismaModule } from '../prisma/prisma.module';

import { CommercialCreditSettingsService } from './commercial-credit-settings.service';
import { CommissionAccountService } from './commission-account.service';
import { CommissionCampaignSweepService } from './commission-campaign-sweep.service';
import { CommissionCampaignService } from './commission-campaign.service';
import { CommissionRateResolverService } from './commission-rate-resolver.service';
import { AdminCommercialCreditSettingsController } from './controllers/admin-commercial-credit-settings.controller';
import { AdminCommissionAccountsController } from './controllers/admin-commission-accounts.controller';
import { AdminCommissionCampaignsController } from './controllers/admin-commission-campaigns.controller';
import { AdminCommissionRosterController } from './controllers/admin-commission-roster.controller';
import { AdminPlatformCommissionSettingsController } from './controllers/admin-platform-commission-settings.controller';
import { DriverCommercialController } from './controllers/driver-commercial.controller';
import { MerchantCommercialController } from './controllers/merchant-commercial.controller';
import { PartnerPositionService } from './partner-position.service';
import { PlatformCommissionSettingsService } from './platform-commission-settings.service';

/**
 * DPX-COMMERCIAL-001 — the shared commercial engine (commission credit
 * accounts, admin-configurable credit limits) spanning Marketplace and
 * Ride/Delivery. Admin read/manage (Slice 1) plus merchant/driver
 * self-read (Slice 5) controllers live here; the real accrual call
 * sites (Slice 2-4) live in orders/rides, calling back into
 * CommissionAccountService exported below. See
 * docs/DPX-COMMERCIAL-001-REVENUE-SETTLEMENT-CREDIT-POLICY.md.
 */
@Module({
  imports: [PrismaModule, AuditModule, NotificationCenterModule],
  controllers: [
    AdminCommercialCreditSettingsController,
    AdminCommissionRosterController,
    AdminCommissionAccountsController,
    AdminPlatformCommissionSettingsController,
    AdminCommissionCampaignsController,
    MerchantCommercialController,
    DriverCommercialController,
  ],
  providers: [
    CommercialCreditSettingsService,
    CommissionAccountService,
    PartnerPositionService,
    PlatformCommissionSettingsService,
    CommissionCampaignService,
    CommissionCampaignSweepService,
    CommissionRateResolverService,
  ],
  exports: [
    CommercialCreditSettingsService,
    CommissionAccountService,
    PlatformCommissionSettingsService,
    CommissionRateResolverService,
  ],
})
export class CommercialModule {}
