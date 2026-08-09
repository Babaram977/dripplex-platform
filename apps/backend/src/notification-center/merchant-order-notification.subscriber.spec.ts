import { NotificationCategory, NotificationType } from '@prisma/client';

import { DOMAIN_EVENTS, type DomainEvent } from '../events/domain-events';

import { MerchantOrderNotificationSubscriber } from './merchant-order-notification.subscriber';

import type { NotificationCenterService } from './notification-center.service';
import type { PrismaService } from '../prisma/prisma.service';

function makeSubscriber(merchantUserId: string | null): {
  subscriber: MerchantOrderNotificationSubscriber;
  send: jest.Mock;
  findUnique: jest.Mock;
  eventBus: { on: jest.Mock };
} {
  const send = jest.fn().mockResolvedValue({ notification: null, skipped: false });
  const findUnique = jest
    .fn()
    .mockResolvedValue(merchantUserId === null ? null : { userId: merchantUserId });
  const prisma = { merchantProfile: { findUnique } } as unknown as PrismaService;
  const notificationCenter = { send } as unknown as NotificationCenterService;
  const eventBus = { on: jest.fn() };
  const subscriber = new MerchantOrderNotificationSubscriber(
    eventBus as never,
    notificationCenter,
    prisma,
  );
  return { subscriber, send, findUnique, eventBus };
}

function orderPaidEvent(payload: Record<string, unknown>): DomainEvent {
  return { name: DOMAIN_EVENTS.ORDER_PAID, payload } as DomainEvent;
}

describe('MerchantOrderNotificationSubscriber', () => {
  it('subscribes to ORDER_PAID on init', () => {
    const { subscriber, eventBus } = makeSubscriber('merchant-user-1');
    subscriber.onModuleInit();
    expect(eventBus.on).toHaveBeenCalledWith(DOMAIN_EVENTS.ORDER_PAID, expect.any(Function));
  });

  it('notifies the merchant user (resolved from MerchantProfile.id) on a new paid order', async () => {
    const { subscriber, send, findUnique } = makeSubscriber('merchant-user-1');
    await subscriber.handle(
      orderPaidEvent({
        orderId: 'order-1',
        merchantId: 'merchant-profile-1',
        customerId: 'cust-1',
      }),
    );
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'merchant-profile-1' },
      select: { userId: true },
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'merchant-user-1',
        category: NotificationCategory.MERCHANT,
        type: NotificationType.ORDER_PLACED,
        title: 'New order received',
        payload: expect.objectContaining({
          orderId: 'order-1',
          merchantProfileId: 'merchant-profile-1',
        }),
      }),
    );
  });

  it('is a no-op when the payload has no merchantId', async () => {
    const { subscriber, send, findUnique } = makeSubscriber('merchant-user-1');
    await subscriber.handle(orderPaidEvent({ orderId: 'order-1', customerId: 'cust-1' }));
    expect(findUnique).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('is a no-op when the merchant profile cannot be resolved', async () => {
    const { subscriber, send } = makeSubscriber(null);
    await subscriber.handle(orderPaidEvent({ orderId: 'order-1', merchantId: 'missing-profile' }));
    expect(send).not.toHaveBeenCalled();
  });
});
