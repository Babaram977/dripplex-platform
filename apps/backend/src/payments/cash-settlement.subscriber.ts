import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS, type DomainEvent } from '../events/domain-events';

import { PaymentService } from './payment.service';

/**
 * Bridges DeliveryService's DELIVERY_COMPLETED event to
 * PaymentService.markCashPaymentReceived() without PaymentsModule
 * depending on DeliveryModule for this — same reasoning as
 * delivery/order-ready.subscriber.ts's bridge in the other direction.
 * Fires on every delivery completion; markCashPaymentReceived() is a
 * deliberate no-op for the common non-cash case.
 */
@Injectable()
export class CashSettlementSubscriber implements OnModuleInit {
  private readonly logger = new Logger(CashSettlementSubscriber.name);

  constructor(
    private readonly eventBus: DomainEventBus,
    private readonly paymentService: PaymentService,
  ) {}

  public onModuleInit(): void {
    this.eventBus.on(DOMAIN_EVENTS.DELIVERY_COMPLETED, (event) => this.handle(event));
  }

  public async handle(event: DomainEvent): Promise<void> {
    const orderId = typeof event.payload['orderId'] === 'string' ? event.payload['orderId'] : null;
    if (!orderId) {
      return;
    }

    try {
      await this.paymentService.markCashPaymentReceived(orderId, {});
    } catch (error) {
      this.logger.error(
        `Failed to settle cash payment for delivered order ${orderId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
