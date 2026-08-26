import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { JobParticipantsService } from './job-participants.service';

/**
 * The single answer to "who are the two parties of this job, and is it still
 * live?" — shared by chat (DPX-CHAT-001) and calling (DPX-MOBILE-002).
 *
 * Its own module rather than an export of `MessagingModule` so that calling
 * does not have to import all of messaging (and its `RidesModule` dependency)
 * to ask one question.
 */
@Module({
  imports: [PrismaModule],
  providers: [JobParticipantsService],
  exports: [JobParticipantsService],
})
export class JobParticipantsModule {}
