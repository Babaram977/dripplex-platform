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

  // DPX-COMMERCIAL-001 Slice 3 — the trigger moved from DELIVERY_COMPLETED
  // (fired automatically the moment the rider marks the job DELIVERED) to
  // DELIVERY_CASH_CONFIRMED (fired only once the rider explicitly confirms
  // collecting the cash — see DeliveryService.confirmCash()).
  it('registers a handler for DELIVERY_CASH_CONFIRMED on init', () => {
    subscriber.onModuleInit();
    expect(eventBus.on).toHaveBeenCalledWith(
      DOMAIN_EVENTS.DELIVERY_CASH_CONFIRMED,
      expect.any(Function),
    );
  });

  it('settles cash payment for the confirmed order', async () => {
    const event: DomainEvent = {
      name: DOMAIN_EVENTS.DELIVERY_CASH_CONFIRMED,
      payload: { orderId: 'order-1' },
      occurredAt: new Date().toISOString(),
    };

    await subscriber.handle(event);

    expect(paymentService.markCashPaymentReceived).toHaveBeenCalledWith('order-1', {});
  });

  it('does nothing when the event has no orderId', async () => {
    const event: DomainEvent = {
      name: DOMAIN_EVENTS.DELIVERY_CASH_CONFIRMED,
      payload: {},
      occurredAt: new Date().toISOString(),
    };

    await subscriber.handle(event);

    expect(paymentService.markCashPaymentReceived).not.toHaveBeenCalled();
  });

  it('swallows errors from settlement', async () => {
    paymentService.markCashPaymentReceived.mockRejectedValueOnce(new Error('boom'));
    const event: DomainEvent = {
      name: DOMAIN_EVENTS.DELIVERY_CASH_CONFIRMED,
      payload: { orderId: 'order-1' },
      occurredAt: new Date().toISOString(),
    };

    await expect(subscriber.handle(event)).resolves.toBeUndefined();
  });
});
