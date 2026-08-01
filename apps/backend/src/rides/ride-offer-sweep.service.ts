import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { RideDispatchService } from './ride-dispatch.service';
import { RIDE_OFFER_SWEEP_INTERVAL_MS } from './ride.constants';

/**
 * Periodically expires stale ride offers and retries dispatch, mirroring
 * ReservationCleanupService's plain setInterval pattern (no @nestjs/schedule
 * dependency in this codebase). Stands in for push-based expiry until
 * RIDE-002.5's WebSocket layer exists.
 */
@Injectable()
export class RideOfferSweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RideOfferSweepService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private readonly dispatchService: RideDispatchService) {}

  public onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.runSweep();
    }, RIDE_OFFER_SWEEP_INTERVAL_MS);
    if (typeof this.timer.unref === 'function') {
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
      return 0;
    }

    this.running = true;
    try {
      const expired = await this.dispatchService.expireStaleOffers();
      if (expired > 0) {
        this.logger.log(`Ride offer sweep: expired=${String(expired)}`);
      }
      return expired;
    } finally {
      this.running = false;
    }
  }
}
