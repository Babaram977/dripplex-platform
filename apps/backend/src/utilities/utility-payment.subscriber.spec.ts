import { DOMAIN_EVENTS, type DomainEvent } from '../events/domain-events';

import { UtilityPaymentSubscriber } from './utility-payment.subscriber';

import type { UtilitiesService } from './utilities.service';
import type { DomainEventBus } from '../events/domain-event-bus';

/**
 * The regression this class exists for: a ₦1,000 airtime purchase paid by card
 * on 2026-08-19 stayed AWAITING_PAYMENT because the webhook had nowhere to go
 * and the customer never returned to the app to confirm it.
 */
describe('UtilityPaymentSubscriber', () => {
  const event = (payload: Record<string, unknown>): DomainEvent => ({
    name: DOMAIN_EVENTS.PAYMENT_WEBHOOK_UNMATCHED,
    payload,
    occurredAt: new Date().toISOString(),
  });

  const build = (): {
    subscriber: UtilityPaymentSubscriber;
    utilities: { completeCardPurchaseByReference: jest.Mock };
    bus: { on: jest.Mock };
  } => {
    const utilities = { completeCardPurchaseByReference: jest.fn().mockResolvedValue(null) };
    const bus = { on: jest.fn() };
    const subscriber = new UtilityPaymentSubscriber(
      bus as unknown as DomainEventBus,
      utilities as unknown as UtilitiesService,
    );
    return { subscriber, utilities, bus };
  };

  it('subscribes to the unmatched-webhook event on boot', () => {
    const { subscriber, bus } = build();
    subscriber.onModuleInit();
    expect(bus.on).toHaveBeenCalledWith(
      DOMAIN_EVENTS.PAYMENT_WEBHOOK_UNMATCHED,
      expect.any(Function),
    );
  });

  it('settles the purchase the reference belongs to', async () => {
    const { subscriber, utilities } = build();
    await subscriber.handle(event({ reference: 'UTIL-b3370710-1787109606020', success: true }));
    expect(utilities.completeCardPurchaseByReference).toHaveBeenCalledWith(
      'UTIL-b3370710-1787109606020',
      {},
    );
  });

  it('ignores a failed payment', async () => {
    const { subscriber, utilities } = build();
    await subscriber.handle(event({ reference: 'UTIL-abc-1', success: false }));
    expect(utilities.completeCardPurchaseByReference).not.toHaveBeenCalled();
  });

  it('ignores an event with no reference', async () => {
    const { subscriber, utilities } = build();
    await subscriber.handle(event({ success: true }));
    expect(utilities.completeCardPurchaseByReference).not.toHaveBeenCalled();
  });

  // A reference belonging to a wallet top-up or a ride reaches this handler
  // too — every subscriber sees every unmatched webhook. Missing is normal.
  it('does nothing when the reference is not a utility purchase', async () => {
    const { subscriber, utilities } = build();
    utilities.completeCardPurchaseByReference.mockResolvedValue(null);
    await expect(
      subscriber.handle(event({ reference: 'WALLET-abc-1', success: true })),
    ).resolves.toBeUndefined();
  });

  // A throw here would reject inside the event bus's dispatch. Swallowed and
  // logged, exactly like OrderReadySubscriber.
  it('does not throw when settlement fails', async () => {
    const { subscriber, utilities } = build();
    utilities.completeCardPurchaseByReference.mockRejectedValue(new Error('provider down'));
    await expect(
      subscriber.handle(event({ reference: 'UTIL-abc-1', success: true })),
    ).resolves.toBeUndefined();
  });
});
