import { DOMAIN_EVENTS } from '../events/domain-events';

import { FraudEventSubscriber } from './fraud-event.subscriber';

import type { FraudService } from './fraud.service';
import type { DomainEventBus } from '../events/domain-event-bus';

describe('FraudEventSubscriber', () => {
  const eventBus = {
    on: jest.fn(),
    off: jest.fn(),
  } as unknown as jest.Mocked<DomainEventBus>;

  const fraudService = {
    evaluateOrderRisk: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<FraudService>;

  const subscriber = new FraudEventSubscriber(eventBus, fraudService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('subscribes to payment and order risk events', () => {
    subscriber.onModuleInit();

    expect(eventBus.on).toHaveBeenCalledWith(DOMAIN_EVENTS.PAYMENT_FAILED, expect.any(Function));
    expect(eventBus.on).toHaveBeenCalledWith(DOMAIN_EVENTS.ORDER_CREATED, expect.any(Function));
    expect(eventBus.on).toHaveBeenCalledWith(DOMAIN_EVENTS.PAYMENT_INITIATED, expect.any(Function));
  });

  it('unsubscribes from risk events on destroy', () => {
    subscriber.onModuleDestroy();

    expect(eventBus.off).toHaveBeenCalledWith(DOMAIN_EVENTS.PAYMENT_FAILED, expect.any(Function));
    expect(eventBus.off).toHaveBeenCalledWith(DOMAIN_EVENTS.ORDER_CREATED, expect.any(Function));
    expect(eventBus.off).toHaveBeenCalledWith(DOMAIN_EVENTS.PAYMENT_INITIATED, expect.any(Function));
  });

  it('maps event payload fields to risk evaluation input', async () => {
    subscriber.onModuleInit();
    const handler = eventBus.on.mock.calls[0]?.[1];
    expect(handler).toBeDefined();

    await handler?.({
      name: DOMAIN_EVENTS.ORDER_CREATED,
      occurredAt: new Date().toISOString(),
      payload: {
        customerId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        orderId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        total: '750000',
        currency: 'NGN',
        ipAddress: '10.0.0.5',
        deviceFingerprint: 'device-1',
        billingCountry: 'NG',
        shippingCountry: 'GH',
      },
    });

    expect(fraudService.evaluateOrderRisk).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        orderId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        amount: 750000,
        currency: 'NGN',
        ipAddress: '10.0.0.5',
        deviceFingerprint: 'device-1',
      }),
    );
  });

  it('ignores events without user, order, or payment identifiers', async () => {
    subscriber.onModuleInit();
    const handler = eventBus.on.mock.calls[0]?.[1];

    await handler?.({
      name: DOMAIN_EVENTS.ORDER_CREATED,
      occurredAt: new Date().toISOString(),
      payload: { amount: 1000 },
    });

    expect(fraudService.evaluateOrderRisk).not.toHaveBeenCalled();
  });
});
