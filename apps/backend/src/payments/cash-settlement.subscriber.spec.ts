import { DOMAIN_EVENTS, type DomainEvent } from '../events/domain-events';

import { CashSettlementSubscriber } from './cash-settlement.subscriber';

import type { PaymentService } from './payment.service';
import type { DomainEventBus } from '../events/domain-event-bus';

describe('CashSettlementSubscriber', () => {
  const paymentService = {
    markCashPaymentReceived: jest.fn().mockResolvedValue(null),
  } as unknown as jest.Mocked<PaymentService>;

  const eventBus = { on: jest.fn() } as unknown as jest.Mocked<DomainEventBus>;

  const subscriber = new CashSettlementSubscriber(eventBus, paymentService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers a handler for DELIVERY_COMPLETED on init', () => {
    subscriber.onModuleInit();
    expect(eventBus.on).toHaveBeenCalledWith(
      DOMAIN_EVENTS.DELIVERY_COMPLETED,
      expect.any(Function),
    );
  });

  it('settles cash payment for the delivered order', async () => {
    const event: DomainEvent = {
      name: DOMAIN_EVENTS.DELIVERY_COMPLETED,
      payload: { orderId: 'order-1' },
      occurredAt: new Date().toISOString(),
    };

    await subscriber.handle(event);

    expect(paymentService.markCashPaymentReceived).toHaveBeenCalledWith('order-1', {});
  });

  it('does nothing when the event has no orderId', async () => {
    const event: DomainEvent = {
      name: DOMAIN_EVENTS.DELIVERY_COMPLETED,
      payload: {},
      occurredAt: new Date().toISOString(),
    };

    await subscriber.handle(event);

    expect(paymentService.markCashPaymentReceived).not.toHaveBeenCalled();
  });

  it('swallows errors from settlement', async () => {
    paymentService.markCashPaymentReceived.mockRejectedValueOnce(new Error('boom'));
    const event: DomainEvent = {
      name: DOMAIN_EVENTS.DELIVERY_COMPLETED,
      payload: { orderId: 'order-1' },
      occurredAt: new Date().toISOString(),
    };

    await expect(subscriber.handle(event)).resolves.toBeUndefined();
  });
});
