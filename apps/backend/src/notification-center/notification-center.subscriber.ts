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
  category: NotificationCategory;
  type: NotificationType;
  title: string;
  body: (payload: Record<string, unknown>) => string;
  priority?: NotificationPriority;
  userKeys: string[];
  /** Merged into `payload.deepLink` and forwarded as FCM `data.deepLink`
   * (see firebase-push.provider.ts) so a tapped push can open the right
   * screen. Only set where a real destination route exists — omitted
   * (not a guessed fallback) rather than mapped to some page for every
   * event type. */
  deepLink?: string;
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
      title: 'Welcome to DrippleX',
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

    const payload: Record<string, unknown> = {
      version: PAYLOAD_VERSION,
      ...this.objectPayload(event.payload),
      ...(mapping.deepLink !== undefined ? { deepLink: mapping.deepLink } : {}),
    };
    const broadcastUserIds = this.stringArray(payload['userIds']);
    if (event.name === DOMAIN_EVENTS.PROMOTION_CREATED && broadcastUserIds.length > 0) {
      await this.notificationCenter.broadcast({
        userIds: broadcastUserIds,
        category: mapping.category,
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

    await this.notificationCenter.send({
      userId,
      category: mapping.category,
      channel: NotificationChannel.IN_APP,
      type: mapping.type,
      title: mapping.title,
      body: mapping.body(payload),
      payload,
      ...(mapping.priority !== undefined ? { priority: mapping.priority } : {}),
    });
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
