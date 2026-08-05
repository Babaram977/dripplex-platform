import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS, type DomainEvent } from '../events/domain-events';

import { PaymentService } from './payment.service';

/**
 * Bridges DeliveryService's DELIVERY_CASH_CONFIRMED event to
 * PaymentService.markCashPaymentReceived() without PaymentsModule
 * depending on DeliveryModule for this — same reasoning as
 * delivery/order-ready.subscriber.ts's bridge in the other direction.
 *
 * DPX-COMMERCIAL-001 Slice 3 — previously bound to DELIVERY_COMPLETED,
 * firing automatically the moment the rider marked the job DELIVERED,
 * with no confirmation that cash was actually collected (policy doc
 * §2.1/§3.4). Now bound to DELIVERY_CASH_CONFIRMED, which only fires
 * once the rider explicitly confirms — see
 * DeliveryService.confirmCash() and
 * docs/DPX-COMMERCIAL-001-SLICE-3-COD-CORRECTION.md.
 * markCashPaymentReceived() remains a deliberate no-op for the common
 * non-cash case (defensive; DELIVERY_CASH_CONFIRMED only ever fires for
 * CASH orders in practice).
 */
@Injectable()
export class CashSettlementSubscriber implements OnModuleInit {
  private readonly logger = new Logger(CashSettlementSubscriber.name);

  constructor(
    private readonly eventBus: DomainEventBus,
    private readonly paymentService: PaymentService,
  ) {}

  public onModuleInit(): void {
    this.eventBus.on(DOMAIN_EVENTS.DELIVERY_CASH_CONFIRMED, (event) => this.handle(event));
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
