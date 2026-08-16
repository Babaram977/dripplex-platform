import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RidesModule } from '../rides/rides.module';

import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';

/** DPX-CHAT-001. RidesModule supplies RideGateway, which pushes a new message
 * to the recipient's socket so the other side sees it without polling. */
@Module({
  imports: [PrismaModule, AuditModule, RidesModule],
  controllers: [MessagingController],
  providers: [MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
