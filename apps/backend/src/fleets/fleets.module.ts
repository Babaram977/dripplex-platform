import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { CommercialModule } from '../commercial/commercial.module';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';

import { AdminFleetsController } from './controllers/admin-fleets.controller';
import { FleetOwnerController } from './controllers/fleet-owner.controller';
import { FleetCommissionService } from './fleet-commission.service';
import { FleetJobSubscriber } from './fleet-job.subscriber';
import { FleetOverviewService } from './fleet-overview.service';
import { FleetsService } from './fleets.service';

/**
 * DPX-FLEET — fleet owners, their riders and drivers, and what they owe.
 *
 * Founder decision, 2026-08-30, modelled on Talabat: the fleet owns the
 * vehicles, employs the riders and agrees their pay privately; DrippleX
 * supplies the demand and charges the fleet a percentage of the delivery fees
 * its members earned, at a rate that improves with monthly volume.
 *
 * `CommercialModule` is imported rather than reimplemented: a fleet accrues,
 * owes, is credit-limited and blocked exactly like a merchant, so it uses the
 * same `CommissionAccount` machinery under a new owner type instead of a
 * parallel ledger nobody would remember to reconcile.
 *
 * Nothing here touches KYC, identity verification or onboarding. A fleet says
 * who it employs; DrippleX still says who may work, through the checks that
 * already exist.
 */
@Module({
  imports: [PrismaModule, AuditModule, CommercialModule, EventsModule],
  controllers: [FleetOwnerController, AdminFleetsController],
  providers: [FleetsService, FleetOverviewService, FleetCommissionService, FleetJobSubscriber],
  exports: [FleetsService, FleetOverviewService, FleetCommissionService],
})
export class FleetsModule {}
