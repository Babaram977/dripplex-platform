import { NotificationCategory, NotificationChannel, NotificationType } from '@prisma/client';

import { DOMAIN_EVENTS } from '../events/domain-events';

import { NotificationCenterSubscriber } from './notification-center.subscriber';

import type { NotificationCenterService } from './notification-center.service';
import type { DomainEventBus } from '../events/domain-event-bus';

describe('NotificationCenterSubscriber', () => {
  let eventBus: jest.Mocked<DomainEventBus>;
  let notificationCenter: jest.Mocked<NotificationCenterService>;
  let subscriber: NotificationCenterSubscriber;

  beforeEach(() => {
    eventBus = {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    } as unknown as jest.Mocked<DomainEventBus>;
    notificationCenter = {
      send: jest.fn(),
      broadcast: jest.fn(),
    } as unknown as jest.Mocked<NotificationCenterService>;
    subscriber = new NotificationCenterSubscriber(eventBus, notificationCenter);
  });

  it('subscribes to notification source events on module init', () => {
    subscriber.onModuleInit();

    expect(eventBus.on).toHaveBeenCalledWith(DOMAIN_EVENTS.ORDER_CREATED, expect.any(Function));
    expect(eventBus.on).toHaveBeenCalledWith(DOMAIN_EVENTS.ORDER_PAID, expect.any(Function));
    expect(eventBus.on).not.toHaveBeenCalledWith(
      DOMAIN_EVENTS.PAYMENT_SUCCEEDED,
      expect.any(Function),
    );
    expect(eventBus.on).toHaveBeenCalledWith(DOMAIN_EVENTS.PAYMENT_FAILED, expect.any(Function));
    expect(eventBus.on).toHaveBeenCalledWith(DOMAIN_EVENTS.PROMOTION_CREATED, expect.any(Function));
  });

  it('maps order created events to in-app order notifications', async () => {
    await subscriber.handle({
      name: DOMAIN_EVENTS.ORDER_CREATED,
      payload: { customerId: 'user-1', orderNumber: 'ORD-1' },
      occurredAt: new Date().toISOString(),
    });

    expect(notificationCenter.send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        category: NotificationCategory.MARKETPLACE,
        channel: NotificationChannel.IN_APP,
        type: NotificationType.ORDER_PLACED,
        title: 'Order created',
        payload: expect.objectContaining({ version: 1, customerId: 'user-1' }),
      }),
    );
  });

  it('maps order paid events to payment success notifications', async () => {
    await subscriber.handle({
      name: DOMAIN_EVENTS.ORDER_PAID,
      payload: { customerId: 'user-1', orderNumber: 'ORD-1' },
      occurredAt: new Date().toISOString(),
    });

    expect(notificationCenter.send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        channel: NotificationChannel.IN_APP,
        type: NotificationType.PAYMENT_SUCCESS,
        title: 'Order paid',
      }),
    );
  });

  it('ignores payment succeeded events to avoid duplicate payment success notifications', async () => {
    await subscriber.handle({
      name: DOMAIN_EVENTS.PAYMENT_SUCCEEDED,
      payload: { customerId: 'user-1', reference: 'ref-1' },
      occurredAt: new Date().toISOString(),
    });

    expect(notificationCenter.send).not.toHaveBeenCalled();
  });

  it('broadcasts promotions when event payload includes user ids', async () => {
    await subscriber.handle({
      name: DOMAIN_EVENTS.PROMOTION_CREATED,
      payload: { userIds: ['user-1', 'user-2'], title: 'Flash sale' },
      occurredAt: new Date().toISOString(),
    });

    expect(notificationCenter.broadcast).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: ['user-1', 'user-2'],
        type: NotificationType.PROMOTION,
        body: 'Flash sale is now available.',
      }),
    );
  });

  it('maps ride driver assigned events to a RIDE-category notification', async () => {
    await subscriber.handle({
      name: DOMAIN_EVENTS.RIDE_DRIVER_ASSIGNED,
      payload: { customerId: 'user-1', rideId: 'ride-1' },
      occurredAt: new Date().toISOString(),
    });

    expect(notificationCenter.send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        category: NotificationCategory.RIDE,
        type: NotificationType.RIDE_DRIVER_ASSIGNED,
        payload: expect.objectContaining({ version: 1, rideId: 'ride-1', deepLink: '/ride' }),
      }),
    );
  });

  it('omits deepLink for events with no real destination route', async () => {
    await subscriber.handle({
      name: DOMAIN_EVENTS.ORDER_CREATED,
      payload: { customerId: 'user-1', orderId: 'order-1' },
      occurredAt: new Date().toISOString(),
    });

    const call = notificationCenter.send.mock.calls[0]?.[0];
    expect(call?.payload).not.toHaveProperty('deepLink');
  });

  it('maps referral redeemed events to a MARKETING-category notification for the referrer', async () => {
    await subscriber.handle({
      name: DOMAIN_EVENTS.REFERRAL_REDEEMED,
      payload: { userId: 'referrer-1', refereeUserId: 'referee-1', code: 'FRIEND01' },
      occurredAt: new Date().toISOString(),
    });

    expect(notificationCenter.send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'referrer-1',
        category: NotificationCategory.MARKETING,
        type: NotificationType.REFERRAL_REDEEMED,
        payload: expect.objectContaining({ version: 1, refereeUserId: 'referee-1' }),
      }),
    );
  });

  it('maps referral rewarded events to a WALLET-category notification', async () => {
    await subscriber.handle({
      name: DOMAIN_EVENTS.REFERRAL_REWARDED,
      payload: { userId: 'user-1', amount: '500', role: 'referee' },
      occurredAt: new Date().toISOString(),
    });

    expect(notificationCenter.send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        category: NotificationCategory.WALLET,
        type: NotificationType.REFERRAL_REWARDED,
        body: 'You earned ₦500 from a referral.',
      }),
    );
  });

  it('skips mapped events without a target user id', async () => {
    await subscriber.handle({
      name: DOMAIN_EVENTS.PAYMENT_SUCCEEDED,
      payload: { reference: 'ref-1' },
      occurredAt: new Date().toISOString(),
    });

    expect(notificationCenter.send).not.toHaveBeenCalled();
  });
});
