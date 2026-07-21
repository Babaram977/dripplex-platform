import { Injectable, OnModuleInit } from '@nestjs/common';

import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS, type DomainEvent } from '../events/domain-events';

import { LOYALTY_EVENT_POINTS, LOYALTY_REFERENCE_TYPES } from './loyalty.constants';
import { LoyaltyService } from './loyalty.service';

@Injectable()
export class LoyaltyEventsSubscriber implements OnModuleInit {
  constructor(
    private readonly eventBus: DomainEventBus,
    private readonly loyaltyService: LoyaltyService,
  ) {}

  public onModuleInit(): void {
    this.eventBus.on(DOMAIN_EVENTS.ORDER_PAID, (event) => this.handleOrderPaid(event));
    this.eventBus.on(DOMAIN_EVENTS.DELIVERY_COMPLETED, (event) =>
      this.handleDeliveryCompleted(event),
    );
    this.eventBus.on(DOMAIN_EVENTS.CUSTOMER_REGISTERED, (event) =>
      this.handleCustomerRegistered(event),
    );
    this.eventBus.on(DOMAIN_EVENTS.COUPON_REDEEMED, (event) => this.handleCouponRedeemed(event));
  }

  private async handleOrderPaid(event: DomainEvent): Promise<void> {
    const userId = stringPayload(event, 'customerId') ?? stringPayload(event, 'userId');
    if (!userId) {
      return;
    }
    const orderId = stringPayload(event, 'orderId');

    await this.loyaltyService.awardPoints({
      userId,
      points: LOYALTY_EVENT_POINTS.ORDER_PAID,
      reason: 'Order paid',
      referenceType: LOYALTY_REFERENCE_TYPES.ORDER,
      ...(orderId ? { referenceId: orderId } : {}),
      context: { userId },
    });
  }

  private async handleDeliveryCompleted(event: DomainEvent): Promise<void> {
    const userId = stringPayload(event, 'customerId') ?? stringPayload(event, 'userId');
    if (!userId) {
      return;
    }
    const deliveryJobId = stringPayload(event, 'deliveryJobId');

    await this.loyaltyService.awardPoints({
      userId,
      points: LOYALTY_EVENT_POINTS.DELIVERY_COMPLETED,
      reason: 'Delivery completed',
      referenceType: LOYALTY_REFERENCE_TYPES.DELIVERY,
      ...(deliveryJobId ? { referenceId: deliveryJobId } : {}),
      context: { userId },
    });
  }

  private async handleCustomerRegistered(event: DomainEvent): Promise<void> {
    const userId = stringPayload(event, 'userId');
    if (!userId || stringPayload(event, 'portal') !== 'customer') {
      return;
    }

    await this.loyaltyService.awardPoints({
      userId,
      points: LOYALTY_EVENT_POINTS.CUSTOMER_REGISTERED,
      reason: 'Customer registered',
      referenceType: LOYALTY_REFERENCE_TYPES.CUSTOMER,
      referenceId: userId,
      context: { userId },
    });
  }

  private async handleCouponRedeemed(event: DomainEvent): Promise<void> {
    const userId = stringPayload(event, 'customerId') ?? stringPayload(event, 'userId');
    if (!userId) {
      return;
    }
    const referenceId = stringPayload(event, 'couponId') ?? stringPayload(event, 'orderId');

    await this.loyaltyService.awardPoints({
      userId,
      points: LOYALTY_EVENT_POINTS.COUPON_REDEEMED,
      reason: 'Coupon redeemed',
      referenceType: LOYALTY_REFERENCE_TYPES.COUPON,
      ...(referenceId ? { referenceId } : {}),
      context: { userId },
    });
  }
}

function stringPayload(event: DomainEvent, key: string): string | undefined {
  const value = event.payload[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
