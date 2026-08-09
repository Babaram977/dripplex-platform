import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';

import { CommercialCreditSettingsService } from './commercial-credit-settings.service';
import { CommissionAccountService } from './commission-account.service';
import { AdminCommercialCreditSettingsController } from './controllers/admin-commercial-credit-settings.controller';
import { AdminCommissionAccountsController } from './controllers/admin-commission-accounts.controller';
import { AdminPlatformCommissionSettingsController } from './controllers/admin-platform-commission-settings.controller';
import { DriverCommercialController } from './controllers/driver-commercial.controller';
import { MerchantCommercialController } from './controllers/merchant-commercial.controller';
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
  imports: [PrismaModule, AuditModule],
  controllers: [
    AdminCommercialCreditSettingsController,
    AdminCommissionAccountsController,
    AdminPlatformCommissionSettingsController,
    MerchantCommercialController,
    DriverCommercialController,
  ],
  providers: [
    CommercialCreditSettingsService,
    CommissionAccountService,
    PlatformCommissionSettingsService,
  ],
  exports: [
    CommercialCreditSettingsService,
    CommissionAccountService,
    PlatformCommissionSettingsService,
  ],
})
export class CommercialModule {}
