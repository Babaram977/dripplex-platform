import { DomainEventBus } from './domain-event-bus';
import { DOMAIN_EVENTS } from './domain-events';

describe('DomainEventBus', () => {
  let bus: DomainEventBus;

  beforeEach(() => {
    bus = new DomainEventBus();
  });

  it('emits a domain event with payload and metadata', async () => {
    const handler = jest.fn();
    bus.on(DOMAIN_EVENTS.ORDER_CREATED, handler);

    await bus.emit(
      DOMAIN_EVENTS.ORDER_CREATED,
      { orderId: 'order-1' },
      { actorUserId: 'user-1', requestId: 'request-1' },
    );

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        name: DOMAIN_EVENTS.ORDER_CREATED,
        payload: { orderId: 'order-1' },
        actorUserId: 'user-1',
        requestId: 'request-1',
        occurredAt: expect.any(String),
      }),
    );
  });

  it('isolates handler failures from later handlers', async () => {
    const failingHandler = jest.fn().mockRejectedValue(new Error('boom'));
    const successfulHandler = jest.fn();
    bus.on(DOMAIN_EVENTS.PAYMENT_FAILED, failingHandler);
    bus.on(DOMAIN_EVENTS.PAYMENT_FAILED, successfulHandler);

    await expect(
      bus.emit(DOMAIN_EVENTS.PAYMENT_FAILED, { paymentId: 'p1' }),
    ).resolves.toBeUndefined();

    expect(failingHandler).toHaveBeenCalledTimes(1);
    expect(successfulHandler).toHaveBeenCalledTimes(1);
  });

  it('calls multiple handlers registered for the same event', async () => {
    const first = jest.fn();
    const second = jest.fn();
    bus.on(DOMAIN_EVENTS.DELIVERY_COMPLETED, first);
    bus.on(DOMAIN_EVENTS.DELIVERY_COMPLETED, second);

    await bus.emit(DOMAIN_EVENTS.DELIVERY_COMPLETED, { jobId: 'job-1' });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('removes handlers with off', async () => {
    const handler = jest.fn();
    bus.on(DOMAIN_EVENTS.ORDER_PAID, handler);
    bus.off(DOMAIN_EVENTS.ORDER_PAID, handler);

    await bus.emit(DOMAIN_EVENTS.ORDER_PAID, { orderId: 'order-1' });

    expect(handler).not.toHaveBeenCalled();
  });
});
