import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';

import { CommercialCreditSettingsService } from './commercial-credit-settings.service';
import { CommissionAccountService } from './commission-account.service';
import { AdminCommercialCreditSettingsController } from './controllers/admin-commercial-credit-settings.controller';
import { AdminCommissionAccountsController } from './controllers/admin-commission-accounts.controller';

/**
 * DPX-COMMERCIAL-001 — the shared commercial engine (commission credit
 * accounts, admin-configurable credit limits) spanning Marketplace and
 * Ride/Delivery. Slice 1 only: schema + settings + admin-manual payment
 * recording, no real accrual call site wired yet. See
 * docs/DPX-COMMERCIAL-001-REVENUE-SETTLEMENT-CREDIT-POLICY.md.
 */
@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [AdminCommercialCreditSettingsController, AdminCommissionAccountsController],
  providers: [CommercialCreditSettingsService, CommissionAccountService],
  exports: [CommercialCreditSettingsService, CommissionAccountService],
})
export class CommercialModule {}
