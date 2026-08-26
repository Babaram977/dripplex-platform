import { Module } from '@nestjs/common';

import { AppConfigService } from '../config/app-config.service';
import { EventsModule } from '../events/events.module';
import { JobParticipantsModule } from '../job-participants/job-participants.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RidesModule } from '../rides/rides.module';

import { CallSweepService } from './call-sweep.service';
import {
  CALL_TOKEN_MINTER,
  NotConfiguredCallTokenMinter,
  type CallTokenMinter,
} from './call-token.provider';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';
import { CancelledJobCallSubscriber } from './cancelled-job-call.subscriber';
import { LiveKitCallTokenMinter } from './livekit-call-token.minter';

/**
 * DPX-MOBILE-002 — in-app voice calling, backend half.
 *
 * The minter binds to LiveKit only when all three credentials resolve, exactly
 * as `PUSH_PROVIDER` binds to Firebase. Until a LiveKit deployment exists this
 * module loads, its routes exist and every authorisation path is exercised by
 * tests — a call attempt simply answers "Calling is not available" rather than
 * the process failing to boot or a driver hitting a 500 mid-shift.
 *
 * RidesModule supplies RideGateway, whose `user:{id}` rooms carry the ring,
 * accept and end notifications. No new socket transport: the gateway already
 * authenticates on connect and joins every user to their own room.
 */
@Module({
  imports: [PrismaModule, JobParticipantsModule, RidesModule, EventsModule],
  controllers: [CallsController],
  providers: [
    CallsService,
    CallSweepService,
    CancelledJobCallSubscriber,
    {
      provide: CALL_TOKEN_MINTER,
      useFactory: (config: AppConfigService): CallTokenMinter => {
        if (!config.livekitConfigured) {
          return new NotConfiguredCallTokenMinter();
        }
        return new LiveKitCallTokenMinter(
          config.livekitUrl,
          config.livekitApiKey,
          config.livekitApiSecret,
        );
      },
      inject: [AppConfigService],
    },
  ],
  exports: [CallsService],
})
export class CallsModule {}
