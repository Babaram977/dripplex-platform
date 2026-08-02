import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { FulfillmentType } from '@prisma/client';

import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS, type DomainEvent } from '../events/domain-events';

import { DeliveryService } from './delivery.service';

/**
 * Bridges MerchantOrdersService's ORDER_READY event to delivery dispatch
 * without OrdersModule importing DeliveryModule (which would create a
 * cycle — DeliveryModule already imports OrdersModule for ORDERS_REPOSITORY).
 * Only DELIVERY-fulfillment orders get a job; PICKUP orders wait for the
 * customer instead.
 */
@Injectable()
export class OrderReadySubscriber implements OnModuleInit {
  private readonly logger = new Logger(OrderReadySubscriber.name);

  constructor(
    private readonly eventBus: DomainEventBus,
    private readonly deliveryService: DeliveryService,
  ) {}

  public onModuleInit(): void {
    this.eventBus.on(DOMAIN_EVENTS.ORDER_READY, (event) => this.handle(event));
  }

  public async handle(event: DomainEvent): Promise<void> {
    const payload = event.payload;
    const orderId = typeof payload['orderId'] === 'string' ? payload['orderId'] : null;
    const fulfillmentType = payload['fulfillmentType'];
    if (!orderId || fulfillmentType !== FulfillmentType.DELIVERY) {
      return;
    }

    try {
      await this.deliveryService.createDeliveryJob(orderId);
    } catch (error) {
      this.logger.error(
        `Failed to dispatch delivery for ready order ${orderId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
