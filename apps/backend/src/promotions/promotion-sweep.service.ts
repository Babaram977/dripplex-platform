import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { PROMOTION_SWEEP_INTERVAL_MS } from './promotion.constants';
import { PromotionsService } from './promotions.service';

/**
 * Periodically activates campaigns whose startsAt has arrived and expires
 * campaigns whose endsAt has passed — same plain setInterval pattern as
 * DriverCampaignSweepService/RideOfferSweepService (no @nestjs/schedule
 * dependency in this codebase). Pausing/resuming/archiving stay explicit
 * admin actions; this sweep only handles the two time-driven transitions.
 */
@Injectable()
export class PromotionSweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PromotionSweepService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private readonly promotionsService: PromotionsService) {}

  public onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.runSweep();
    }, PROMOTION_SWEEP_INTERVAL_MS);
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

  public async runSweep(): Promise<{ activated: number; expired: number }> {
    if (this.running) {
      return { activated: 0, expired: 0 };
    }

    this.running = true;
    try {
      const activated = await this.promotionsService.activateDueCampaigns();
      const expired = await this.promotionsService.expireDueCampaigns();
      if (activated > 0 || expired > 0) {
        this.logger.log(
          `Promotion sweep: activated=${String(activated)} expired=${String(expired)}`,
        );
      }
      return { activated, expired };
    } finally {
      this.running = false;
    }
  }
}
