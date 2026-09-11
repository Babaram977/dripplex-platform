import { DOMAIN_EVENTS } from '../events/domain-events';

import { LoyaltyEventsSubscriber } from './loyalty-events.subscriber';
import { LOYALTY_EVENT_POINTS, LOYALTY_REFERENCE_TYPES } from './loyalty.constants';

import type { DomainEventBus } from '../events/domain-event-bus';

interface CapturedEvent {
  payload: Record<string, unknown>;
}
type CapturedHandler = (event: CapturedEvent) => Promise<void> | void;

describe('LoyaltyEventsSubscriber', () => {
  const handlers = new Map<string, CapturedHandler>();
  const eventBus = {
    on: jest.fn((name: string, handler: CapturedHandler) => {
      handlers.set(name, handler);
    }),
  };
  const loyaltyService = { awardPoints: jest.fn(), reversePointsFor: jest.fn() };

  beforeEach(() => {
    handlers.clear();
    jest.clearAllMocks();
    new LoyaltyEventsSubscriber(
      eventBus as unknown as DomainEventBus,
      loyaltyService as unknown as ConstructorParameters<typeof LoyaltyEventsSubscriber>[1],
    ).onModuleInit();
  });

  it('subscribes to loyalty earning events, and to the one that undoes them', () => {
    expect(eventBus.on).toHaveBeenCalledTimes(5);
    expect(handlers.has(DOMAIN_EVENTS.ORDER_PAID)).toBe(true);
    expect(handlers.has(DOMAIN_EVENTS.DELIVERY_COMPLETED)).toBe(true);
    expect(handlers.has(DOMAIN_EVENTS.CUSTOMER_REGISTERED)).toBe(true);
    expect(handlers.has(DOMAIN_EVENTS.COUPON_REDEEMED)).toBe(true);
    expect(handlers.has(DOMAIN_EVENTS.ORDER_REFUNDED)).toBe(true);
  });

  it('awards order-paid points to the customer', async () => {
    await handlers.get(DOMAIN_EVENTS.ORDER_PAID)?.({
      payload: { customerId: 'user-id', orderId: 'order-id' },
    });

    expect(loyaltyService.awardPoints).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-id', points: LOYALTY_EVENT_POINTS.ORDER_PAID }),
    );
  });

  it('awards delivery-completed points', async () => {
    await handlers.get(DOMAIN_EVENTS.DELIVERY_COMPLETED)?.({
      payload: { customerId: 'user-id', deliveryJobId: 'job-id' },
    });

    expect(loyaltyService.awardPoints).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-id',
        points: LOYALTY_EVENT_POINTS.DELIVERY_COMPLETED,
      }),
    );
  });

  it('awards registration points only for customer portal registrations', async () => {
    await handlers.get(DOMAIN_EVENTS.CUSTOMER_REGISTERED)?.({
      payload: { userId: 'merchant-id', portal: 'merchant' },
    });
    await handlers.get(DOMAIN_EVENTS.CUSTOMER_REGISTERED)?.({
      payload: { userId: 'customer-id', portal: 'customer' },
    });

    expect(loyaltyService.awardPoints).toHaveBeenCalledTimes(1);
    expect(loyaltyService.awardPoints).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'customer-id' }),
    );
  });

  it('ignores events without a user identifier', async () => {
    await handlers.get(DOMAIN_EVENTS.COUPON_REDEEMED)?.({ payload: { couponId: 'coupon-id' } });

    expect(loyaltyService.awardPoints).not.toHaveBeenCalled();
  });

  it('takes back the points a refunded order earned', async () => {
    // DPX-LOYALTY-006 — the money went back and the points stayed. Keyed on the
    // order, so the reversal finds exactly what that order awarded.
    await handlers.get(DOMAIN_EVENTS.ORDER_REFUNDED)?.({
      payload: { customerId: 'user-id', orderId: 'order-id' },
    });

    expect(loyaltyService.reversePointsFor).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-id',
        referenceType: LOYALTY_REFERENCE_TYPES.ORDER,
        referenceId: 'order-id',
      }),
    );
  });

  it('does not reverse a refund it cannot attribute to an order', async () => {
    // Without an order id there is nothing to key the reversal on, and guessing
    // would take points a different order earned.
    await handlers.get(DOMAIN_EVENTS.ORDER_REFUNDED)?.({ payload: { customerId: 'user-id' } });

    expect(loyaltyService.reversePointsFor).not.toHaveBeenCalled();
  });
});
