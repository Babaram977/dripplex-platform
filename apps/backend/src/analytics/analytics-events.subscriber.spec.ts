import { DOMAIN_EVENTS } from '../events/domain-events';

import { AnalyticsEventsSubscriber } from './analytics-events.subscriber';
import { ANALYTICS_METRIC_KEYS } from './analytics.constants';

import type { DomainEventBus } from '../events/domain-event-bus';

interface CapturedEvent {
  payload: Record<string, unknown>;
  occurredAt: string;
}
type CapturedHandler = (event: CapturedEvent) => Promise<void> | void;

describe('AnalyticsEventsSubscriber', () => {
  const handlers = new Map<string, CapturedHandler>();
  const eventBus = {
    on: jest.fn((name: string, handler: CapturedHandler) => {
      handlers.set(name, handler);
    }),
  };
  const analyticsService = {
    incrementOrderPaidMetrics: jest.fn(),
    incrementSimpleMetric: jest.fn(),
  };

  beforeEach(() => {
    handlers.clear();
    jest.clearAllMocks();
    new AnalyticsEventsSubscriber(
      eventBus as unknown as DomainEventBus,
      analyticsService as unknown as ConstructorParameters<typeof AnalyticsEventsSubscriber>[1],
    ).onModuleInit();
  });

  it('subscribes to analytics domain events', () => {
    expect(handlers.has(DOMAIN_EVENTS.ORDER_PAID)).toBe(true);
    expect(handlers.has(DOMAIN_EVENTS.PAYMENT_FAILED)).toBe(true);
    expect(handlers.has(DOMAIN_EVENTS.ORDER_CANCELLED)).toBe(true);
    expect(handlers.has(DOMAIN_EVENTS.DELIVERY_COMPLETED)).toBe(true);
  });

  it('increments paid order and revenue metrics', async () => {
    await handlers.get(DOMAIN_EVENTS.ORDER_PAID)?.({
      occurredAt: '2026-07-21T12:00:00.000Z',
      payload: { merchantId: 'merchant-id', amount: 250 },
    });

    expect(analyticsService.incrementOrderPaidMetrics).toHaveBeenCalledWith({
      occurredAt: new Date('2026-07-21T12:00:00.000Z'),
      merchantId: 'merchant-id',
      amount: 250,
    });
  });

  it('increments payment failure metrics', async () => {
    await handlers.get(DOMAIN_EVENTS.PAYMENT_FAILED)?.({
      occurredAt: '2026-07-21T12:00:00.000Z',
      payload: { merchantId: 'merchant-id' },
    });

    expect(analyticsService.incrementSimpleMetric).toHaveBeenCalledWith({
      occurredAt: new Date('2026-07-21T12:00:00.000Z'),
      key: ANALYTICS_METRIC_KEYS.PAYMENT_FAILED,
      merchantId: 'merchant-id',
    });
  });

  it('increments order cancellation metrics', async () => {
    await handlers.get(DOMAIN_EVENTS.ORDER_CANCELLED)?.({
      occurredAt: '2026-07-21T12:00:00.000Z',
      payload: { merchantId: 'merchant-id' },
    });

    expect(analyticsService.incrementSimpleMetric).toHaveBeenCalledWith(
      expect.objectContaining({ key: ANALYTICS_METRIC_KEYS.ORDER_CANCELLED }),
    );
  });

  it('increments delivery completion metrics with rider scope', async () => {
    await handlers.get(DOMAIN_EVENTS.DELIVERY_COMPLETED)?.({
      occurredAt: '2026-07-21T12:00:00.000Z',
      payload: { merchantId: 'merchant-id', riderId: 'rider-id' },
    });

    expect(analyticsService.incrementSimpleMetric).toHaveBeenCalledWith({
      occurredAt: new Date('2026-07-21T12:00:00.000Z'),
      key: ANALYTICS_METRIC_KEYS.DELIVERY_COMPLETED,
      merchantId: 'merchant-id',
      riderId: 'rider-id',
    });
  });
});
