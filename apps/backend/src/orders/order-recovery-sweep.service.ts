import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

import { OrderRecoveryService } from './order-recovery.service';
import {
  ORDER_RECOVERY_BACKSTOP_AFTER_MS,
  ORDER_RECOVERY_SWEEP_INTERVAL_MS,
  resolveRecoveryActivationAt,
} from './order.constants';

export interface RecoverySweepResult {
  /** Null activation boundary — the sweep did nothing and could not have. */
  inactive: boolean;
  considered: number;
  recovered: number;
  /** Claimed by somebody else, or no longer eligible on revalidation. */
  skipped: number;
  failed: number;
}

/**
 * DPX-ORDER-8D-RECOVERY Increment 4 — the 24-hour automatic backstop.
 *
 * ⚠️ THE FIRST CODE IN THIS PROGRAMME THAT MOVES MONEY WITHOUT A PERSON ASKING.
 *
 * IT SHIPS INERT. `RECOVERY_ACTIVATION_AT` is null until the founder sets it in
 * its own reviewed change, and a null boundary means zero recovery actions —
 * not "sweep everything", not "start from now". Deploying this increment
 * therefore causes no production action at all, which is the point: the sweep
 * is the last component enabled, never the first.
 *
 * IT DOES NOT COPY OrderCompletionSweepService. That sweep guards itself with an
 * in-process `running` boolean and then does select-then-mutate per row. The
 * boolean does not survive two replicas, and the gap between selecting and
 * mutating is wide enough for a merchant to accept the order in between. Here,
 * the claim is `UNIQUE(order_recoveries.order_id)` — a database invariant, the
 * same mechanism #416 proved for order exceptions — and the service re-reads
 * and revalidates the order immediately before every mutation. The `running`
 * flag below is kept only to stop one process stacking overlapping passes; it
 * is not, and must never become, the correctness mechanism.
 *
 * WHAT IT DOES PER ORDER is exactly what an operator can already do by hand,
 * through the same code: claim, revalidate, cancel as ADMIN, then reverse only
 * a DX Wallet payment. CASH stops at cancellation. MERCHANT_DIRECT and gateway
 * payments stop at cancellation with their investigation left open, because no
 * gateway refund integration exists and MERCHANT_DIRECT money never reached
 * DrippleX — neither is invented here.
 */
@Injectable()
export class OrderRecoverySweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderRecoverySweepService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  /** One pass cannot cancel the platform. A backlog drains over later passes. */
  private static readonly BATCH_LIMIT = 50;

  constructor(private readonly recovery: OrderRecoveryService) {}

  public onModuleInit(): void {
    this.announceActivationState();
    this.timer = setInterval(() => {
      void this.runSweep();
    }, ORDER_RECOVERY_SWEEP_INTERVAL_MS);
    if (typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  /**
   * Say, once at startup, whether automatic recovery is armed.
   *
   * WHY THIS EXISTS. Until now the safe state produced NO evidence of itself:
   * an unactivated sweep returned early in silence, so "the backstop is off"
   * could only be inferred from the absence of messages — which is equally
   * consistent with a sweep that ran and found nothing. An operator asked to
   * verify a deployment is inert had nothing to verify against. Making the
   * quiet state legible is the whole point of this method.
   *
   * It resolves the boundary through the SAME path `runSweep` uses, so the log
   * cannot describe a state the sweep does not have. A line that resolved the
   * constant independently could tell you the backstop is off while the sweep
   * considered it on.
   *
   * Levels are chosen to match which state deserves attention: not-activated is
   * ordinary and expected, so it is `log`; armed means the platform can now
   * cancel orders and move money without a person asking, so it is `warn` — the
   * one an operator should notice scrolling past.
   */
  private announceActivationState(): void {
    const activationAt = this.activationBoundary();
    if (activationAt === null) {
      this.logger.log(
        'Automatic recovery is NOT activated (RECOVERY_ACTIVATION_AT is unset or unparseable). ' +
          'The 24-hour backstop will perform no recovery actions: no order will be cancelled and ' +
          'no money will move automatically.',
      );
      return;
    }
    this.logger.warn(
      `Automatic recovery IS ACTIVATED. Stalled-order exceptions detected at or after ${activationAt.toISOString()} ` +
        'are eligible for the 24-hour backstop, which can cancel an order and reverse a DX Wallet ' +
        'payment without a person asking. Exceptions detected before that instant remain ineligible.',
    );
  }

  /**
   * The activation boundary, resolved fail-closed.
   *
   * A single seam so the startup announcement and the sweep itself can never
   * disagree, and so a test can drive both states without reaching for the
   * production constant. Production behaviour is unchanged: it reads
   * RECOVERY_ACTIVATION_AT exactly as before.
   */
  protected activationBoundary(): Date | null {
    return resolveRecoveryActivationAt();
  }

  public onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public async runSweep(): Promise<RecoverySweepResult> {
    const inert: RecoverySweepResult = {
      inactive: true,
      considered: 0,
      recovered: 0,
      skipped: 0,
      failed: 0,
    };

    if (this.running) {
      return { ...inert, inactive: false };
    }

    // FAIL CLOSED. Unset, unparseable or absurd all land here and all mean the
    // same thing: do nothing. Never "now", never a null comparison.
    const activationAt = this.activationBoundary();
    if (activationAt === null) {
      return inert;
    }

    this.running = true;
    try {
      const backstopBefore = new Date(Date.now() - ORDER_RECOVERY_BACKSTOP_AFTER_MS);
      const eligible = await this.recovery.findBackstopEligible({
        activationAt,
        backstopBefore,
        limit: OrderRecoverySweepService.BATCH_LIMIT,
      });

      let recovered = 0;
      let skipped = 0;
      let failed = 0;

      for (const order of eligible) {
        try {
          const outcome = await this.recovery.recoverAutomatically({ orderId: order.id });
          if (outcome.acted) {
            recovered += 1;
          } else {
            skipped += 1;
          }
        } catch (error) {
          // One order's failure must not abandon the rest of the batch, and a
          // failed reversal has already left the order cancelled and its case
          // retryable by design.
          failed += 1;
          this.logger.error(
            `Automatic recovery failed for ${order.orderNumber}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }

      if (eligible.length > 0) {
        this.logger.warn(
          `Automatic recovery sweep: considered=${String(eligible.length)} recovered=${String(
            recovered,
          )} skipped=${String(skipped)} failed=${String(failed)}`,
        );
      }

      return { inactive: false, considered: eligible.length, recovered, skipped, failed };
    } catch (error) {
      // A failing sweep must not kill the interval — it runs again in fifteen
      // minutes and the orders it missed are still there.
      this.logger.error(
        `Automatic recovery sweep failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { ...inert, inactive: false };
    } finally {
      this.running = false;
    }
  }
}
