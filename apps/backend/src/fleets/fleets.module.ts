import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { CommercialModule } from '../commercial/commercial.module';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';

import { AdminFleetsController } from './controllers/admin-fleets.controller';
import { FleetFinancialController } from './controllers/fleet-financial.controller';
import { FleetOwnerController } from './controllers/fleet-owner.controller';
import { FleetSelfServiceController } from './controllers/fleet-self-service.controller';
import { FleetCommissionService } from './fleet-commission.service';
import { FleetFinancialService } from './fleet-financial.service';
import { FleetJobSubscriber } from './fleet-job.subscriber';
import { FleetOverviewService } from './fleet-overview.service';
import { FleetsService } from './fleets.service';

@Module({
  imports: [PrismaModule, AuditModule, CommercialModule, EventsModule, WalletModule],
  controllers: [FleetSelfServiceController, FleetOwnerController, FleetFinancialController, AdminFleetsController],
  providers: [FleetsService, FleetOverviewService, FleetCommissionService, FleetJobSubscriber, FleetFinancialService],
  exports: [FleetsService, FleetOverviewService, FleetCommissionService, FleetFinancialService],
})
export class FleetsModule {}
