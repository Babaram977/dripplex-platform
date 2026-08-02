import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../events/domain-events';

import {
  ORDER_AUTO_COMPLETE_AFTER_MS,
  ORDER_COMPLETION_SWEEP_INTERVAL_MS,
} from './order.constants';
import { ORDERS_REPOSITORY, type OrdersRepository } from './repositories/orders.repository';

/**
 * Auto-completes DELIVERED orders that the customer neither disputed nor
 * had cancelled within ORDER_AUTO_COMPLETE_AFTER_MS — mirrors
 * ReservationCleanupService's interval-timer shape. Same 24h window
 * quietly matches most marketplace "delivery confirmed" conventions;
 * disputing an order is the customer's way to stop the sweep.
 */
@Injectable()
export class OrderCompletionSweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderCompletionSweepService.name);
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
    }, ORDER_COMPLETION_SWEEP_INTERVAL_MS);
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

  public async runSweep(): Promise<{ completedOrders: number }> {
    if (this.running) {
      return { completedOrders: 0 };
    }

    this.running = true;
    try {
      const cutoff = new Date(Date.now() - ORDER_AUTO_COMPLETE_AFTER_MS);
      const eligible = await this.ordersRepository.findAutoCompletableOrders(cutoff);

      for (const order of eligible) {
        await this.ordersRepository.transition(order.id, {
          status: OrderStatus.COMPLETED,
          completedAt: new Date(),
        });
        await this.eventBus?.emit(
          DOMAIN_EVENTS.ORDER_COMPLETED,
          { orderId: order.id, customerId: order.customerId, merchantId: order.merchantId },
          {},
        );
      }

      if (eligible.length > 0) {
        this.logger.log(`Order completion sweep: completed=${String(eligible.length)}`);
      }

      return { completedOrders: eligible.length };
    } finally {
      this.running = false;
    }
  }
}
