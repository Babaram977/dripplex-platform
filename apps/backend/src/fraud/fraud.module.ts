import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';

import { AdminFraudController } from './admin-fraud.controller';
import { FraudEventSubscriber } from './fraud-event.subscriber';
import { FraudService } from './fraud.service';

@Module({
  imports: [PrismaModule, AuditModule, EventsModule],
  controllers: [AdminFraudController],
  providers: [FraudService, FraudEventSubscriber],
  exports: [FraudService],
})
export class FraudModule {}
