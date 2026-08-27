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

  it('maps promotion redeemed events to a MARKETING-category notification', async () => {
    await subscriber.handle({
      name: DOMAIN_EVENTS.PROMOTION_REDEEMED,
      payload: { userId: 'user-1', code: 'SAVE10', discountAmount: '100' },
      occurredAt: new Date().toISOString(),
    });

    expect(notificationCenter.send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        category: NotificationCategory.MARKETING,
        type: NotificationType.PROMOTION_REDEEMED,
        body: 'SAVE10 was applied — you saved ₦100.',
      }),
    );
  });

  it('maps cashback awarded events to a WALLET-category notification', async () => {
    await subscriber.handle({
      name: DOMAIN_EVENTS.CASHBACK_AWARDED,
      payload: { userId: 'user-1', amount: '75' },
      occurredAt: new Date().toISOString(),
    });

    expect(notificationCenter.send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        category: NotificationCategory.WALLET,
        type: NotificationType.CASHBACK_AWARDED,
        body: 'You earned ₦75 cashback.',
      }),
    );
  });

  it('maps coupon expired events to a promo-expired notification', async () => {
    await subscriber.handle({
      name: DOMAIN_EVENTS.COUPON_EXPIRED,
      payload: { userId: 'user-1', code: 'SAVE10' },
      occurredAt: new Date().toISOString(),
    });

    expect(notificationCenter.send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        category: NotificationCategory.MARKETING,
        type: NotificationType.PROMOTION_EXPIRED,
        body: 'SAVE10 you tried to use has expired.',
      }),
    );
  });

  it('does not map the generic WalletCredited event (avoids double-notifying flows that already notify)', () => {
    subscriber.onModuleInit();
    expect(eventBus.on).not.toHaveBeenCalledWith(
      DOMAIN_EVENTS.WALLET_CREDITED,
      expect.any(Function),
    );
    expect(eventBus.on).toHaveBeenCalledWith(
      DOMAIN_EVENTS.PROMOTION_REDEEMED,
      expect.any(Function),
    );
    expect(eventBus.on).toHaveBeenCalledWith(DOMAIN_EVENTS.CASHBACK_AWARDED, expect.any(Function));
    expect(eventBus.on).toHaveBeenCalledWith(DOMAIN_EVENTS.COUPON_EXPIRED, expect.any(Function));
  });

  it('skips mapped events without a target user id', async () => {
    await subscriber.handle({
      name: DOMAIN_EVENTS.PAYMENT_SUCCEEDED,
      payload: { reference: 'ref-1' },
      occurredAt: new Date().toISOString(),
    });

    expect(notificationCenter.send).not.toHaveBeenCalled();
  });

  describe('DPX-MOBILE-001 — ride offered', () => {
    const offerEvent = (
      overrides: Record<string, unknown> = {},
    ): { name: string; payload: Record<string, unknown>; occurredAt: string } => ({
      name: DOMAIN_EVENTS.RIDE_OFFERED,
      payload: {
        driverId: 'driver-9',
        rideId: 'ride-9',
        expiresAt: '2026-08-26T21:00:00.000Z',
        ...overrides,
      },
      occurredAt: new Date().toISOString(),
    });

    it('subscribes to the ride offered event', () => {
      subscriber.onModuleInit();

      expect(eventBus.on).toHaveBeenCalledWith(DOMAIN_EVENTS.RIDE_OFFERED, expect.any(Function));
    });

    it('delivers on PUSH as well as IN_APP — an in-app row alone reaches nobody', async () => {
      await subscriber.handle(offerEvent());

      const channels = notificationCenter.send.mock.calls.map(([dto]) => dto.channel);
      expect(channels).toEqual([NotificationChannel.IN_APP, NotificationChannel.PUSH]);
    });

    it('addresses the driver, not the passenger', async () => {
      await subscriber.handle(offerEvent({ customerId: 'customer-1' }));

      for (const [dto] of notificationCenter.send.mock.calls) {
        expect(dto.userId).toBe('driver-9');
      }
    });

    it('sends at CRITICAL so FCM delivery is high-priority', async () => {
      await subscriber.handle(offerEvent());

      const push = notificationCenter.send.mock.calls
        .map(([dto]) => dto)
        .find((dto) => dto.channel === NotificationChannel.PUSH);
      expect(push?.priority).toBe('CRITICAL');
      expect(push?.type).toBe(NotificationType.RIDE_OFFERED);
      expect(push?.category).toBe(NotificationCategory.RIDE);
    });

    it('carries expiresAt through to the payload so delivery can be given a TTL', async () => {
      await subscriber.handle(offerEvent());

      const push = notificationCenter.send.mock.calls
        .map(([dto]) => dto)
        .find((dto) => dto.channel === NotificationChannel.PUSH);
      expect(push?.payload).toMatchObject({ expiresAt: '2026-08-26T21:00:00.000Z' });
    });

    it('sends nothing when the event carries no driver', async () => {
      await subscriber.handle(offerEvent({ driverId: undefined }));

      expect(notificationCenter.send).not.toHaveBeenCalled();
    });

    it('leaves every other mapping on IN_APP alone — no event starts pushing by accident', async () => {
      await subscriber.handle({
        name: DOMAIN_EVENTS.RIDE_DRIVER_ASSIGNED,
        payload: { customerId: 'user-1' },
        occurredAt: new Date().toISOString(),
      });

      expect(notificationCenter.send).toHaveBeenCalledTimes(1);
      expect(notificationCenter.send.mock.calls[0]?.[0].channel).toBe(NotificationChannel.IN_APP);
    });
  });

  describe('DPX-MOBILE-002 — incoming call', () => {
    const callEvent = (
      overrides: Record<string, unknown> = {},
    ): { name: string; payload: Record<string, unknown>; occurredAt: string } => ({
      name: DOMAIN_EVENTS.CALL_INCOMING,
      payload: {
        calleeId: 'driver-9',
        callerName: 'Ada Obi',
        callId: 'call-9',
        contextType: 'RIDE',
        contextId: 'ride-9',
        expiresAt: '2026-08-27T10:00:45.000Z',
        ...overrides,
      },
      occurredAt: new Date().toISOString(),
    });

    type SentDto = Parameters<NotificationCenterService['send']>[0];
    const pushOf = (): SentDto | undefined =>
      notificationCenter.send.mock.calls
        .map(([dto]) => dto)
        .find((dto) => dto.channel === NotificationChannel.PUSH);

    it('subscribes to the incoming call event', () => {
      subscriber.onModuleInit();

      expect(eventBus.on).toHaveBeenCalledWith(DOMAIN_EVENTS.CALL_INCOMING, expect.any(Function));
    });

    it('pushes at CRITICAL — a ring that waits for Doze to lift is not a ring', async () => {
      await subscriber.handle(callEvent());

      const push = pushOf();
      expect(push?.priority).toBe('CRITICAL');
      expect(push?.type).toBe(NotificationType.CALL_INCOMING);
    });

    it('carries expiresAt, which is what gives the push its TTL', async () => {
      await subscriber.handle(callEvent());

      expect(pushOf()?.payload).toMatchObject({ expiresAt: '2026-08-27T10:00:45.000Z' });
    });

    it('addresses the callee', async () => {
      await subscriber.handle(callEvent({ callerId: 'customer-1' }));

      for (const [dto] of notificationCenter.send.mock.calls) {
        expect(dto.userId).toBe('driver-9');
      }
    });

    it('names the caller in the body, because a ring with no name is not answerable', async () => {
      await subscriber.handle(callEvent());

      expect(pushOf()?.body).toBe('Ada Obi is calling you about your trip.');
    });

    it('files a delivery call under DELIVERY, not RIDE', async () => {
      // One event serves both kinds of job; a static category would mislabel
      // half of them in the recipient's own inbox.
      await subscriber.handle(callEvent({ contextType: 'DELIVERY' }));

      expect(pushOf()?.category).toBe(NotificationCategory.DELIVERY);
      expect(pushOf()?.body).toBe('Ada Obi is calling you about your delivery.');
    });

    it('files a ride call under RIDE', async () => {
      await subscriber.handle(callEvent());

      expect(pushOf()?.category).toBe(NotificationCategory.RIDE);
    });

    it('deep-links to the call itself, with its expiry and context', async () => {
      // The ring is the only thing that knows about this call — `call:incoming`
      // went to a socket the callee's app was not connected to. Opening the app
      // without this would show nothing.
      await subscriber.handle(callEvent());

      expect(pushOf()?.payload).toMatchObject({
        deepLink: '/call/call-9?expires=2026-08-27T10%3A00%3A45.000Z&context=RIDE',
      });
    });

    it('omits the deep link rather than linking to nothing when there is no call id', async () => {
      await subscriber.handle(callEvent({ callId: undefined }));

      expect(pushOf()?.payload).not.toHaveProperty('deepLink');
    });

    it('sends nothing when the event carries no callee', async () => {
      await subscriber.handle(callEvent({ calleeId: undefined }));

      expect(notificationCenter.send).not.toHaveBeenCalled();
    });
  });
});
