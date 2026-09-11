import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { LOYALTY_EXPIRY_SWEEP_INTERVAL_MS } from './loyalty.constants';
import { LoyaltyService } from './loyalty.service';

/**
 * Runs the 365-day expiry.
 *
 * `expirePoints` has existed since the loyalty module was written and nothing
 * has ever called it, so every point ever awarded is still outstanding
 * regardless of its `expiresAt`. This is the caller — the same plain
 * setInterval pattern as PromotionSweepService and the driver/rider sweeps
 * (there is no @nestjs/schedule dependency in this codebase).
 *
 * Switching it on does not cause a cliff: `expiresAt` has been written on every
 * award from the start, always a year out, and DrippleX is well short of a year
 * old — so the first sweeps find nothing due and the first real expiries happen
 * a year after the award that earns them, which is the policy. Awards made
 * before `expiresAt` existed carry NULL and are excluded by the query, so
 * nothing is expired that was never given a date.
 */
@Injectable()
export class LoyaltyExpirySweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LoyaltyExpirySweepService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private readonly loyaltyService: LoyaltyService) {}

  public onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.runSweep();
    }, LOYALTY_EXPIRY_SWEEP_INTERVAL_MS);
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

  public async runSweep(): Promise<{ expiredPoints: number }> {
    if (this.running) {
      return { expiredPoints: 0 };
    }

    this.running = true;
    try {
      const { expiredPoints } = await this.loyaltyService.expirePoints();
      if (expiredPoints > 0) {
        this.logger.log(`Loyalty expiry sweep: expired ${String(expiredPoints)} points`);
      }
      return { expiredPoints };
    } catch (error) {
      // A sweep that throws must not take the interval with it — the next hour
      // should try again rather than leaving expiry silently switched off for
      // the lifetime of the process.
      this.logger.error(
        `Loyalty expiry sweep failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { expiredPoints: 0 };
    } finally {
      this.running = false;
    }
  }
}
