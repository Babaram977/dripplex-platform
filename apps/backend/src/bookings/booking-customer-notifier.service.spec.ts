import {
  BookingStatus,
  NotificationCategory,
  NotificationChannel,
  NotificationType,
  Prisma,
} from '@prisma/client';

import { BookingCustomerNotifier } from './booking-customer-notifier.service';

import type { NotificationCenterService } from '../notification-center/notification-center.service';
import type { Booking } from '@prisma/client';

/**
 * DPX-HOTEL-002 slice E — what a guest is told, and on which channel.
 *
 * The notification centre is stubbed on purpose. Its own delivery is covered by
 * its own suite; what is unproven here is the *content* decision, and content
 * is where the two real risks live:
 *
 *  1. **The PIN leaking into a push body.** A push renders on a locked screen
 *     and the PIN is what proves a guest is the guest at the desk. This is the
 *     same rule the utilities notifier follows for meter tokens, and the same
 *     reason.
 *  2. **Telling a guest the wrong story about why their booking died.** Expiry
 *     now has two causes that are opposites from the guest's side.
 */
describe('BookingCustomerNotifier', () => {
  let sent: {
    channel: NotificationChannel;
    type: NotificationType;
    category: NotificationCategory;
    title: string;
    body: string;
  }[];
  let notifier: BookingCustomerNotifier;
  let center: NotificationCenterService;

  const PIN = 'B7X9K';

  function booking(overrides: Partial<Booking> = {}): Booking {
    return {
      id: 'booking-1',
      reference: 'DXB-ABC123',
      customerId: 'customer-1',
      businessId: 'business-1',
      roomTypeId: 'room-1',
      status: BookingStatus.CONFIRMED,
      checkIn: new Date('2026-09-11T00:00:00.000Z'),
      checkOut: new Date('2026-09-13T00:00:00.000Z'),
      nights: 2,
      rooms: 1,
      guests: 2,
      totalAmount: new Prisma.Decimal(40000),
      commissionAmount: null,
      guestName: 'Hamza Bello',
      guestPhone: '+2348012345678',
      guestNote: null,
      acceptDeadline: new Date('2026-09-01T12:30:00.000Z'),
      paymentDeadline: null,
      paymentReference: null,
      paidAt: null,
      pin: null,
      settlementId: null,
      acceptedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      createdAt: new Date('2026-09-01T12:00:00.000Z'),
      updatedAt: new Date('2026-09-01T12:00:00.000Z'),
      ...overrides,
    } as Booking;
  }

  const inApp = (): (typeof sent)[number] | undefined =>
    sent.find((s) => s.channel === NotificationChannel.IN_APP);
  const push = (): (typeof sent)[number] | undefined =>
    sent.find((s) => s.channel === NotificationChannel.PUSH);

  beforeEach(() => {
    sent = [];
    center = {
      send: jest.fn().mockImplementation((input: (typeof sent)[number]) => {
        sent.push(input);
        return Promise.resolve(undefined);
      }),
    } as unknown as NotificationCenterService;
    notifier = new BookingCustomerNotifier(center);
  });

  describe('the hotel accepted', () => {
    it('tells the guest what to pay and how long they have', async () => {
      await notifier.bookingAccepted(
        booking({ status: BookingStatus.AWAITING_PAYMENT }),
        'Tahir Guest Palace',
      );

      expect(inApp()?.type).toBe(NotificationType.BOOKING_ACCEPTED);
      expect(inApp()?.category).toBe(NotificationCategory.BOOKING);
      expect(inApp()?.body).toContain('₦40,000');
      expect(inApp()?.body).toContain('24 hours');
      expect(inApp()?.body).toContain('Tahir Guest Palace');
    });

    /** The deadline is the whole point of this one; a push that omits it is a
     *  notification the guest can safely ignore, which is exactly wrong. */
    it('puts the deadline in the push too', async () => {
      await notifier.bookingAccepted(
        booking({ status: BookingStatus.AWAITING_PAYMENT }),
        'Tahir Guest Palace',
      );
      expect(push()?.body).toContain('24 hours');
    });
  });

  describe('the room is confirmed', () => {
    it('carries the PIN in the in-app message', async () => {
      await notifier.bookingConfirmed(booking({ pin: PIN }), 'Tahir Guest Palace');
      expect(inApp()?.body).toContain(PIN);
      expect(inApp()?.type).toBe(NotificationType.BOOKING_CONFIRMED);
    });

    /**
     * THE test in this file.
     *
     * A push body renders on a locked screen, so a PIN in one is readable by
     * anyone holding the phone — and this PIN is what a hotel accepts as proof
     * of identity at check-in. The push tells the guest to open the app.
     */
    it('never puts the PIN in the push', async () => {
      await notifier.bookingConfirmed(booking({ pin: PIN }), 'Tahir Guest Palace');

      expect(push()).toBeDefined();
      expect(push()?.body).not.toContain(PIN);
      expect(push()?.body.toLowerCase()).toContain('open dripplex');
    });

    /** Belt and braces: no channel other than IN_APP may carry it, however
     *  many channels this grows to later. */
    it('leaks the PIN on no other channel', async () => {
      await notifier.bookingConfirmed(booking({ pin: PIN }), 'Tahir Guest Palace');

      const leaked = sent.filter(
        (s) => s.channel !== NotificationChannel.IN_APP && s.body.includes(PIN),
      );
      expect(leaked).toEqual([]);
    });

    /** A confirmed booking with no PIN is not a reason to say nothing — the
     *  guest still needs to know their room is paid for. */
    it('still confirms when there is somehow no PIN', async () => {
      await notifier.bookingConfirmed(booking({ pin: null }), 'Tahir Guest Palace');
      expect(inApp()?.body).toContain('confirmed and paid');
    });
  });

  describe('the hotel declined', () => {
    it('says plainly that nothing was charged', async () => {
      await notifier.bookingRejected(
        booking({ status: BookingStatus.REJECTED }),
        'Tahir Guest Palace',
        'You were never charged for it.',
      );
      expect(inApp()?.type).toBe(NotificationType.BOOKING_REJECTED);
      expect(inApp()?.body).toContain('never charged');
    });

    /** A guest deciding where else to look is better served by the hotel's own
     *  words than by a generic line. */
    it("passes on the hotel's reason when it gave one", async () => {
      await notifier.bookingRejected(
        booking({ status: BookingStatus.REJECTED, rejectionReason: 'We are fully booked' }),
        'Tahir Guest Palace',
        'You were never charged for it.',
      );
      expect(inApp()?.body).toContain('We are fully booked');
    });

    it('reads cleanly when it gave none', async () => {
      await notifier.bookingRejected(
        booking({ status: BookingStatus.REJECTED, rejectionReason: null }),
        'Tahir Guest Palace',
        'You were never charged for it.',
      );
      expect(inApp()?.body).not.toContain('The hotel said');
    });
  });

  /**
   * Expiry means two opposite things now, and the guest is on the receiving end
   * of the difference: one of them did nothing wrong.
   */
  describe('the booking expired', () => {
    it('tells a guest who ran out of time that it was the payment window', async () => {
      await notifier.bookingChanged(
        booking({
          status: BookingStatus.EXPIRED,
          paymentDeadline: new Date('2026-09-02T12:00:00.000Z'),
        }),
        'Tahir Guest Palace',
        'You were never charged.',
      );
      expect(inApp()?.type).toBe(NotificationType.BOOKING_EXPIRED);
      expect(inApp()?.body).toContain('24 hours to pay');
      expect(inApp()?.body).not.toContain('did not answer');
    });

    /** No payment deadline means the hotel never accepted, so the guest never
     *  had anything to pay and must not be told they missed a payment. */
    it('tells a guest the hotel ignored that it was the hotel', async () => {
      await notifier.bookingChanged(
        booking({ status: BookingStatus.EXPIRED, paymentDeadline: null }),
        'Tahir Guest Palace',
        'You were never charged.',
      );
      expect(inApp()?.body).toContain('did not answer');
      expect(inApp()?.body).not.toContain('24 hours to pay');
    });
  });

  describe('routing by status', () => {
    it.each([
      [BookingStatus.AWAITING_PAYMENT, NotificationType.BOOKING_ACCEPTED],
      [BookingStatus.CONFIRMED, NotificationType.BOOKING_CONFIRMED],
      [BookingStatus.REJECTED, NotificationType.BOOKING_REJECTED],
      [BookingStatus.EXPIRED, NotificationType.BOOKING_EXPIRED],
    ])('sends %s as %s', async (status, type) => {
      await notifier.bookingChanged(booking({ status }), 'Tahir Guest Palace', 'msg');
      expect(inApp()?.type).toBe(type);
    });

    /** A booking still waiting on the hotel is not news — the guest just made
     *  it. Silence here is a decision, so it is pinned. */
    it('says nothing while the booking is still pending', async () => {
      await notifier.bookingChanged(
        booking({ status: BookingStatus.PENDING_HOTEL }),
        'Tahir Guest Palace',
        null,
      );
      expect(sent).toEqual([]);
    });

    it('says nothing on check-in and check-out', async () => {
      await notifier.bookingChanged(
        booking({ status: BookingStatus.CHECKED_IN }),
        'Tahir Guest Palace',
        null,
      );
      await notifier.bookingChanged(
        booking({ status: BookingStatus.CHECKED_OUT }),
        'Tahir Guest Palace',
        null,
      );
      expect(sent).toEqual([]);
    });
  });

  describe('when delivery fails', () => {
    /**
     * The booking has already changed and the money has already moved. A
     * notification that cannot be sent must never propagate — throwing here
     * would roll back a room the guest has paid for.
     */
    it('never throws at the caller', async () => {
      center.send = jest.fn().mockRejectedValue(new Error('push provider down'));
      notifier = new BookingCustomerNotifier(center);

      await expect(
        notifier.bookingConfirmed(booking({ pin: PIN }), 'Tahir Guest Palace'),
      ).resolves.toBeUndefined();
    });

    /** One dead channel must not take the other with it — the in-app record is
     *  the durable one and has to survive a push failure. */
    it('still delivers in-app when push is the thing that is broken', async () => {
      center.send = jest.fn().mockImplementation((input: (typeof sent)[number]) => {
        if (input.channel === NotificationChannel.PUSH) {
          return Promise.reject(new Error('firebase down'));
        }
        sent.push(input);
        return Promise.resolve(undefined);
      });
      notifier = new BookingCustomerNotifier(center);

      await notifier.bookingConfirmed(booking({ pin: PIN }), 'Tahir Guest Palace');
      expect(inApp()?.body).toContain(PIN);
    });
  });

  describe('the stay it describes', () => {
    /**
     * UTC, like every other date in the booking module. Lagos is UTC+1, so
     * reading local parts off a Postgres DATE names the day before — and a
     * guest told their stay starts on the wrong date turns up at a desk to be
     * told there is no reservation.
     */
    it('names the nights in UTC, not the local rendering of them', async () => {
      await notifier.bookingConfirmed(
        booking({
          pin: PIN,
          checkIn: new Date('2026-09-11T00:00:00.000Z'),
          checkOut: new Date('2026-09-13T00:00:00.000Z'),
        }),
        'Tahir Guest Palace',
      );
      expect(inApp()?.body).toContain('11 Sep');
      expect(inApp()?.body).toContain('13 Sep');
      expect(inApp()?.body).toContain('2 nights');
    });

    it('says "1 night" rather than "1 nights"', async () => {
      await notifier.bookingConfirmed(booking({ pin: PIN, nights: 1 }), 'Tahir Guest Palace');
      expect(inApp()?.body).toContain(', 1 night');
      expect(inApp()?.body).not.toContain('1 nights');
    });
  });
});
