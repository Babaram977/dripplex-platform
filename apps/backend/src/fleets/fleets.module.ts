import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { CommercialModule } from '../commercial/commercial.module';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { WalletModule } from '../wallet/wallet.module';

import { AdminFleetSettlementController } from './controllers/admin-fleet-settlement.controller';
import { AdminFleetsController } from './controllers/admin-fleets.controller';
import { FleetFinancialController } from './controllers/fleet-financial.controller';
import { FleetOwnerController } from './controllers/fleet-owner.controller';
import { FleetSelfServiceController } from './controllers/fleet-self-service.controller';
import { FleetCommissionBackfillService } from './fleet-commission-backfill.service';
import { FleetCommissionService } from './fleet-commission.service';
import { FleetFinancialService } from './fleet-financial.service';
import { FleetJobSubscriber } from './fleet-job.subscriber';
import { FleetOverviewService } from './fleet-overview.service';
import { FleetsService } from './fleets.service';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    CommercialModule,
    EventsModule,
    WalletModule,
    // DPX-REFERRAL-003 — a fleet owner can quote a referral code when they
    // register their company, which is the only place a fleet signup can be
    // attributed to whoever brought it.
    ReferralsModule,
  ],
  controllers: [
    FleetSelfServiceController,
    FleetOwnerController,
    FleetFinancialController,
    AdminFleetsController,
    AdminFleetSettlementController,
  ],
  providers: [
    FleetsService,
    FleetOverviewService,
    FleetCommissionService,
    FleetCommissionBackfillService,
    FleetJobSubscriber,
    FleetFinancialService,
  ],
  exports: [FleetsService, FleetOverviewService, FleetCommissionService, FleetFinancialService],
})
export class FleetsModule {}
