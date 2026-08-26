import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { CALL_SWEEP_INTERVAL_MS } from './calls.constants';
import { CallsService } from './calls.service';

/**
 * DPX-MOBILE-002 — closes calls that rang out.
 *
 * A missed call cannot be closed by either of the two people on it: the callee
 * never touched the phone, and the caller's app may be gone. Something outside
 * the call has to end it, or it stays RINGING forever and every report of call
 * reliability (§7) counts it as a call still in progress.
 *
 * Plain `setInterval`, mirroring `RideOfferSweepService` — there is no
 * `@nestjs/schedule` dependency in this codebase, and adding one for a second
 * sweep would be a dependency for a pattern that already exists here.
 *
 * A per-call timer would be simpler to read and wrong: it lives in one
 * process's memory, so a restart mid-ring would leave the call ringing in the
 * database with nothing left to close it.
 */
@Injectable()
export class CallSweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CallSweepService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private readonly callsService: CallsService) {}

  public onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.runSweep();
    }, CALL_SWEEP_INTERVAL_MS);
    if (typeof this.timer.unref === 'function') {
      // Same as the ride offer sweep: an interval that holds the event loop
      // open stops the process exiting cleanly, and hangs the test run.
      this.timer.unref();
    }
  }

  public onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async runSweep(): Promise<number> {
    if (this.running) {
      // A slow sweep must not overlap itself: two passes would both read the
      // same ringing calls and race each other to close them.
      return 0;
    }

    this.running = true;
    try {
      const closed = await this.callsService.expireRingingCalls();
      if (closed > 0) {
        this.logger.log(`Call sweep: missed=${String(closed)}`);
      }
      return closed;
    } catch (error) {
      // A failed sweep must not kill the interval — the next tick should try
      // again rather than leaving every future call to ring forever.
      this.logger.warn(
        `Call sweep failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return 0;
    } finally {
      this.running = false;
    }
  }
}
