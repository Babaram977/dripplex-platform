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
 * DPX-ORDER-8D-C — tells the merchant an order is slipping away from them.
 *
 * Founder remediation ruling, 2026-09-16: a confirmed delivery order left
 * unadvanced for 30 minutes becomes a DrippleX-managed exception, and the
 * merchant gets an explicit stalled-order warning rather than the order simply
 * sitting there.
 *
 * NOT NOTIFIED TWICE. This listens on ORDER_EXCEPTION_RAISED, which the sweep
 * emits only when an exception is newly created — and creation is guarded by a
 * unique constraint on (orderId, type). The sweep runs every fifteen minutes
 * against a thirty-minute threshold, so without that the merchant would be told
 * about the same order four times an hour until they acted, which is how a
 * warning becomes noise and then gets muted. The protection is a database
 * invariant, not something this subscriber has to remember.
 *
 * Separate from MerchantOrderNotificationSubscriber because the message is a
 * different fact — "you have a new order" versus "you have an order you have not
 * acted on" — and because that one hangs off ORDER_ACTIONABLE, which fires at
 * confirmation. Folding them together would couple a warning to an arrival.
 *
 * ORDER_STALLED is its own NotificationType rather than GENERIC or
 * ORDER_DELAYED. ORDER_DELAYED is the merchant telling the CUSTOMER they need
 * longer, which is close to the opposite situation. And NotificationPreference
 * is keyed on (channel, type), so folding this into GENERIC would mean a
 * merchant muting general chatter also mutes the one alert that says an order
 * is about to be lost.
 */
@Injectable()
export class OrderExceptionNotificationSubscriber implements OnModuleInit {
  constructor(
    private readonly eventBus: DomainEventBus,
    private readonly notificationCenter: NotificationCenterService,
    private readonly prisma: PrismaService,
  ) {}

  public onModuleInit(): void {
    this.eventBus.on(DOMAIN_EVENTS.ORDER_EXCEPTION_RAISED, (event) => this.handle(event));
  }

  public async handle(event: DomainEvent): Promise<void> {
    const payload = event.payload;

    const merchantProfileId =
      typeof payload['merchantId'] === 'string' ? payload['merchantId'] : '';
    const orderId = typeof payload['orderId'] === 'string' ? payload['orderId'] : '';
    const orderNumber = typeof payload['orderNumber'] === 'string' ? payload['orderNumber'] : '';
    const waitedMinutes =
      typeof payload['waitedMinutes'] === 'number' ? payload['waitedMinutes'] : 0;
    if (merchantProfileId === '') {
      return;
    }

    // The payload carries the MerchantProfile.id; the notification recipient is
    // the owning User.id. No row → nobody to tell.
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
      type: NotificationType.ORDER_STALLED,
      title: 'An order is still waiting',
      // States the elapsed time rather than a vague "a while ago": a merchant
      // deciding whether to act needs to know it has been half an hour, not
      // that something is generically late.
      body:
        orderNumber === ''
          ? `An order has been waiting ${String(waitedMinutes)} minutes for you to accept it.`
          : `Order ${orderNumber} has been waiting ${String(waitedMinutes)} minutes for you to accept it.`,
      priority: NotificationPriority.HIGH,
      payload: { version: PAYLOAD_VERSION, orderId, merchantProfileId, waitedMinutes },
    });
  }
}
