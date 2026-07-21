import { Injectable, OnModuleInit } from '@nestjs/common';
import { NotificationChannel, NotificationPriority, NotificationType } from '@prisma/client';

import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS, type DomainEvent } from '../events/domain-events';

import { NotificationCenterService } from './notification-center.service';

interface NotificationEventMapping {
  type: NotificationType;
  title: string;
  body: (payload: Record<string, unknown>) => string;
  priority?: NotificationPriority;
  userKeys: string[];
}

@Injectable()
export class NotificationCenterSubscriber implements OnModuleInit {
  private readonly mappings: Record<string, NotificationEventMapping> = {
    [DOMAIN_EVENTS.ORDER_CREATED]: {
      type: NotificationType.ORDER_PLACED,
      title: 'Order created',
      body: (payload) =>
        `Your order ${this.text(payload, ['orderNumber', 'orderId'], 'has been created')} is pending payment.`,
      userKeys: ['customerId', 'userId'],
    },
    [DOMAIN_EVENTS.ORDER_PAID]: {
      type: NotificationType.PAYMENT_SUCCESS,
      title: 'Order paid',
      body: (payload) =>
        `Payment for order ${this.text(payload, ['orderNumber', 'orderId'], '')} was received.`,
      userKeys: ['customerId', 'userId'],
    },
    [DOMAIN_EVENTS.PAYMENT_FAILED]: {
      type: NotificationType.PAYMENT_FAILED,
      title: 'Payment failed',
      body: (payload) =>
        `Your payment ${this.text(payload, ['reference'], '')} could not be completed.`,
      priority: NotificationPriority.HIGH,
      userKeys: ['customerId', 'userId'],
    },
    [DOMAIN_EVENTS.DELIVERY_ASSIGNED]: {
      type: NotificationType.RIDER_ASSIGNED,
      title: 'Delivery assigned',
      body: (payload) =>
        `Delivery ${this.text(payload, ['jobId', 'orderNumber'], '')} has been assigned.`,
      userKeys: ['riderId', 'customerId', 'userId'],
    },
    [DOMAIN_EVENTS.DELIVERY_COMPLETED]: {
      type: NotificationType.DELIVERY_COMPLETED,
      title: 'Delivery completed',
      body: (payload) =>
        `Delivery ${this.text(payload, ['jobId', 'orderNumber'], '')} has been completed.`,
      userKeys: ['customerId', 'riderId', 'userId'],
    },
    [DOMAIN_EVENTS.PASSWORD_RESET]: {
      type: NotificationType.PASSWORD_RESET,
      title: 'Password reset requested',
      body: () => 'A password reset was requested for your account.',
      priority: NotificationPriority.HIGH,
      userKeys: ['userId', 'customerId'],
    },
    [DOMAIN_EVENTS.OTP_REQUESTED]: {
      type: NotificationType.OTP,
      title: 'Verification code requested',
      body: () => 'A verification code was requested for your account.',
      priority: NotificationPriority.HIGH,
      userKeys: ['userId', 'customerId'],
    },
    [DOMAIN_EVENTS.CUSTOMER_REGISTERED]: {
      type: NotificationType.WELCOME,
      title: 'Welcome to Dripplex',
      body: (payload) =>
        `Welcome${this.text(payload, ['firstName', 'name'], '') ? `, ${this.text(payload, ['firstName', 'name'], '')}` : ''}!`,
      userKeys: ['userId', 'customerId'],
    },
    [DOMAIN_EVENTS.INVENTORY_LOW]: {
      type: NotificationType.LOW_INVENTORY,
      title: 'Inventory is low',
      body: (payload) =>
        `${this.text(payload, ['productName', 'productId'], 'An item')} is running low.`,
      priority: NotificationPriority.HIGH,
      userKeys: ['merchantId', 'userId'],
    },
    [DOMAIN_EVENTS.MERCHANT_APPROVED]: {
      type: NotificationType.MERCHANT_APPROVAL,
      title: 'Merchant approved',
      body: () => 'Your merchant account has been approved.',
      userKeys: ['merchantId', 'userId'],
    },
    [DOMAIN_EVENTS.RIDER_APPROVED]: {
      type: NotificationType.RIDER_APPROVAL,
      title: 'Rider approved',
      body: () => 'Your rider account has been approved.',
      userKeys: ['riderId', 'userId'],
    },
    [DOMAIN_EVENTS.PROMOTION_CREATED]: {
      type: NotificationType.PROMOTION,
      title: 'New promotion',
      body: (payload) =>
        `${this.text(payload, ['title', 'promotionName'], 'A new promotion')} is now available.`,
      userKeys: ['userId', 'customerId'],
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

    const payload = this.objectPayload(event.payload);
    const broadcastUserIds = this.stringArray(payload['userIds']);
    if (event.name === DOMAIN_EVENTS.PROMOTION_CREATED && broadcastUserIds.length > 0) {
      await this.notificationCenter.broadcast({
        userIds: broadcastUserIds,
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
