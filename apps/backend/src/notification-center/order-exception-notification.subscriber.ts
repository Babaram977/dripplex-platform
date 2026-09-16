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
 * ⚠️ THIS HANDLER MUST STAY SIDE-EFFECT-FREE with respect to orders, payments,
 * wallets, refunds and settlements. Founder constraint, 2026-09-16.
 *
 * Delivery is AT-LEAST-ONCE by design. The exception row is committed before
 * the notification is emitted, and the sweep retries anything still carrying a
 * null `notifiedAt` — so an emit that succeeds and then fails to record itself
 * is announced twice. That was chosen deliberately: told twice beats never told
 * for an operational warning.
 *
 * It is only safe while this handler does nothing but write a notification.
 * Today a duplicate costs one extra notification row, one audit entry and one
 * IN_APP delivery attempt, and nothing else — there is exactly one listener on
 * ORDER_EXCEPTION_RAISED and no catch-all subscriber anywhere.
 *
 * Adding a business mutation here — auto-declining, refunding, releasing
 * inventory, crediting anything — would turn a duplicate warning into a
 * duplicate financial action. That needs an explicit idempotency design first,
 * and almost certainly a separate ruling, because the 30-minute threshold is an
 * escalation threshold and not an authority to act.
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
