import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationCategory,
  NotificationChannel,
  NotificationPriority,
  NotificationType,
} from '@prisma/client';

import { NotificationCenterService } from '../notification-center/notification-center.service';

import type { AuditContext } from '../audit/audit.service';
import type { Booking, BookingSettlement } from '@prisma/client';

const PAYLOAD_VERSION = 1;

/**
 * Tells a **hotel** what is happening to its rooms and its money.
 *
 * The guest side of this shipped in #234. The hotel side did not, and the gap
 * is worse: a guest who hears nothing can open the app and look, whereas a
 * hotel that hears nothing **loses the sale**. Founder decision 9 gives a hotel
 * thirty minutes to answer a request, and its stated reason is that "a small
 * hotel does not watch the app continuously" — which is precisely why the
 * thirty minutes cannot be delivered by an in-app badge alone.
 *
 * ## No new enum values
 *
 * Every type here already exists. `NotificationType` and `NotificationCategory`
 * are Postgres enums, so adding to them costs a migration on a live database,
 * and nothing here needs one:
 *
 * | Event | Type | Why this one |
 * | --- | --- | --- |
 * | A guest applied | `ORDER_PLACED` | Exactly what `MerchantOrderNotificationSubscriber` sends a merchant when an order arrives. A booking request is the same event in the same inbox. |
 * | The guest paid | `PAYMENT_SUCCESS` | The schema's own comment names `PAYMENT_SUCCESS` as a type deliberately shared across categories. |
 * | It lapsed | `BOOKING_EXPIRED` | Already exists from the guest side and means the same thing here. |
 * | The weekly payout landed | `PAYMENT_SUCCESS` | Money arriving, under the WALLET category where a merchant looks for money movement. |
 *
 * ## Category follows the audience, not the subject
 *
 * These are `MERCHANT`, not `BOOKING`. The existing convention splits by who is
 * being told: a customer's order notification is `MARKETPLACE` while the
 * merchant's notification about the *same order* is `MERCHANT`. So the guest's
 * booking notifications are `BOOKING` (shipped in #234) and the hotel's are
 * `MERCHANT`, alongside its order and approval notifications.
 *
 * Worth knowing this changes nothing about delivery: `MerchantNotificationsController`
 * lists by `userId` and does not filter on category at all. The choice is about
 * the row being correct, not about whether a hotel can see it.
 *
 * ## PUSH as well as IN_APP, which diverges from the order subscriber
 *
 * `MerchantOrderNotificationSubscriber` sends IN_APP only. That is arguably a
 * gap there; here it would defeat the point. A hotel with the app closed is the
 * normal case, and an in-app-only notification about a thirty-minute window is
 * a notification nobody reads in time. Flagged rather than silently copied.
 *
 * The merchant portal already polls every eight seconds and badges the nav — but
 * only while the portal is open, which is the case this covers and that one
 * cannot.
 *
 * ## The guest's PIN is never sent to the hotel
 *
 * Not for secrecy — the hotel is entitled to it, and it is on the booking they
 * can already open. But a PIN sitting in a push on a receptionist's lock screen
 * is a check-in credential in the least controlled place it could be, and the
 * hotel does not need it until a guest is standing in front of them.
 *
 * ## Delivery never fails the thing that happened
 *
 * Rooms have moved, money has moved. A notification that cannot be sent is
 * logged and nothing more.
 */
@Injectable()
export class BookingHotelNotifier {
  private readonly logger = new Logger(BookingHotelNotifier.name);

  constructor(private readonly notificationCenter: NotificationCenterService) {}

  /**
   * A guest has applied and the hotel's thirty minutes have started.
   *
   * The one notification on this class that loses money by being late.
   */
  public async bookingRequested(
    booking: Booking,
    merchantUserId: string,
    context: AuditContext = {},
  ): Promise<void> {
    const body =
      `${booking.guestName} has requested ${describeRooms(booking)} for ${describeStay(booking)}, ` +
      `${formatNaira(booking.totalAmount)}. You have 30 minutes to accept or the rooms go back on sale.`;

    await this.dispatch(booking.id, merchantUserId, NotificationType.ORDER_PLACED, {
      category: NotificationCategory.MERCHANT,
      title: 'New booking request',
      inAppBody: body,
      pushBody: `New booking request: ${describeRooms(booking)}, ${describeStay(booking)}. 30 minutes to accept.`,
      reference: booking.reference,
      context,
    });
  }

  /**
   * The guest paid. The room is committed and the money is with DrippleX.
   *
   * This is the moment a hotel can stop treating the booking as provisional,
   * which is why it is told rather than left to notice.
   */
  public async bookingPaid(
    booking: Booking,
    merchantUserId: string,
    context: AuditContext = {},
  ): Promise<void> {
    const body =
      `${booking.guestName} has paid ${formatNaira(booking.totalAmount)} for ${describeStay(booking)}. ` +
      `The booking is confirmed — the guest will show a 5-character code at check-in. ` +
      `Your share is paid out with the weekly settlement on Monday.`;

    await this.dispatch(booking.id, merchantUserId, NotificationType.PAYMENT_SUCCESS, {
      category: NotificationCategory.MERCHANT,
      title: 'Booking paid and confirmed',
      inAppBody: body,
      // Deliberately no PIN. See the class comment.
      pushBody: `${booking.guestName} paid for ${describeStay(booking)}. The booking is confirmed.`,
      reference: booking.reference,
      context,
    });
  }

  /**
   * The booking lapsed and the rooms are back on sale.
   *
   * `unpaid` separates the two causes, and unlike the guest-facing version the
   * difference here is about the hotel's own conduct: one of these is a sale it
   * missed by not answering.
   */
  public async bookingLapsed(
    booking: Booking,
    merchantUserId: string,
    unpaid: boolean,
    context: AuditContext = {},
  ): Promise<void> {
    const stay = describeStay(booking);
    const inAppBody = unpaid
      ? `${booking.guestName} did not pay within 24 hours, so ${describeRooms(booking)} for ${stay} are back on sale.`
      : `A booking request from ${booking.guestName} for ${stay} expired before it was answered. ${describeRooms(booking)} are back on sale.`;

    await this.dispatch(booking.id, merchantUserId, NotificationType.BOOKING_EXPIRED, {
      category: NotificationCategory.MERCHANT,
      title: unpaid ? 'A guest did not pay in time' : 'A booking request expired unanswered',
      inAppBody,
      pushBody: inAppBody,
      reference: booking.reference,
      // NORMAL, not HIGH: nothing is required of the hotel and the rooms are
      // already back on sale. An unanswered request is a nudge, not an alarm.
      priority: NotificationPriority.NORMAL,
      context,
    });
  }

  /**
   * The weekly payout landed.
   *
   * Without this a hotel sees its wallet balance change with no explanation —
   * the exact gap flagged when settlement shipped in #232. The breakdown lives
   * on the settlements screen; this says the money is there and what week it
   * covers.
   */
  public async settlementPaid(
    settlement: BookingSettlement,
    merchantUserId: string,
    context: AuditContext = {},
  ): Promise<void> {
    const week = `${formatDay(weekFrom(settlement.weekStarting))} – ${formatDay(weekTo(settlement.weekStarting))}`;
    const bookings =
      settlement.bookingCount === 1 ? '1 booking' : `${String(settlement.bookingCount)} bookings`;
    const body =
      `${formatNaira(settlement.netAmount)} has been paid into your DrippleX wallet for ${bookings} ` +
      `(${week}). Gross ${formatNaira(settlement.grossAmount)}, less ${formatNaira(settlement.commissionAmount)} commission.`;

    await this.dispatch(settlement.id, merchantUserId, NotificationType.PAYMENT_SUCCESS, {
      // WALLET rather than MERCHANT: this is money arriving, and it is where a
      // merchant already looks for money movement.
      category: NotificationCategory.WALLET,
      title: 'Weekly hotel settlement paid',
      inAppBody: body,
      pushBody: `${formatNaira(settlement.netAmount)} paid into your wallet for ${bookings} (${week}).`,
      reference: settlement.id,
      resource: 'booking_settlement',
      context,
    });
  }

  private async dispatch(
    resourceId: string,
    merchantUserId: string,
    type: NotificationType,
    message: {
      category: NotificationCategory;
      title: string;
      inAppBody: string;
      pushBody: string;
      reference: string;
      resource?: string;
      priority?: NotificationPriority;
      context: AuditContext;
    },
  ): Promise<void> {
    const resource = message.resource ?? 'booking';
    const payload = {
      version: PAYLOAD_VERSION,
      [resource === 'booking' ? 'bookingId' : 'settlementId']: resourceId,
      reference: message.reference,
      deepLink:
        resource === 'booking' ? `/merchant/bookings/${resourceId}` : '/merchant/settlements',
    };

    // IN_APP first and awaited on its own — it is always available and it is
    // the durable record. PUSH is best-effort: the provider reports
    // `configured: false` rather than throwing when Firebase credentials are
    // absent, so an unconfigured environment degrades to in-app only.
    for (const channel of [NotificationChannel.IN_APP, NotificationChannel.PUSH]) {
      try {
        await this.notificationCenter.send(
          {
            userId: merchantUserId,
            category: message.category,
            channel,
            type,
            title: message.title,
            body: channel === NotificationChannel.IN_APP ? message.inAppBody : message.pushBody,
            priority: message.priority ?? NotificationPriority.HIGH,
            payload,
          },
          message.context,
        );
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Could not send ${channel} notification to hotel ${merchantUserId} for ${message.reference}: ${detail}`,
        );
      }
    }
  }
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The Monday a settlement is labelled by covers the seven days before it. */
function weekFrom(weekStarting: Date): Date {
  return new Date(weekStarting.getTime() - 7 * MS_PER_DAY);
}

/** The Sunday, not the following Monday — a hotel reading "to: Monday" would
 *  reasonably assume Monday was included. */
function weekTo(weekStarting: Date): Date {
  return new Date(weekStarting.getTime() - MS_PER_DAY);
}

function describeRooms(booking: Booking): string {
  return booking.rooms === 1 ? '1 room' : `${String(booking.rooms)} rooms`;
}

function describeStay(booking: Booking): string {
  const nights = booking.nights === 1 ? '1 night' : `${String(booking.nights)} nights`;
  return `${formatDay(booking.checkIn)} – ${formatDay(booking.checkOut)}, ${nights}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * UTC, like everything else in this module.
 *
 * A night is a calendar day. Reading local parts off a Postgres DATE names the
 * day before for anyone west of UTC, and a hotel told the wrong arrival date
 * prepares the wrong room on the wrong day.
 */
function formatDay(value: Date): string {
  return `${String(value.getUTCDate())} ${MONTHS[value.getUTCMonth()] ?? ''}`;
}

function formatNaira(amount: { toString: () => string }): string {
  const value = Number(amount.toString());
  return `₦${value.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
