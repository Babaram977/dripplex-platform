import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { ReferralLifecycleService } from './referral-lifecycle.service';
import { REFERRAL_SWEEP_INTERVAL_MS } from './referral.constants';

/**
 * DPX-REFERRAL-003 — the clock behind the referral lifecycle.
 *
 * Two of the three transitions in the lifecycle depend on time passing rather
 * than on anything happening: a hold elapses, and a qualification window
 * closes. Nobody calls an endpoint at that moment, so something has to look.
 *
 * It also re-evaluates milestones, which means a referral qualifies on what is
 * true rather than on an event having been caught. A referred customer whose
 * first ride completed while the process was restarting is picked up on the
 * next pass.
 *
 * Same plain `setInterval` as the loyalty and promotion sweeps — there is no
 * `@nestjs/schedule` dependency in this codebase — and a sweep that throws must
 * not take the interval with it.
 */
@Injectable()
export class ReferralLifecycleSweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReferralLifecycleSweepService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private readonly lifecycle: ReferralLifecycleService) {}

  public onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.runSweep();
    }, REFERRAL_SWEEP_INTERVAL_MS);
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

  public async runSweep(): Promise<{ qualified: number; paid: number; expired: number }> {
    const idle = { qualified: 0, paid: 0, expired: 0 };
    if (this.running) {
      return idle;
    }

    this.running = true;
    try {
      const outcome = await this.lifecycle.sweep();
      if (outcome.qualified > 0 || outcome.paid > 0 || outcome.expired > 0) {
        this.logger.log(
          `Referral sweep: ${String(outcome.qualified)} qualified, ${String(outcome.paid)} paid, ${String(outcome.expired)} expired`,
        );
      }
      return outcome;
    } catch (error) {
      this.logger.error(
        `Referral lifecycle sweep failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return idle;
    } finally {
      this.running = false;
    }
  }
}
