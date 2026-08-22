import { Injectable, Logger } from '@nestjs/common';
import {
  BookingStatus,
  NotificationCategory,
  NotificationChannel,
  NotificationPriority,
  NotificationType,
} from '@prisma/client';

import { NotificationCenterService } from '../notification-center/notification-center.service';

import type { AuditContext } from '../audit/audit.service';
import type { Booking } from '@prisma/client';

const PAYLOAD_VERSION = 1;

/**
 * Tells a guest what happened to their booking — DPX-HOTEL-002 slice E.
 *
 * Every state a booking can reach is decided by **somebody else**: the hotel
 * accepts or declines, a sweep expires it, a gateway confirms the money. None
 * of that happens while the guest is watching, and before this the app's only
 * answer was "come back and look".
 *
 * ## The PIN never goes in a push
 *
 * Same rule as the utilities notifier, for the same reason: a push body renders
 * on a locked screen, and the booking PIN is what proves a guest is the guest
 * at the hotel desk. Anyone who picks up the phone can read a lock-screen
 * notification. The push says the room is confirmed; the in-app message, behind
 * authentication, carries the code.
 *
 * ## The acceptance notification is the one that matters
 *
 * The plan's slice E lists CONFIRMED, REJECTED and EXPIRED. That list was
 * written under the wallet-hold model, where a hotel accepting *was* the end of
 * it — the money moved and the booking was done. Under the model that actually
 * shipped, acceptance is the moment the guest must **act**: they have 24 hours
 * to pay or they lose the room to somebody else.
 *
 * So `BOOKING_ACCEPTED` is included. **This is my reading of decisions 11–12
 * rather than something the founder wrote down, and it is flagged in
 * DPX-HOTEL-002 for confirmation** — but a notification feature that stays
 * silent on the single state with a deadline attached would be worse than not
 * building it, because the guest would reasonably conclude no news is fine.
 *
 * It goes out at HIGH, not CRITICAL, even though it is the most time-sensitive
 * of the four. CRITICAL is used in exactly one place in this codebase — a
 * driver's SOS alert — and a hotel payment reminder sharing that tier would
 * erode the one signal that must never be ignored. A missed booking costs a
 * room; the tier above exists for something else entirely.
 *
 * ## Expiry has two different meanings now
 *
 * A booking expires either because the hotel never answered or because the
 * guest never paid. Telling both the same thing would be wrong in opposite
 * directions: one guest did nothing wrong and the other simply ran out of time,
 * and being told "the hotel did not respond" when you forgot to pay is
 * confusing enough to generate a support ticket.
 *
 * ## Delivery never fails the booking
 *
 * The state has already changed and the money has already moved. A notification
 * that could not be sent is logged; it never rolls back a room the guest has
 * paid for.
 */
@Injectable()
export class BookingCustomerNotifier {
  private readonly logger = new Logger(BookingCustomerNotifier.name);

  constructor(private readonly notificationCenter: NotificationCenterService) {}

  /**
   * The hotel said yes — and the guest's clock has started.
   *
   * The only one of the four with a deadline behind it: not reading this one
   * costs the room.
   */
  public async bookingAccepted(
    booking: Booking,
    hotelName: string,
    context: AuditContext = {},
  ): Promise<void> {
    const amount = formatNaira(booking.totalAmount);
    const body =
      `${hotelName} accepted your booking for ${describeStay(booking)}. ` +
      `Pay ${amount} within 24 hours to confirm the room — after that it goes back on sale.`;

    await this.dispatch(booking, NotificationType.BOOKING_ACCEPTED, {
      title: `${hotelName} accepted your booking`,
      inAppBody: body,
      pushBody: `${hotelName} accepted your booking. Pay ${amount} within 24 hours to confirm it.`,
      priority: NotificationPriority.HIGH,
      context,
    });
  }

  /** Paid, assured, and there is a code to show at the desk. */
  public async bookingConfirmed(
    booking: Booking,
    hotelName: string,
    context: AuditContext = {},
  ): Promise<void> {
    const stay = describeStay(booking);
    // The PIN goes in the in-app body only. See the class comment.
    const inAppBody =
      booking.pin !== null && booking.pin !== ''
        ? `Your room at ${hotelName} for ${stay} is confirmed and paid. Show this at the desk: ${booking.pin}`
        : `Your room at ${hotelName} for ${stay} is confirmed and paid.`;

    await this.dispatch(booking, NotificationType.BOOKING_CONFIRMED, {
      title: 'Your room is confirmed',
      inAppBody,
      pushBody: `Your room at ${hotelName} for ${stay} is confirmed. Open DrippleX to see your check-in code.`,
      priority: NotificationPriority.HIGH,
      context,
    });
  }

  /** The hotel declined. Nothing was ever charged. */
  public async bookingRejected(
    booking: Booking,
    hotelName: string,
    customerMessage: string,
    context: AuditContext = {},
  ): Promise<void> {
    // The hotel's own words when it gave a reason — a guest deciding where else
    // to look is better served by "we are fully booked" than by a generic line.
    const reason =
      booking.rejectionReason !== null && booking.rejectionReason !== ''
        ? ` The hotel said: "${booking.rejectionReason}"`
        : '';
    const body = `${hotelName} could not take your booking for ${describeStay(booking)}.${reason} ${customerMessage}`;

    await this.dispatch(booking, NotificationType.BOOKING_REJECTED, {
      title: `${hotelName} could not take your booking`,
      inAppBody: body,
      pushBody: `${hotelName} could not take your booking. You were not charged.`,
      priority: NotificationPriority.HIGH,
      context,
    });
  }

  /**
   * The booking lapsed.
   *
   * `unpaid` distinguishes the two ways that happens, because they are not the
   * same event to the person receiving it: one guest was ignored by a hotel,
   * the other let their own deadline pass.
   */
  public async bookingExpired(
    booking: Booking,
    hotelName: string,
    customerMessage: string,
    unpaid: boolean,
    context: AuditContext = {},
  ): Promise<void> {
    const stay = describeStay(booking);
    const inAppBody = unpaid
      ? `Your 24 hours to pay for ${hotelName} (${stay}) ran out, so the rooms have gone back on sale. ${customerMessage}`
      : `${hotelName} did not answer your booking for ${stay} in time, so it has expired. ${customerMessage}`;

    await this.dispatch(booking, NotificationType.BOOKING_EXPIRED, {
      title: unpaid ? 'Your booking was not paid in time' : 'Your booking expired',
      inAppBody,
      pushBody: unpaid
        ? `Your booking at ${hotelName} was not paid within 24 hours and has expired. You were not charged.`
        : `${hotelName} did not answer in time. Your booking expired and you were not charged.`,
      priority: NotificationPriority.HIGH,
      context,
    });
  }

  /**
   * Route one terminal outcome to the right message.
   *
   * A single entry point so a caller that knows a booking changed does not have
   * to know which of four notifications that implies — and so a status added
   * later fails loudly here rather than silently sending nothing.
   */
  public async bookingChanged(
    booking: Booking,
    hotelName: string,
    customerMessage: string | null,
    context: AuditContext = {},
  ): Promise<void> {
    switch (booking.status) {
      case BookingStatus.AWAITING_PAYMENT:
        await this.bookingAccepted(booking, hotelName, context);
        return;
      case BookingStatus.CONFIRMED:
        await this.bookingConfirmed(booking, hotelName, context);
        return;
      case BookingStatus.REJECTED:
        await this.bookingRejected(booking, hotelName, customerMessage ?? '', context);
        return;
      case BookingStatus.EXPIRED:
        // Only an accepted booking has a payment deadline, so its presence is
        // what separates "the guest did not pay" from "the hotel never
        // answered" once the row has already moved to EXPIRED.
        await this.bookingExpired(
          booking,
          hotelName,
          customerMessage ?? '',
          booking.paymentDeadline !== null,
          context,
        );
        return;
      default:
        // PENDING_HOTEL and the check-in states are not customer notifications
        // today. Silence here is deliberate, not an oversight.
        return;
    }
  }

  private async dispatch(
    booking: Booking,
    type: NotificationType,
    message: {
      title: string;
      inAppBody: string;
      pushBody: string;
      priority: NotificationPriority;
      context: AuditContext;
    },
  ): Promise<void> {
    const payload = {
      version: PAYLOAD_VERSION,
      bookingId: booking.id,
      reference: booking.reference,
      status: booking.status,
      // What the app needs to open this booking from a notification tap.
      deepLink: `/bookings/${booking.id}`,
    };

    // IN_APP first and awaited on its own: it is always available and it is the
    // durable record. PUSH is best-effort — the provider reports
    // `configured: false` rather than throwing when Firebase credentials are
    // absent, so an unconfigured environment degrades to in-app only.
    for (const channel of [NotificationChannel.IN_APP, NotificationChannel.PUSH]) {
      try {
        await this.notificationCenter.send(
          {
            userId: booking.customerId,
            category: NotificationCategory.BOOKING,
            channel,
            type,
            title: message.title,
            body: channel === NotificationChannel.IN_APP ? message.inAppBody : message.pushBody,
            priority: message.priority,
            payload,
          },
          message.context,
        );
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Could not send ${channel} notification for booking ${booking.reference}: ${detail}`,
        );
      }
    }
  }
}

/** "Fri 11 Sep – Sun 13 Sep, 2 nights" — how a guest recognises their own stay. */
function describeStay(booking: Booking): string {
  const nights = booking.nights === 1 ? '1 night' : `${String(booking.nights)} nights`;
  return `${formatNight(booking.checkIn)} – ${formatNight(booking.checkOut)}, ${nights}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * UTC, like every other date in this module.
 *
 * A night is a calendar day. Reading local parts off a Postgres DATE would name
 * the day before for anyone west of UTC, and telling a guest their stay starts
 * on the wrong date is the kind of error that ends with somebody at a desk
 * being told there is no reservation.
 */
function formatNight(value: Date): string {
  return `${String(value.getUTCDate())} ${MONTHS[value.getUTCMonth()] ?? ''}`;
}

function formatNaira(amount: { toString: () => string }): string {
  const value = Number(amount.toString());
  return `₦${value.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
