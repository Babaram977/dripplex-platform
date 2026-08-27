import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  NotificationCategory,
  NotificationChannel,
  NotificationPriority,
  NotificationType,
} from '@prisma/client';

import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS, type DomainEvent } from '../events/domain-events';

import { NotificationCenterService } from './notification-center.service';

/** Every payload constructed here includes `version: 1` — see
 * docs/DPX-CORE-001-NOTIFICATION-PLATFORM.md's payload-versioning note.
 * Lets mobile/web clients evolve how they read `payload` without breaking
 * older builds still receiving unversioned or v1 shapes. */
const PAYLOAD_VERSION = 1;

interface NotificationEventMapping {
  /**
   * Which module this belongs to. A function where one event serves more than
   * one — DPX-MOBILE-002's call ring is the same event whether the job is a
   * ride or a delivery, and filing every call under RIDE would mislabel half
   * of them in the recipient's own inbox.
   */
  category: NotificationCategory | ((payload: Record<string, unknown>) => NotificationCategory);
  type: NotificationType;
  title: string;
  body: (payload: Record<string, unknown>) => string;
  priority?: NotificationPriority;
  /**
   * Which channels this event is delivered on. Defaults to IN_APP alone, which
   * is what every mapping here did unconditionally before DPX-MOBILE-001 — so
   * every existing event keeps its exact behaviour.
   *
   * IN_APP writes the row the notification centre lists and nothing more; it
   * never reaches a device. An event that must reach a phone that is not on
   * screen has to name PUSH explicitly. Each channel is a separate `send`, so
   * each is independently subject to the recipient's own preference for that
   * (channel, type) pair — a driver can silence the push and keep the in-app
   * record, or the reverse.
   */
  channels?: NotificationChannel[];
  userKeys: string[];
  /** Merged into `payload.deepLink` and forwarded as FCM `data.deepLink`
   * (see firebase-push.provider.ts) so a tapped push can open the right
   * screen. Only set where a real destination route exists — omitted
   * (not a guessed fallback) rather than mapped to some page for every
   * event type. */
  deepLink?: string | ((payload: Record<string, unknown>) => string | undefined);
}

@Injectable()
export class NotificationCenterSubscriber implements OnModuleInit {
  private readonly mappings: Record<string, NotificationEventMapping> = {
    [DOMAIN_EVENTS.ORDER_CREATED]: {
      category: NotificationCategory.MARKETPLACE,
      type: NotificationType.ORDER_PLACED,
      title: 'Order created',
      body: (payload) =>
        `Your order ${this.text(payload, ['orderNumber', 'orderId'], 'has been created')} is pending payment.`,
      userKeys: ['customerId', 'userId'],
    },
    [DOMAIN_EVENTS.ORDER_PAID]: {
      category: NotificationCategory.MARKETPLACE,
      type: NotificationType.PAYMENT_SUCCESS,
      title: 'Order paid',
      body: (payload) =>
        `Payment for order ${this.text(payload, ['orderNumber', 'orderId'], '')} was received.`,
      userKeys: ['customerId', 'userId'],
    },
    [DOMAIN_EVENTS.ORDER_ACCEPTED]: {
      category: NotificationCategory.MARKETPLACE,
      type: NotificationType.ORDER_ACCEPTED,
      title: 'Order accepted',
      body: () => 'Your order has been accepted and is being prepared.',
      userKeys: ['customerId', 'userId'],
    },
    [DOMAIN_EVENTS.ORDER_REJECTED]: {
      category: NotificationCategory.MARKETPLACE,
      type: NotificationType.ORDER_REJECTED,
      title: 'Order declined',
      body: (payload) =>
        `Your order was declined by the merchant${this.text(payload, ['reason'], '') ? `: ${this.text(payload, ['reason'], '')}` : ''}. A refund has been issued.`,
      priority: NotificationPriority.HIGH,
      userKeys: ['customerId', 'userId'],
    },
    [DOMAIN_EVENTS.ORDER_READY]: {
      category: NotificationCategory.MARKETPLACE,
      type: NotificationType.ORDER_READY,
      title: 'Order ready',
      body: () => 'Your order is ready.',
      userKeys: ['customerId', 'userId'],
    },
    [DOMAIN_EVENTS.ORDER_DELAYED]: {
      category: NotificationCategory.MARKETPLACE,
      type: NotificationType.ORDER_DELAYED,
      title: 'Order delayed',
      body: () => 'Your order is taking a bit longer than expected.',
      userKeys: ['customerId', 'userId'],
    },
    [DOMAIN_EVENTS.ORDER_COMPLETED]: {
      category: NotificationCategory.MARKETPLACE,
      type: NotificationType.ORDER_COMPLETED,
      title: 'Order completed',
      body: () => 'Your order has been marked as completed.',
      userKeys: ['customerId', 'userId'],
    },
    [DOMAIN_EVENTS.PAYMENT_FAILED]: {
      category: NotificationCategory.MARKETPLACE,
      type: NotificationType.PAYMENT_FAILED,
      title: 'Payment failed',
      body: (payload) =>
        `Your payment ${this.text(payload, ['reference'], '')} could not be completed.`,
      priority: NotificationPriority.HIGH,
      userKeys: ['customerId', 'userId'],
    },
    [DOMAIN_EVENTS.DELIVERY_ASSIGNED]: {
      category: NotificationCategory.DELIVERY,
      type: NotificationType.RIDER_ASSIGNED,
      title: 'Delivery assigned',
      body: (payload) =>
        `Delivery ${this.text(payload, ['jobId', 'orderNumber'], '')} has been assigned.`,
      userKeys: ['riderId', 'customerId', 'userId'],
    },
    [DOMAIN_EVENTS.DELIVERY_COMPLETED]: {
      category: NotificationCategory.DELIVERY,
      type: NotificationType.DELIVERY_COMPLETED,
      title: 'Delivery completed',
      body: (payload) =>
        `Delivery ${this.text(payload, ['jobId', 'orderNumber'], '')} has been completed.`,
      userKeys: ['customerId', 'riderId', 'userId'],
    },
    [DOMAIN_EVENTS.PASSWORD_RESET]: {
      category: NotificationCategory.SECURITY,
      type: NotificationType.PASSWORD_RESET,
      title: 'Password reset requested',
      body: () => 'A password reset was requested for your account.',
      priority: NotificationPriority.HIGH,
      userKeys: ['userId', 'customerId'],
    },
    [DOMAIN_EVENTS.OTP_REQUESTED]: {
      category: NotificationCategory.SECURITY,
      type: NotificationType.OTP,
      title: 'Verification code requested',
      body: () => 'A verification code was requested for your account.',
      priority: NotificationPriority.HIGH,
      userKeys: ['userId', 'customerId'],
    },
    [DOMAIN_EVENTS.CUSTOMER_REGISTERED]: {
      category: NotificationCategory.SYSTEM,
      type: NotificationType.WELCOME,
      title: 'Welcome to Dripplex',
      body: (payload) =>
        `Welcome${this.text(payload, ['firstName', 'name'], '') ? `, ${this.text(payload, ['firstName', 'name'], '')}` : ''}!`,
      userKeys: ['userId', 'customerId'],
    },
    [DOMAIN_EVENTS.INVENTORY_LOW]: {
      category: NotificationCategory.MERCHANT,
      type: NotificationType.LOW_INVENTORY,
      title: 'Inventory is low',
      body: (payload) =>
        `${this.text(payload, ['productName', 'productId'], 'An item')} is running low.`,
      priority: NotificationPriority.HIGH,
      userKeys: ['merchantId', 'userId'],
    },
    [DOMAIN_EVENTS.MERCHANT_APPROVED]: {
      category: NotificationCategory.MERCHANT,
      type: NotificationType.MERCHANT_APPROVAL,
      title: 'Merchant approved',
      body: () => 'Your merchant account has been approved.',
      userKeys: ['merchantId', 'userId'],
    },
    [DOMAIN_EVENTS.RIDER_APPROVED]: {
      category: NotificationCategory.DELIVERY,
      type: NotificationType.RIDER_APPROVAL,
      title: 'Rider approved',
      body: () => 'Your rider account has been approved.',
      userKeys: ['riderId', 'userId'],
    },
    [DOMAIN_EVENTS.PROMOTION_CREATED]: {
      category: NotificationCategory.MARKETING,
      type: NotificationType.PROMOTION,
      title: 'New promotion',
      body: (payload) =>
        `${this.text(payload, ['title', 'promotionName'], 'A new promotion')} is now available.`,
      userKeys: ['userId', 'customerId'],
    },
    // DPX-MOBILE-001 — the only ride notification addressed to a driver rather
    // than a passenger, and the only one with a deadline: the offer rotates
    // after RIDE_OFFER_TIMEOUT_MS. CRITICAL is what makes the delivery
    // high-priority at FCM (see firebase-push.provider.ts) so it wakes a device
    // in Doze instead of being batched until the phone is next unlocked — by
    // which time the offer is long gone.
    //
    // No deepLink. The super-app is a single-screen shell with no route for a
    // pending offer, and this mapping's own contract is that a destination is
    // omitted rather than guessed. Tapping opens the app, which lands the driver
    // on their dashboard where the offer card already lives.
    [DOMAIN_EVENTS.RIDE_OFFERED]: {
      category: NotificationCategory.RIDE,
      type: NotificationType.RIDE_OFFERED,
      title: 'New ride request',
      body: () => 'A passenger is waiting. Open DrippleX to accept.',
      priority: NotificationPriority.CRITICAL,
      // The first mapping to name PUSH. IN_APP alone would write a row the
      // driver only sees once they have already opened the app — which is
      // precisely the moment they no longer needed telling.
      channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
      userKeys: ['driverId'],
    },
    // DPX-MOBILE-002 Stage 2 — the phone has to ring while the app is shut.
    //
    // The shortest deadline on the platform: CALL_RING_TIMEOUT_MS, not the
    // minutes a ride offer gets. CRITICAL earns the high-priority FCM delivery
    // that escapes Doze, and `expiresAt` on the event gives it a TTL, so a ring
    // that would land after the caller hung up is dropped by FCM rather than
    // delivered to somebody who taps it and finds nothing.
    //
    // Its own Android channel (firebase-push.provider.ts) rather than the ride
    // one: a driver who silences ride requests between shifts has not asked to
    // silence the passenger phoning them mid-trip.
    //
    // The deepLink carries the call, because the ring itself is the only thing
    // that knows about it — `call:incoming` went out over a socket the callee's
    // app was not connected to, so opening the app afterwards would otherwise
    // show nothing. `expires` rides along so the client can refuse to ring for
    // a call that is already over, which is the same guard as the TTL for the
    // case where the push was delivered in time but tapped late.
    [DOMAIN_EVENTS.CALL_INCOMING]: {
      category: (payload) =>
        this.text(payload, ['contextType'], '') === 'DELIVERY'
          ? NotificationCategory.DELIVERY
          : NotificationCategory.RIDE,
      type: NotificationType.CALL_INCOMING,
      title: 'Incoming call',
      body: (payload) =>
        `${this.text(payload, ['callerName'], 'Someone')} is calling you about your ${
          this.text(payload, ['contextType'], '') === 'DELIVERY' ? 'delivery' : 'trip'
        }.`,
      priority: NotificationPriority.CRITICAL,
      channels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
      userKeys: ['calleeId'],
      deepLink: (payload) => {
        const callId = this.text(payload, ['callId'], '');
        if (!callId) return undefined;
        const expires = this.text(payload, ['expiresAt'], '');
        const context = this.text(payload, ['contextType'], '');
        const query = new URLSearchParams({
          ...(expires ? { expires } : {}),
          ...(context ? { context } : {}),
        }).toString();
        return `/call/${callId}${query ? `?${query}` : ''}`;
      },
    },
    [DOMAIN_EVENTS.RIDE_DRIVER_ASSIGNED]: {
      category: NotificationCategory.RIDE,
      type: NotificationType.RIDE_DRIVER_ASSIGNED,
      title: 'Driver assigned',
      body: () => 'A driver has been assigned to your ride.',
      userKeys: ['customerId', 'userId'],
      deepLink: '/ride',
    },
    [DOMAIN_EVENTS.RIDE_DRIVER_ARRIVED]: {
      category: NotificationCategory.RIDE,
      type: NotificationType.RIDE_DRIVER_ARRIVED,
      title: 'Driver arrived',
      body: () => 'Your driver has arrived at the pickup point.',
      priority: NotificationPriority.HIGH,
      userKeys: ['customerId', 'userId'],
      deepLink: '/ride',
    },
    [DOMAIN_EVENTS.RIDE_STARTED]: {
      category: NotificationCategory.RIDE,
      type: NotificationType.RIDE_STARTED,
      title: 'Trip started',
      body: () => 'Your trip has started.',
      userKeys: ['customerId', 'userId'],
      deepLink: '/ride',
    },
    [DOMAIN_EVENTS.RIDE_COMPLETED]: {
      category: NotificationCategory.RIDE,
      type: NotificationType.RIDE_COMPLETED,
      title: 'Trip completed',
      body: (payload) =>
        `Your trip has ended${this.text(payload, ['totalFare'], '') ? ` — total fare ₦${this.text(payload, ['totalFare'], '')}` : ''}.`,
      userKeys: ['customerId', 'userId'],
      deepLink: '/ride',
    },
    [DOMAIN_EVENTS.RIDE_CANCELLED]: {
      category: NotificationCategory.RIDE,
      type: NotificationType.GENERIC,
      title: 'Ride cancelled',
      body: () => 'A ride you were on has been cancelled.',
      priority: NotificationPriority.HIGH,
      /** Emitted from both cancellation call sites (RidesService.cancelRide
       * for a customer-initiated cancel, RideTripService.cancelByDriver for
       * a driver-initiated one) — each includes only the *other* party's id
       * in the payload, so this single mapping naturally routes to whichever
       * side didn't do the cancelling, the same pattern DELIVERY_ASSIGNED
       * already uses for riderId vs customerId. */
      userKeys: ['driverId', 'customerId', 'userId'],
    },
    [DOMAIN_EVENTS.RIDE_PAYMENT_SUCCEEDED]: {
      category: NotificationCategory.RIDE,
      type: NotificationType.PAYMENT_SUCCESS,
      title: 'Ride payment received',
      body: () => 'Your ride payment was successful.',
      userKeys: ['customerId', 'userId'],
    },
    [DOMAIN_EVENTS.RIDE_CASH_CONFIRMED]: {
      category: NotificationCategory.RIDE,
      type: NotificationType.PAYMENT_SUCCESS,
      title: 'Cash payment confirmed',
      body: (payload) =>
        `You confirmed a cash payment of ₦${this.text(payload, ['totalFare'], '0')}.`,
      userKeys: ['driverId', 'userId'],
    },
    [DOMAIN_EVENTS.RIDE_PAYMENT_FAILED]: {
      category: NotificationCategory.RIDE,
      type: NotificationType.PAYMENT_FAILED,
      title: 'Ride payment failed',
      body: () => 'Your ride payment could not be completed.',
      priority: NotificationPriority.HIGH,
      userKeys: ['customerId', 'userId'],
    },
    [DOMAIN_EVENTS.RIDE_REFUNDED]: {
      category: NotificationCategory.RIDE,
      type: NotificationType.REFUND,
      title: 'Ride refunded',
      body: (payload) =>
        `Your ride fare${this.text(payload, ['amount'], '') ? ` of ₦${this.text(payload, ['amount'], '')}` : ''} was refunded.`,
      priority: NotificationPriority.HIGH,
      userKeys: ['customerId', 'userId'],
    },
    [DOMAIN_EVENTS.REFERRAL_REDEEMED]: {
      category: NotificationCategory.MARKETING,
      type: NotificationType.REFERRAL_REDEEMED,
      title: 'Your referral code was used',
      body: () => 'Someone signed up using your referral code!',
      userKeys: ['userId'],
    },
    [DOMAIN_EVENTS.REFERRAL_REWARDED]: {
      category: NotificationCategory.WALLET,
      type: NotificationType.REFERRAL_REWARDED,
      title: 'Referral reward credited',
      body: (payload) => `You earned ₦${this.text(payload, ['amount'], '0')} from a referral.`,
      userKeys: ['userId'],
    },
    [DOMAIN_EVENTS.DRIVER_REFERRAL_PASSENGER_REGISTERED]: {
      category: NotificationCategory.RIDE,
      type: NotificationType.DRIVER_REFERRAL_PASSENGER_REGISTERED,
      title: 'New referral signup',
      body: () => 'Someone signed up using your driver referral code.',
      userKeys: ['userId'],
    },
    [DOMAIN_EVENTS.DRIVER_REFERRAL_PASSENGER_QUALIFIED]: {
      category: NotificationCategory.RIDE,
      type: NotificationType.DRIVER_REFERRAL_PASSENGER_QUALIFIED,
      title: 'Referral qualified',
      body: () => 'A passenger you referred completed their required trips this month.',
      userKeys: ['userId'],
    },
    [DOMAIN_EVENTS.DRIVER_REFERRAL_TIER_SILVER_REACHED]: {
      category: NotificationCategory.RIDE,
      type: NotificationType.DRIVER_REFERRAL_TIER_SILVER,
      title: 'Silver tier reached',
      body: () => "You've reached Silver tier in this month's referral campaign!",
      priority: NotificationPriority.HIGH,
      userKeys: ['userId'],
    },
    [DOMAIN_EVENTS.DRIVER_REFERRAL_TIER_GOLD_REACHED]: {
      category: NotificationCategory.RIDE,
      type: NotificationType.DRIVER_REFERRAL_TIER_GOLD,
      title: 'Gold tier reached',
      body: () => "You've reached Gold tier in this month's referral campaign!",
      priority: NotificationPriority.HIGH,
      userKeys: ['userId'],
    },
    [DOMAIN_EVENTS.DRIVER_REFERRAL_REWARD_APPROVED]: {
      category: NotificationCategory.WALLET,
      type: NotificationType.DRIVER_REFERRAL_REWARD_APPROVED,
      title: 'Referral reward approved',
      body: (payload) =>
        `Your ₦${this.text(payload, ['amount'], '0')} referral campaign reward was approved.`,
      userKeys: ['userId'],
    },
    [DOMAIN_EVENTS.DRIVER_REFERRAL_REWARD_PAID]: {
      category: NotificationCategory.WALLET,
      type: NotificationType.DRIVER_REFERRAL_REWARD_PAID,
      title: 'Referral reward paid',
      body: (payload) =>
        `Your ₦${this.text(payload, ['amount'], '0')} referral campaign reward has been paid.`,
      priority: NotificationPriority.HIGH,
      userKeys: ['userId'],
    },
    [DOMAIN_EVENTS.PROMOTION_REDEEMED]: {
      category: NotificationCategory.MARKETING,
      type: NotificationType.PROMOTION_REDEEMED,
      title: 'Promotion applied',
      body: (payload) =>
        `${this.text(payload, ['code'], 'Your promotion')} was applied — you saved ₦${this.text(payload, ['discountAmount'], '0')}.`,
      userKeys: ['userId'],
    },
    [DOMAIN_EVENTS.CASHBACK_AWARDED]: {
      category: NotificationCategory.WALLET,
      type: NotificationType.CASHBACK_AWARDED,
      title: 'Cashback awarded',
      body: (payload) => `You earned ₦${this.text(payload, ['amount'], '0')} cashback.`,
      userKeys: ['userId'],
    },
    [DOMAIN_EVENTS.WITHDRAWAL_REQUESTED]: {
      category: NotificationCategory.WALLET,
      type: NotificationType.WITHDRAWAL_REQUESTED,
      title: 'Withdrawal requested',
      body: (payload) =>
        `Your withdrawal of ₦${this.text(payload, ['amount'], '0')} is being processed.`,
      userKeys: ['userId'],
    },
    [DOMAIN_EVENTS.WITHDRAWAL_COMPLETED]: {
      category: NotificationCategory.WALLET,
      type: NotificationType.WITHDRAWAL_COMPLETED,
      title: 'Withdrawal completed',
      body: (payload) =>
        `₦${this.text(payload, ['amount'], '0')} has been sent to your bank account.`,
      userKeys: ['userId'],
    },
    [DOMAIN_EVENTS.WITHDRAWAL_FAILED]: {
      category: NotificationCategory.WALLET,
      type: NotificationType.WITHDRAWAL_FAILED,
      title: 'Withdrawal failed',
      body: (payload) =>
        `Your withdrawal of ₦${this.text(payload, ['amount'], '0')} failed and was refunded to your wallet.`,
      userKeys: ['userId'],
    },
    [DOMAIN_EVENTS.COUPON_EXPIRED]: {
      category: NotificationCategory.MARKETING,
      type: NotificationType.PROMOTION_EXPIRED,
      title: 'Promotion expired',
      body: (payload) =>
        `${this.text(payload, ['code'], 'A promotion')} you tried to use has expired.`,
      userKeys: ['userId'],
    },
  };

  constructor(
    private readonly eventBus: DomainEventBus,
    private readonly notificationCenter: NotificationCenterService,
  ) {}

  public onModuleInit(): void {
    Object.keys(this.mappings).forEach((eventName) => {
      this.eventBus.on(eventName, (event) => this.handle(event));
    });
  }

  public async handle(event: DomainEvent): Promise<void> {
    const mapping = this.mappings[event.name];
    if (!mapping) {
      return;
    }

    const eventPayload = this.objectPayload(event.payload);
    const deepLink =
      typeof mapping.deepLink === 'function' ? mapping.deepLink(eventPayload) : mapping.deepLink;
    const payload: Record<string, unknown> = {
      version: PAYLOAD_VERSION,
      ...eventPayload,
      ...(deepLink !== undefined ? { deepLink } : {}),
    };
    const category =
      typeof mapping.category === 'function' ? mapping.category(payload) : mapping.category;
    const broadcastUserIds = this.stringArray(payload['userIds']);
    if (event.name === DOMAIN_EVENTS.PROMOTION_CREATED && broadcastUserIds.length > 0) {
      await this.notificationCenter.broadcast({
        userIds: broadcastUserIds,
        category,
        channel: NotificationChannel.IN_APP,
        type: mapping.type,
        title: mapping.title,
        body: mapping.body(payload),
        payload,
        ...(mapping.priority !== undefined ? { priority: mapping.priority } : {}),
      });
      return;
    }

    const userId = this.firstText(payload, mapping.userKeys);
    if (!userId) {
      return;
    }

    // Sequential, not Promise.all: `send` writes a Notification row and an
    // audit entry per channel, and a push that fails must not prevent the
    // in-app record from existing. Each is independently preference-gated.
    for (const channel of mapping.channels ?? [NotificationChannel.IN_APP]) {
      await this.notificationCenter.send({
        userId,
        category,
        channel,
        type: mapping.type,
        title: mapping.title,
        body: mapping.body(payload),
        payload,
        ...(mapping.priority !== undefined ? { priority: mapping.priority } : {}),
      });
    }
  }

  private objectPayload(payload: unknown): Record<string, unknown> {
    return payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : {};
  }

  private firstText(payload: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    }
    return null;
  }

  private text(payload: Record<string, unknown>, keys: string[], fallback: string): string {
    return this.firstText(payload, keys) ?? fallback;
  }

  private stringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
      : [];
  }
}
