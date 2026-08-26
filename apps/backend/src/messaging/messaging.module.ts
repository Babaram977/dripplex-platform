import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { JobParticipantsModule } from '../job-participants/job-participants.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RidesModule } from '../rides/rides.module';

import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';

/** DPX-CHAT-001. RidesModule supplies RideGateway, which pushes a new message
 * to the recipient's socket so the other side sees it without polling.
 * JobParticipantsModule supplies the participant check that used to be private
 * here and is now shared with calling (DPX-MOBILE-002). */
@Module({
  imports: [PrismaModule, AuditModule, RidesModule, JobParticipantsModule],
  controllers: [MessagingController],
  providers: [MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
