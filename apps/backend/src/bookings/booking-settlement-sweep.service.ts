import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { BookingSettlementService } from './booking-settlement.service';
import { BOOKING_SETTLEMENT_SWEEP_INTERVAL_MS } from './bookings.constants';

/**
 * The Monday clock behind DPX-HOTEL-003.
 *
 * A plain `setInterval`, matching `RideOfferSweepService`,
 * `ReservationCleanupService` and the booking expiry sweep — this codebase has
 * no `@nestjs/schedule`, and a weekly payout is not the place to introduce one.
 *
 * It ticks hourly and asks whether today is Monday, rather than trying to fire
 * once a week. A once-a-week timer is lost to every restart and every deploy;
 * an hourly check that costs nothing on the other six days cannot be.
 *
 * The twenty-three redundant Monday ticks are harmless because a booking is
 * claimed by an update requiring its `settlementId` to still be null — see
 * `BookingSettlementService` for why that, and not the unique index, is what
 * stops a hotel being paid twice.
 */
@Injectable()
export class BookingSettlementSweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BookingSettlementSweepService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly settlements: BookingSettlementService) {}

  public onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.tick();
    }, BOOKING_SETTLEMENT_SWEEP_INTERVAL_MS);
    this.timer.unref();
  }

  public onModuleDestroy(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Exposed so a test can run one pass without waiting an hour. */
  public async tick(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      return await this.settlements.runWeeklySettlement();
    } catch (error) {
      this.logger.error(
        `Weekly hotel settlement sweep failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return 0;
    } finally {
      this.running = false;
    }
  }
}
