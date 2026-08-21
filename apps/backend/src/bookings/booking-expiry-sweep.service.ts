import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { BOOKING_EXPIRY_SWEEP_INTERVAL_MS } from './bookings.constants';
import { BookingsService } from './bookings.service';

/**
 * The clock behind founder decision 9.
 *
 * A hotel gets thirty minutes to accept. Nothing else in the system notices
 * when that runs out: the hotel not acting produces no event, which is exactly
 * the case where a guest is left with a booking that will never be answered and
 * money they cannot spend.
 *
 * A plain `setInterval`, matching `RideOfferSweepService` and
 * `ReservationCleanupService` — this codebase has no `@nestjs/schedule`, and
 * introducing a scheduler for a third sweep would be a bigger change than the
 * sweep itself.
 *
 * Not a per-booking `setTimeout`: a timer dies with the process, so a deploy in
 * the middle of a thirty-minute window would strand every hold placed before
 * it. The sweep reads the deadline from the database, so it recovers whatever
 * it finds on the next tick however long it was down.
 */
@Injectable()
export class BookingExpirySweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BookingExpirySweepService.name);
  private timer: NodeJS.Timeout | null = null;
  /** A slow sweep must not overlap itself and try to expire the same row twice. */
  private running = false;

  constructor(private readonly bookings: BookingsService) {}

  public onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.tick();
    }, BOOKING_EXPIRY_SWEEP_INTERVAL_MS);
    // Never hold the process open on this alone.
    this.timer.unref();
  }

  public onModuleDestroy(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Exposed so a test can run one pass without waiting a minute. */
  public async tick(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      return await this.bookings.expireOverdueBookings();
    } catch (error) {
      this.logger.error(
        `Booking expiry sweep failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    } finally {
      this.running = false;
    }
  }
}
