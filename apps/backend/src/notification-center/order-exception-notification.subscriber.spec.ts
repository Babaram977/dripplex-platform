import { NotificationCategory, NotificationType } from '@prisma/client';

import { DOMAIN_EVENTS, type DomainEvent } from '../events/domain-events';

import { OrderExceptionNotificationSubscriber } from './order-exception-notification.subscriber';

import type { NotificationCenterService } from './notification-center.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * DPX-ORDER-8D-C — the merchant's stalled-order warning.
 *
 * The repeat protection this relies on is a database unique constraint, proven
 * in orders/order-exception-idempotency.spec.ts. What is pinned here is that
 * the subscriber listens to the RAISED event and nothing else — because the
 * sweep runs every fifteen minutes against a thirty-minute threshold, and any
 * other trigger would tell the merchant about the same order four times an
 * hour.
 */

function makeSubscriber(merchantUserId: string | null): {
  subscriber: OrderExceptionNotificationSubscriber;
  send: jest.Mock;
  eventBus: { on: jest.Mock };
} {
  const send = jest.fn().mockResolvedValue({ notification: null, skipped: false });
  const findUnique = jest
    .fn()
    .mockResolvedValue(merchantUserId === null ? null : { userId: merchantUserId });
  const prisma = { merchantProfile: { findUnique } } as unknown as PrismaService;
  const notificationCenter = { send } as unknown as NotificationCenterService;
  const eventBus = { on: jest.fn() };
  const subscriber = new OrderExceptionNotificationSubscriber(
    eventBus as never,
    notificationCenter,
    prisma,
  );
  return { subscriber, send, eventBus };
}

const raisedEvent = (payload: Record<string, unknown>): DomainEvent =>
  ({ name: DOMAIN_EVENTS.ORDER_EXCEPTION_RAISED, payload }) as DomainEvent;

const basePayload = {
  orderId: 'order-1',
  orderNumber: 'DPX-20260911-F7GK1S',
  customerId: 'customer-1',
  merchantId: 'merchant-profile-1',
  type: 'STALLED_CONFIRMED',
  waitedMinutes: 45,
};

describe('OrderExceptionNotificationSubscriber', () => {
  it('OEN-001 · subscribes to ORDER_EXCEPTION_RAISED only', () => {
    const { subscriber, eventBus } = makeSubscriber('merchant-user-1');
    subscriber.onModuleInit();

    expect(eventBus.on).toHaveBeenCalledTimes(1);
    expect(eventBus.on).toHaveBeenCalledWith(
      DOMAIN_EVENTS.ORDER_EXCEPTION_RAISED,
      expect.any(Function),
    );
  });

  it('OEN-002 · warns the merchant user, resolved from the MerchantProfile id', async () => {
    const { subscriber, send } = makeSubscriber('merchant-user-1');

    await subscriber.handle(raisedEvent(basePayload));

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'merchant-user-1',
        category: NotificationCategory.MERCHANT,
        type: NotificationType.ORDER_STALLED,
      }),
    );
  });

  it('OEN-003 · states how long the order has waited, not merely that it is late', async () => {
    const { subscriber, send } = makeSubscriber('merchant-user-1');

    await subscriber.handle(raisedEvent(basePayload));

    const sent = send.mock.calls[0]?.[0] as { body: string };
    // A merchant deciding whether to act needs the elapsed time, not a vague
    // "a while ago".
    expect(sent.body).toContain('45 minutes');
    expect(sent.body).toContain('DPX-20260911-F7GK1S');
  });

  it('OEN-004 · is not a payment message', async () => {
    const { subscriber, send } = makeSubscriber('merchant-user-1');

    await subscriber.handle(raisedEvent(basePayload));

    const sent = send.mock.calls[0]?.[0] as { type: string; title: string };
    // ORDER_STALLED is its own type: ORDER_DELAYED is the merchant telling the
    // CUSTOMER they need longer, which is close to the opposite situation, and
    // GENERIC would let a merchant mute this along with general chatter.
    expect(sent.type).not.toBe(NotificationType.ORDER_DELAYED);
    expect(sent.type).not.toBe(NotificationType.GENERIC);
    expect(sent.title.toLowerCase()).not.toContain('paid');
  });

  it('OEN-005 · is a no-op when the merchant profile cannot be resolved', async () => {
    const { subscriber, send } = makeSubscriber(null);

    await subscriber.handle(raisedEvent(basePayload));

    expect(send).not.toHaveBeenCalled();
  });

  it('OEN-006 · is a no-op when the payload carries no merchantId', async () => {
    const { subscriber, send } = makeSubscriber('merchant-user-1');

    await subscriber.handle(raisedEvent({ ...basePayload, merchantId: undefined }));

    expect(send).not.toHaveBeenCalled();
  });

  it('OEN-007 · still says something useful when the order number is missing', async () => {
    const { subscriber, send } = makeSubscriber('merchant-user-1');

    await subscriber.handle(raisedEvent({ ...basePayload, orderNumber: undefined }));

    const sent = send.mock.calls[0]?.[0] as { body: string };
    expect(sent.body).toContain('45 minutes');
    expect(sent.body).not.toContain('undefined');
  });
});
