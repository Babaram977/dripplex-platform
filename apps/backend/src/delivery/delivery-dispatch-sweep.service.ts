import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import {
  DELIVERY_DISPATCH_SWEEP_BATCH_SIZE,
  DELIVERY_DISPATCH_SWEEP_INTERVAL_MS,
} from './delivery.constants';
import { DeliveryService } from './delivery.service';

/**
 * DPX-RIDER-004 — periodically re-dispatches deliveries that have no rider.
 *
 * Auto-assignment ran exactly once, when the merchant marked the order ready
 * (OrderReadySubscriber). If no eligible rider was online and located at that
 * instant, the job stayed PENDING with a null riderId and nothing ever looked
 * at it again — a rider coming online a minute later was never considered, and
 * the customer's order silently went nowhere.
 *
 * Founder decision 2026-08-15: retry periodically. Same plain setInterval sweep
 * pattern as RideOfferSweepService and ReservationCleanupService (no
 * @nestjs/schedule dependency in this codebase).
 *
 * Duplicate offers are prevented at three levels: this class refuses to overlap
 * with itself (`running`), DeliveryService.redispatchUnassignedJobs re-reads
 * each job before assigning and only touches PENDING/unassigned ones, and
 * riders who already rejected a job are excluded from its retries.
 */
@Injectable()
export class DeliveryDispatchSweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeliveryDispatchSweepService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private readonly deliveryService: DeliveryService) {}

  public onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.runSweep();
    }, DELIVERY_DISPATCH_SWEEP_INTERVAL_MS);
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
      // Reclaim first, then dispatch: a job taken back from a rider who never
      // accepted is PENDING by the time the second pass runs, so it is offered
      // to somebody else on this same tick rather than waiting for the next.
      const reclaimed = await this.deliveryService.reclaimStaleAssignments(
        DELIVERY_DISPATCH_SWEEP_BATCH_SIZE,
      );
      const assigned = await this.deliveryService.redispatchUnassignedJobs(
        DELIVERY_DISPATCH_SWEEP_BATCH_SIZE,
      );
      if (assigned > 0 || reclaimed > 0) {
        this.logger.log(
          `Delivery dispatch sweep: reclaimed=${String(reclaimed)} assigned=${String(assigned)}`,
        );
      }
      return assigned;
    } catch (error) {
      // A sweep failure must not kill the timer — the next tick retries.
      this.logger.error(
        `Delivery dispatch sweep failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    } finally {
      this.running = false;
    }
  }
}
