import { FulfillmentType } from '@prisma/client';

import { DOMAIN_EVENTS, type DomainEvent } from '../events/domain-events';

import { OrderReadySubscriber } from './order-ready.subscriber';

import type { DeliveryService } from './delivery.service';
import type { DomainEventBus } from '../events/domain-event-bus';

describe('OrderReadySubscriber', () => {
  const deliveryService = {
    createDeliveryJob: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<DeliveryService>;

  const eventBus = { on: jest.fn() } as unknown as jest.Mocked<DomainEventBus>;

  const subscriber = new OrderReadySubscriber(eventBus, deliveryService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers a handler for ORDER_READY on init', () => {
    subscriber.onModuleInit();
    expect(eventBus.on).toHaveBeenCalledWith(DOMAIN_EVENTS.ORDER_READY, expect.any(Function));
  });

  it('dispatches a delivery job for DELIVERY-fulfillment orders', async () => {
    const event: DomainEvent = {
      name: DOMAIN_EVENTS.ORDER_READY,
      payload: { orderId: 'order-1', fulfillmentType: FulfillmentType.DELIVERY },
      occurredAt: new Date().toISOString(),
    };

    await subscriber.handle(event);

    expect(deliveryService.createDeliveryJob).toHaveBeenCalledWith('order-1');
  });

  it('does nothing for PICKUP-fulfillment orders', async () => {
    const event: DomainEvent = {
      name: DOMAIN_EVENTS.ORDER_READY,
      payload: { orderId: 'order-1', fulfillmentType: FulfillmentType.PICKUP },
      occurredAt: new Date().toISOString(),
    };

    await subscriber.handle(event);

    expect(deliveryService.createDeliveryJob).not.toHaveBeenCalled();
  });

  it('swallows errors from delivery job creation', async () => {
    deliveryService.createDeliveryJob.mockRejectedValueOnce(new Error('boom'));
    const event: DomainEvent = {
      name: DOMAIN_EVENTS.ORDER_READY,
      payload: { orderId: 'order-1', fulfillmentType: FulfillmentType.DELIVERY },
      occurredAt: new Date().toISOString(),
    };

    await expect(subscriber.handle(event)).resolves.toBeUndefined();
  });
});
