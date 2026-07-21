import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';

import { AdminLoyaltyController } from './admin-loyalty.controller';
import { CustomerLoyaltyController } from './customer-loyalty.controller';
import { LoyaltyEventsSubscriber } from './loyalty-events.subscriber';
import { LoyaltyService } from './loyalty.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [CustomerLoyaltyController, AdminLoyaltyController],
  providers: [LoyaltyService, LoyaltyEventsSubscriber],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
