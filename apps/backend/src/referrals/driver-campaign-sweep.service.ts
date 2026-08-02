import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { DRIVER_CAMPAIGN_SWEEP_INTERVAL_MS } from './driver-campaign.constants';
import { DriverCampaignService } from './driver-campaign.service';

/**
 * Periodically activates campaigns whose periodStart has arrived and ends
 * campaigns whose periodEnd has passed, mirroring RideOfferSweepService's
 * plain setInterval pattern (no @nestjs/schedule dependency in this
 * codebase). Pausing/resuming stays an explicit admin action — this sweep
 * only handles the two time-driven transitions.
 */
@Injectable()
export class DriverCampaignSweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DriverCampaignSweepService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private readonly driverCampaignService: DriverCampaignService) {}

  public onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.runSweep();
    }, DRIVER_CAMPAIGN_SWEEP_INTERVAL_MS);
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

  public async runSweep(): Promise<{ activated: number; ended: number }> {
    if (this.running) {
      return { activated: 0, ended: 0 };
    }

    this.running = true;
    try {
      const activated = await this.driverCampaignService.activateDueCampaigns();
      const ended = await this.driverCampaignService.endExpiredCampaigns();
      if (activated > 0 || ended > 0) {
        this.logger.log(
          `Driver campaign sweep: activated=${String(activated)} ended=${String(ended)}`,
        );
      }
      return { activated, ended };
    } finally {
      this.running = false;
    }
  }
}
