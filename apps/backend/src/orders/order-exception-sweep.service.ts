import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';

import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../events/domain-events';

import {
  ORDER_EXCEPTION_SWEEP_INTERVAL_MS,
  ORDER_POTENTIALLY_STRANDED_AFTER_MS,
} from './order.constants';
import { ORDERS_REPOSITORY, type OrdersRepository } from './repositories/orders.repository';

/**
 * DPX-ORDER-8D-C — raises an operational exception on a confirmed delivery
 * order the merchant has not advanced.
 *
 * Founder remediation ruling, 2026-09-16: after 30 minutes in DELIVERY +
 * CONFIRMED, the order stops being the merchant's private problem and becomes a
 * DrippleX-managed exception. Merchant action is still required; the platform
 * owns making sure the order reaches a meaningful resolution instead of waiting
 * silently forever.
 *
 * DETECTION ONLY, and the ruling is explicit about it: the 30-minute threshold
 * is an escalation threshold, NOT an automatic cancellation rule. Nothing here
 * cancels, declines, refunds, releases inventory or advances any order. Turning
 * the threshold into an action would need the refund, payment, inventory and
 * merchant consequences defined first — a separate ruling, and deliberately not
 * this increment.
 *
 * Shaped after OrderCompletionSweepService, which already sweeps stale orders on
 * an interval: same timer, same `running` re-entrancy guard, same unref so the
 * timer cannot hold the process open. The interval (15 min) is deliberately
 * shorter than the threshold (30 min), so an order crosses it within half a
 * sweep rather than being missed until the next one.
 */
@Injectable()
export class OrderExceptionSweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderExceptionSweepService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    @Inject(ORDERS_REPOSITORY)
    private readonly ordersRepository: OrdersRepository,
    @Optional()
    private readonly eventBus?: DomainEventBus,
  ) {}

  public onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.runSweep();
    }, ORDER_EXCEPTION_SWEEP_INTERVAL_MS);
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

  /**
   * Returns both counts rather than just the raised one. `alreadyOpen` is what
   * distinguishes "nothing is stalling" from "the same orders are still stalled
   * and we have already said so" — two very different operational pictures that
   * a single number would collapse.
   */
  public async runSweep(): Promise<{ raised: number; alreadyOpen: number }> {
    if (this.running) {
      return { raised: 0, alreadyOpen: 0 };
    }

    this.running = true;
    try {
      const now = new Date();
      const cutoff = new Date(now.getTime() - ORDER_POTENTIALLY_STRANDED_AFTER_MS);
      const stalled = await this.ordersRepository.findStalledConfirmedOrders(cutoff);

      let raised = 0;
      let alreadyOpen = 0;

      for (const order of stalled) {
        const since = order.confirmedAt ?? order.createdAt;
        const waitedMinutes = Math.floor((now.getTime() - since.getTime()) / 60_000);

        const result = await this.ordersRepository.raiseStalledException({
          orderId: order.id,
          waitedMinutes,
          detectedAt: now,
        });

        if (!result.raised) {
          // The unique constraint refused it: already raised, by a concurrent
          // sweep or an earlier one whose row is still around. Not an error.
          alreadyOpen += 1;
          continue;
        }

        raised += 1;

        // Emitted only on a genuinely new exception, so the merchant is told
        // once rather than every fifteen minutes for as long as the order sits
        // there. The repeat protection is the database constraint above, not
        // anything the notification side has to remember.
        await this.eventBus?.emit(
          DOMAIN_EVENTS.ORDER_EXCEPTION_RAISED,
          {
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerId: order.customerId,
            merchantId: order.merchantId,
            fulfillmentType: order.fulfillmentType,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
            type: 'STALLED_CONFIRMED',
            waitedMinutes,
          },
          { actorUserId: null },
        );

        this.logger.warn(
          `Order ${order.orderNumber} has been CONFIRMED and unadvanced for ${String(waitedMinutes)} minutes`,
        );
      }

      return { raised, alreadyOpen };
    } catch (error) {
      // A failing sweep must not kill the interval — it runs again in fifteen
      // minutes, and the orders it missed are still there to find.
      this.logger.error(
        `Order exception sweep failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { raised: 0, alreadyOpen: 0 };
    } finally {
      this.running = false;
    }
  }
}
