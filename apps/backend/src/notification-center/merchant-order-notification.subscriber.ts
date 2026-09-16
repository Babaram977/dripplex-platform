import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  NotificationCategory,
  NotificationChannel,
  NotificationPriority,
  NotificationType,
} from '@prisma/client';

import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS, type DomainEvent } from '../events/domain-events';
import { PrismaService } from '../prisma/prisma.service';

import { NotificationCenterService } from './notification-center.service';

const PAYLOAD_VERSION = 1;

/**
 * DPX-MERCHANT (pilot closed-loop) — notifies the MERCHANT when a new order
 * becomes actionable (paid/confirmed). The generic NotificationCenterSubscriber
 * maps every order event to the *customer* only, so without this the merchant is
 * never told an order arrived — breaking the closed loop
 * (customer order → merchant notification → accept → prepare → ready → dispatch).
 *
 * Kept as a separate handler rather than folding into the shared subscriber's
 * one-mapping-per-event table because (a) the merchant needs a distinct message,
 * and (b) the payload's `merchantId` is a `MerchantProfile.id`, not a
 * `User.id`, so the recipient must be resolved to the owning user first. Reuses
 * the same `NotificationCenterService` (no duplicate notification architecture).
 *
 * TRIGGERS ON ORDER_ACTIONABLE — founder ruling, 2026-09-15.
 *
 * It used to trigger on ORDER_PAID, and the comment here asserted that
 * ORDER_PAID "is emitted at confirmation for every payment method including
 * CASH-on-delivery selection — so cash-first pilot orders are covered."
 * **That was false.** `selectCashOnDelivery` and `selectMerchantDirect` emit
 * no event at all; the only CASH ORDER_PAID comes from
 * `markCashPaymentReceived`, which fires on DELIVERY_COMPLETED. So a cash
 * order could never notify the merchant, never be accepted, never reach READY,
 * never get a DeliveryJob, never be delivered — and therefore never reach the
 * one path that would have emitted ORDER_PAID. A closed loop that could not
 * start. One live order sat in it for four days.
 *
 * The lesson encoded by the move: **merchant notification must not depend on
 * how the order was paid.** ORDER_ACTIONABLE fires from the single confirmation
 * chokepoint for every payment method, so a future method cannot silently opt
 * out of it.
 *
 * This is a MOVE, not an addition. Gateway and wallet orders already emitted
 * ORDER_PAID; had this kept listening to both, they would now be notified
 * twice.
 */
@Injectable()
export class MerchantOrderNotificationSubscriber implements OnModuleInit {
  constructor(
    private readonly eventBus: DomainEventBus,
    private readonly notificationCenter: NotificationCenterService,
    private readonly prisma: PrismaService,
  ) {}

  public onModuleInit(): void {
    this.eventBus.on(DOMAIN_EVENTS.ORDER_ACTIONABLE, (event) => this.handle(event));
  }

  public async handle(event: DomainEvent): Promise<void> {
    const payload = event.payload;

    const merchantProfileId =
      typeof payload['merchantId'] === 'string' ? payload['merchantId'] : '';
    const orderId = typeof payload['orderId'] === 'string' ? payload['orderId'] : '';
    if (merchantProfileId === '') {
      return;
    }

    // The payload carries the MerchantProfile.id; resolve it to the owning
    // User.id (the notification recipient). No row → nothing to notify.
    const profile = await this.prisma.merchantProfile.findUnique({
      where: { id: merchantProfileId },
      select: { userId: true },
    });
    if (!profile) {
      return;
    }

    await this.notificationCenter.send({
      userId: profile.userId,
      category: NotificationCategory.MERCHANT,
      channel: NotificationChannel.IN_APP,
      type: NotificationType.ORDER_PLACED,
      title: 'New order received',
      body: 'You have a new order to review. Accept it to start preparing.',
      priority: NotificationPriority.HIGH,
      payload: { version: PAYLOAD_VERSION, orderId, merchantProfileId },
    });
  }
}
