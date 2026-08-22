import {
  BookingSettlementStatus,
  BookingStatus,
  NotificationCategory,
  NotificationChannel,
  NotificationPriority,
  NotificationType,
  Prisma,
} from '@prisma/client';

import { BookingHotelNotifier } from './booking-hotel-notifier.service';

import type { NotificationCenterService } from '../notification-center/notification-center.service';
import type { Booking, BookingSettlement } from '@prisma/client';

/**
 * What a hotel is told — DPX-HOTEL-002, merchant side.
 *
 * Two things are being pinned here, and neither is "does the notification
 * centre work" (that has its own suite):
 *
 *  1. **Every type and category used already exists in the schema.** The whole
 *     point of this work was to add hotel notifications without an enum
 *     migration, and a test that asserts the literal enum members is what stops
 *     someone "tidying" one into a new value later without noticing the cost.
 *  2. **The hotel is told the right story.** An unanswered request and an
 *     unpaid booking are different failures, and one of them is the hotel's
 *     own.
 */
describe('BookingHotelNotifier', () => {
  const MERCHANT_USER = 'merchant-user-1';

  let sent: {
    userId: string;
    channel: NotificationChannel;
    type: NotificationType;
    category: NotificationCategory;
    priority: NotificationPriority;
    title: string;
    body: string;
  }[];
  let notifier: BookingHotelNotifier;
  let center: NotificationCenterService;

  function booking(overrides: Partial<Booking> = {}): Booking {
    return {
      id: 'booking-1',
      reference: 'DXB-ABC123',
      customerId: 'customer-1',
      businessId: 'business-1',
      roomTypeId: 'room-1',
      status: BookingStatus.PENDING_HOTEL,
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

  function settlement(overrides: Partial<BookingSettlement> = {}): BookingSettlement {
    return {
      id: 'settlement-1',
      businessId: 'business-1',
      weekStarting: new Date('2027-08-23T00:00:00.000Z'),
      status: BookingSettlementStatus.COMPLETED,
      bookingCount: 2,
      grossAmount: new Prisma.Decimal(60000),
      commissionAmount: new Prisma.Decimal(6000),
      netAmount: new Prisma.Decimal(54000),
      currency: 'NGN',
      walletLedgerEntryId: null,
      failureReason: null,
      settledAt: new Date('2027-08-23T06:00:00.000Z'),
      createdAt: new Date('2027-08-23T06:00:00.000Z'),
      updatedAt: new Date('2027-08-23T06:00:00.000Z'),
      ...overrides,
    };
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
    notifier = new BookingHotelNotifier(center);
  });

  /**
   * The constraint the whole change was built under: no new enum values, so no
   * migration on a live database. Asserted as literals rather than by
   * comparing against `NotificationType` itself, which would pass for anything.
   */
  describe('uses only types and categories that already existed', () => {
    it('sends a new request as ORDER_PLACED, the same type a merchant order uses', async () => {
      await notifier.bookingRequested(booking(), MERCHANT_USER);
      expect(inApp()?.type).toBe(NotificationType.ORDER_PLACED);
    });

    it('sends money events as PAYMENT_SUCCESS', async () => {
      await notifier.bookingPaid(booking({ status: BookingStatus.CONFIRMED }), MERCHANT_USER);
      expect(inApp()?.type).toBe(NotificationType.PAYMENT_SUCCESS);

      sent = [];
      await notifier.settlementPaid(settlement(), MERCHANT_USER);
      expect(inApp()?.type).toBe(NotificationType.PAYMENT_SUCCESS);
    });

    /**
     * Category follows the audience, not the subject: a guest's booking
     * notification is BOOKING, the hotel's notification about the same booking
     * is MERCHANT — mirroring MARKETPLACE/MERCHANT for orders.
     */
    it('files booking events under MERCHANT, not BOOKING', async () => {
      await notifier.bookingRequested(booking(), MERCHANT_USER);
      expect(inApp()?.category).toBe(NotificationCategory.MERCHANT);
      expect(inApp()?.category).not.toBe(NotificationCategory.BOOKING);
    });

    /** A payout is money movement, which is where a merchant looks for it. */
    it('files the settlement under WALLET', async () => {
      await notifier.settlementPaid(settlement(), MERCHANT_USER);
      expect(inApp()?.category).toBe(NotificationCategory.WALLET);
    });
  });

  describe('a new booking request', () => {
    it('says who, what, how much and how long they have', async () => {
      await notifier.bookingRequested(booking(), MERCHANT_USER);

      expect(inApp()?.userId).toBe(MERCHANT_USER);
      expect(inApp()?.body).toContain('Hamza Bello');
      expect(inApp()?.body).toContain('₦40,000');
      expect(inApp()?.body).toContain('30 minutes');
      expect(inApp()?.body).toContain('11 Sep');
    });

    /**
     * The reason this class exists. Founder decision 9 set thirty minutes
     * *because* a small hotel is not watching the app, so an in-app-only
     * notification would be one nobody reads in time.
     */
    it('goes out as a push as well as in-app', async () => {
      await notifier.bookingRequested(booking(), MERCHANT_USER);

      expect(push()).toBeDefined();
      expect(push()?.body).toContain('30 minutes');
      expect(push()?.userId).toBe(MERCHANT_USER);
    });
  });

  describe('the guest paid', () => {
    it('tells the hotel the booking is committed and when they get paid', async () => {
      await notifier.bookingPaid(
        booking({ status: BookingStatus.CONFIRMED, pin: 'B7X9K' }),
        MERCHANT_USER,
      );
      expect(inApp()?.body).toContain('₦40,000');
      expect(inApp()?.body).toContain('confirmed');
      expect(inApp()?.body).toContain('Monday');
    });

    /**
     * The hotel is entitled to the PIN — it is on the booking they can already
     * open. It just must not sit on a receptionist's lock screen, which is the
     * least controlled place a check-in credential could be.
     */
    it('keeps the guest PIN out of the push', async () => {
      await notifier.bookingPaid(
        booking({ status: BookingStatus.CONFIRMED, pin: 'B7X9K' }),
        MERCHANT_USER,
      );
      const leaked = sent.filter((s) => s.body.includes('B7X9K'));
      expect(leaked).toEqual([]);
    });
  });

  describe('the booking lapsed', () => {
    it('tells a hotel that ignored a request that it went unanswered', async () => {
      await notifier.bookingLapsed(
        booking({ status: BookingStatus.EXPIRED }),
        MERCHANT_USER,
        false,
      );
      expect(inApp()?.body).toContain('expired before it was answered');
      expect(inApp()?.body).not.toContain('did not pay');
    });

    it('tells a hotel whose guest never paid that it was the guest', async () => {
      await notifier.bookingLapsed(booking({ status: BookingStatus.EXPIRED }), MERCHANT_USER, true);
      expect(inApp()?.body).toContain('did not pay within 24 hours');
      expect(inApp()?.body).not.toContain('unanswered');
    });

    /** Nothing is required of the hotel and the rooms are already back on
     *  sale — a nudge, not an alarm. */
    it('is lower priority than a live request', async () => {
      await notifier.bookingLapsed(booking(), MERCHANT_USER, true);
      const lapsed = inApp()?.priority;

      sent = [];
      await notifier.bookingRequested(booking(), MERCHANT_USER);
      expect(lapsed).toBe(NotificationPriority.NORMAL);
      expect(inApp()?.priority).toBe(NotificationPriority.HIGH);
    });
  });

  describe('the weekly settlement', () => {
    /** The gap this closes: before it, a hotel saw its balance change with no
     *  explanation at all. */
    it('breaks down what the money is for', async () => {
      await notifier.settlementPaid(settlement(), MERCHANT_USER);

      expect(inApp()?.body).toContain('₦54,000');
      expect(inApp()?.body).toContain('2 bookings');
      expect(inApp()?.body).toContain('₦60,000');
      expect(inApp()?.body).toContain('₦6,000');
    });

    /**
     * The week a Monday run settles is the seven days BEFORE it, and the label
     * must end on the Sunday — a hotel reading "to: Monday" would reasonably
     * assume Monday was included and find its own figures short.
     */
    it('names the week it covers, ending on the Sunday', async () => {
      await notifier.settlementPaid(settlement(), MERCHANT_USER);
      // weekStarting 2027-08-23 (Mon) settles 16 Aug – 22 Aug.
      expect(inApp()?.body).toContain('16 Aug');
      expect(inApp()?.body).toContain('22 Aug');
      expect(inApp()?.body).not.toContain('23 Aug');
    });

    it('says "1 booking" rather than "1 bookings"', async () => {
      await notifier.settlementPaid(settlement({ bookingCount: 1 }), MERCHANT_USER);
      expect(inApp()?.body).toContain('1 booking ');
      expect(inApp()?.body).not.toContain('1 bookings');
    });
  });

  describe('when delivery fails', () => {
    /** Rooms and money have already moved. Throwing here would undo a payout
     *  because a message could not be sent. */
    it('never throws at the caller', async () => {
      center.send = jest.fn().mockRejectedValue(new Error('provider down'));
      notifier = new BookingHotelNotifier(center);

      await expect(notifier.settlementPaid(settlement(), MERCHANT_USER)).resolves.toBeUndefined();
      await expect(notifier.bookingRequested(booking(), MERCHANT_USER)).resolves.toBeUndefined();
    });

    it('still delivers in-app when push is what is broken', async () => {
      center.send = jest.fn().mockImplementation((input: (typeof sent)[number]) => {
        if (input.channel === NotificationChannel.PUSH) {
          return Promise.reject(new Error('firebase down'));
        }
        sent.push(input);
        return Promise.resolve(undefined);
      });
      notifier = new BookingHotelNotifier(center);

      await notifier.bookingRequested(booking(), MERCHANT_USER);
      expect(inApp()?.body).toContain('30 minutes');
    });
  });
});
