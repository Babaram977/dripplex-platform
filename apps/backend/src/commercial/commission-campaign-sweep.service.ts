import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { COMMISSION_CAMPAIGN_SWEEP_INTERVAL_MS } from './commission-campaign.constants';
import { CommissionCampaignService } from './commission-campaign.service';

/**
 * Moves commission campaigns into and out of force on time.
 *
 * Same plain `setInterval` pattern as PromotionSweepService (no
 * `@nestjs/schedule` in this codebase). Pausing, resuming and archiving stay
 * explicit Ops actions; this only handles the two transitions the clock owns.
 *
 * Correctness of what a partner is charged does not depend on this running —
 * `CommissionRateResolverService` filters on the window itself, so a campaign
 * whose window has closed stops applying whether or not the sweep has marked it
 * EXPIRED. What does depend on it is the announcement and the status Ops sees,
 * which is why it runs every five minutes rather than hourly.
 */
@Injectable()
export class CommissionCampaignSweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CommissionCampaignSweepService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private readonly campaigns: CommissionCampaignService) {}

  public onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.runSweep();
    }, COMMISSION_CAMPAIGN_SWEEP_INTERVAL_MS);
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
      // Expire first. A campaign whose window closed should stop before a
      // replacement for the same scope starts, so the two never overlap on the
      // same tick and the announcements arrive in the order they happened.
      const expired = await this.campaigns.expireDueCampaigns();
      const activated = await this.campaigns.activateDueCampaigns();
      if (activated > 0 || expired > 0) {
        this.logger.log(
          `Commission campaign sweep: activated=${String(activated)} expired=${String(expired)}`,
        );
      }
      return { activated, expired };
    } catch (error) {
      this.logger.error(
        `Commission campaign sweep failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { activated: 0, expired: 0 };
    } finally {
      this.running = false;
    }
  }
}
