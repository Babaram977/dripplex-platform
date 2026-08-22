import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import { BookingStatus, PaymentProvider, Prisma } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { AppConfigService } from '../config/app-config.service';
import { MerchantCommissionSettingsService } from '../orders/merchant-commission-settings.service';
import {
  PAYMENT_PROVIDER_ADAPTERS,
  type PaymentProviderAdapter,
} from '../payments/providers/payment-provider.adapter';
import { PrismaService } from '../prisma/prisma.service';

import { BookingCustomerNotifier } from './booking-customer-notifier.service';
import { BookingHotelNotifier } from './booking-hotel-notifier.service';
import { generateBookingPin, isBookingPinShaped, normalizeBookingPin } from './booking-pin';
import { nightCount, nightsBetween, toNight, validateStay } from './booking.dates';
import {
  BOOKING_ACCEPT_WINDOW_MS,
  BOOKING_AUDIT_ACTIONS,
  BOOKING_EXPIRED_CUSTOMER_MESSAGE,
  BOOKING_MAX_ROOMS,
  BOOKING_PAYMENT_WINDOW_MS,
  BOOKING_REJECTED_CUSTOMER_MESSAGE,
} from './bookings.constants';

import type { Booking, RoomAvailability } from '@prisma/client';

export interface AvailabilityQuery {
  roomTypeId: string;
  checkIn: Date;
  checkOut: Date;
  rooms?: number;
}

export interface AvailabilityResult {
  available: boolean;
  /** Why not, in words a guest can act on. Null when it is available. */
  reason: string | null;
  nights: number;
  /** What the whole stay costs, at the prices in force right now. */
  totalAmount: number;
  /** Per-night breakdown, so a receipt can explain a weekend rate. */
  perNight: { night: string; price: number }[];
}

export interface CreateBookingInput {
  roomTypeId: string;
  checkIn: Date;
  checkOut: Date;
  rooms?: number;
  guests?: number;
  guestName: string;
  guestPhone: string;
  guestNote?: string;
}

/**
 * Hotel bookings — DPX-HOTEL-001.
 *
 * The money model, as set by the founder on 2026-08-22:
 *
 *   apply (no money at all)  →  hotel accepts  →  24 hours to pay through the
 *   DrippleX gateway  →  paid, assured, and a five-character PIN for the desk
 *
 * Anyone may apply with an empty wallet. This SUPERSEDES the wallet hold of
 * decision 8 — nothing is held or taken until the guest pays, and payment runs
 * on the same gateway that already takes card and transfer money elsewhere in
 * the app, so no one has to judge a receipt and a forged one cannot assure a
 * room.
 *
 * What that gives up is what the hold used to buy: abandoning an application
 * now costs the guest nothing. Two deadlines replace it — the hotel's window
 * to answer, and the guest's 24 hours to pay — and the sweep enforces both,
 * because rooms held against nothing are rooms the hotel cannot sell.
 *
 * Two invariants are load-bearing, and they are protected in different places
 * on purpose:
 *
 * 1. **A room is never sold twice.** Guarded twice over, in the database both
 *    times, because application code races: two guests booking the last room
 *    at the same instant both read "1 available" and both write "1 booked".
 *
 *    The working guard is a conditional `UPDATE … WHERE rooms_booked + N <=
 *    rooms_open`, which Postgres evaluates under the row lock the UPDATE
 *    takes; the loser of a race updates zero rows and is told. Behind it, the
 *    `room_availability_not_overbooked` CHECK constraint refuses the write
 *    outright — the backstop for any path that ever forgets the guard.
 *
 *    Neither is decorative. Dropping the CHECK and running the race test with
 *    a Prisma `updateMany` in place of the raw statement produced two
 *    confirmed bookings for one room: a guest arriving at a desk at night to
 *    find it gone.
 *
 * 2. **A guest's money and the nights they hold move together.** Both happen
 *    inside one `$transaction`, so a wallet hold can never survive a failed
 *    night increment, nor the reverse.
 */
@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly commissionSettings: MerchantCommissionSettingsService,
    private readonly auditService: AuditService,
    private readonly config: AppConfigService,
    @Inject(PAYMENT_PROVIDER_ADAPTERS)
    private readonly paymentProviders: PaymentProviderAdapter[],
    private readonly customerNotifier: BookingCustomerNotifier,
    private readonly hotelNotifier: BookingHotelNotifier,
  ) {}

  // ── Availability ──────────────────────────────────────────────────────────

  /**
   * Can this stay be booked, and what does it cost?
   *
   * "Available" means **every** night from check-in to check-out-1 has a free
   * room. A gap of one night in the middle makes the whole stay unbookable —
   * a guest cannot be told to leave on the Wednesday and come back Thursday.
   */
  public async checkAvailability(query: AvailabilityQuery): Promise<AvailabilityResult> {
    const rooms = query.rooms ?? 1;
    const nights = nightsBetween(query.checkIn, query.checkOut);
    const empty: AvailabilityResult = {
      available: false,
      reason: null,
      nights: nights.length,
      totalAmount: 0,
      perNight: [],
    };

    const problem = validateStay(query.checkIn, query.checkOut, new Date());
    if (problem) {
      return { ...empty, reason: problem.message };
    }

    const roomType = await this.prisma.roomType.findFirst({
      where: { id: query.roomTypeId, deletedAt: null },
    });
    if (!roomType) {
      throw new NotFoundDomainException('Room type not found');
    }
    if (!roomType.isActive) {
      return { ...empty, reason: 'This room is not currently available to book.' };
    }

    const calendar = await this.prisma.roomAvailability.findMany({
      where: { roomTypeId: roomType.id, night: { in: nights } },
    });
    const byNight = new Map(calendar.map((row) => [row.night.getTime(), row]));

    const perNight: { night: string; price: number }[] = [];
    let total = 0;

    for (const night of nights) {
      const row = byNight.get(night.getTime());
      const iso = night.toISOString().slice(0, 10);

      // A night the hotel has never opened is not for sale. Deliberately not
      // treated as "totalRooms available": a hotel that has not touched its
      // calendar has not agreed to sell anything, and inventing availability
      // on its behalf is how a guest arrives to find nobody expecting them.
      if (!row) {
        return { ...empty, reason: `The hotel has not opened ${iso} for booking.` };
      }
      if (row.roomsOpen - row.roomsBooked < rooms) {
        return {
          ...empty,
          reason:
            rooms === 1
              ? `No rooms left on ${iso}.`
              : `Fewer than ${String(rooms)} rooms left on ${iso}.`,
        };
      }

      const price = Number(row.priceOverride ?? roomType.basePrice);
      perNight.push({ night: iso, price });
      total += price * rooms;
    }

    return {
      available: true,
      reason: null,
      nights: nights.length,
      totalAmount: roundMoney(total),
      perNight,
    };
  }

  // ── Booking ───────────────────────────────────────────────────────────────

  /**
   * Hold the rooms and hold the guest's money, in one transaction.
   *
   * Nothing is charged. Per founder decision 8 the money is only reserved —
   * the guest's available balance falls so the same money cannot be promised
   * to two hotels, and the hotel then has thirty minutes to accept.
   */
  public async createBooking(
    customerId: string,
    input: CreateBookingInput,
    context: AuditContext = {},
  ): Promise<Booking> {
    const rooms = input.rooms ?? 1;
    const guests = input.guests ?? 1;

    if (rooms < 1 || rooms > BOOKING_MAX_ROOMS) {
      throw new ValidationDomainException(
        `A booking covers between 1 and ${String(BOOKING_MAX_ROOMS)} rooms. Please contact the hotel for a larger group.`,
      );
    }
    if (guests < 1) {
      throw new ValidationDomainException('A booking needs at least one guest.');
    }
    if (input.guestName.trim() === '') {
      throw new ValidationDomainException("Enter the guest's name.");
    }
    if (input.guestPhone.trim() === '') {
      throw new ValidationDomainException('Enter a phone number the hotel can reach the guest on.');
    }

    const problem = validateStay(input.checkIn, input.checkOut, new Date());
    if (problem) {
      throw new ValidationDomainException(problem.message);
    }

    // Priced from the calendar, never from anything the client sent. The
    // availability call is the same one the guest saw, re-run server-side, so
    // a stale price on a phone cannot become the price charged.
    const quote = await this.checkAvailability({
      roomTypeId: input.roomTypeId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      rooms,
    });
    if (!quote.available) {
      throw new ConflictDomainException(quote.reason ?? 'Those dates are no longer available.');
    }

    const roomType = await this.prisma.roomType.findFirstOrThrow({
      where: { id: input.roomTypeId, deletedAt: null },
    });
    const nights = nightsBetween(input.checkIn, input.checkOut);
    const bookingId = randomUUID();
    const reference = bookingReference(bookingId);
    const now = new Date();

    // One transaction: the nights and the money move together or not at all.
    const booking = await this.prisma
      .$transaction(async (tx) => {
        for (const night of nights) {
          // Raw SQL, and it has to be.
          //
          // The guard is `rooms_booked + N <= rooms_open` — a comparison
          // between two COLUMNS, which Prisma's `where` cannot express: it
          // compares a column to a value only. An `updateMany` guarded on
          // `roomsOpen: { gte: rooms }` looks like it does this job and does
          // not, because it never consults `rooms_booked` at all. Verified by
          // dropping the CHECK constraint and re-running the race test: two
          // guests both got the last room.
          //
          // Written as one statement so Postgres evaluates the condition and
          // performs the write atomically, under the row lock the UPDATE
          // takes. Two guests racing for the last room serialise here, and the
          // second reads the first's committed value: zero rows updated.
          const held = await tx.$executeRaw`
            UPDATE room_availability
               SET rooms_booked = rooms_booked + ${rooms}, updated_at = NOW()
             WHERE room_type_id = ${roomType.id}::uuid
               AND night = ${night}::date
               AND rooms_booked + ${rooms} <= rooms_open
          `;
          if (held === 0) {
            throw new ConflictDomainException(
              `${night.toISOString().slice(0, 10)} was taken while you were booking. Please try again.`,
            );
          }
        }

        return await tx.booking.create({
          data: {
            id: bookingId,
            reference,
            customerId,
            businessId: roomType.businessId,
            roomTypeId: roomType.id,
            status: BookingStatus.PENDING_HOTEL,
            checkIn: toNight(input.checkIn),
            checkOut: toNight(input.checkOut),
            nights: nightCount(input.checkIn, input.checkOut),
            rooms,
            guests,
            totalAmount: new Prisma.Decimal(quote.totalAmount),
            guestName: input.guestName.trim(),
            guestPhone: input.guestPhone.trim(),
            ...(input.guestNote !== undefined ? { guestNote: input.guestNote } : {}),
            acceptDeadline: new Date(now.getTime() + BOOKING_ACCEPT_WINDOW_MS),
          },
        });
      })
      .catch((error: unknown) => {
        // The CHECK constraint firing means the conditional update above was
        // raced between its WHERE and its write. Same outcome for the guest,
        // different sentence for the logs.
        if (isOverbookingViolation(error)) {
          this.logger.warn(
            `Booking for room type ${input.roomTypeId} lost the overbooking race — the CHECK constraint refused it.`,
          );
          throw new ConflictDomainException(
            'Those nights were taken while you were booking. Please try again.',
          );
        }
        throw error;
      });

    // No money moves here, and none is even reserved. Founder decision
    // 2026-08-22: anyone may apply for a reservation without funds. The guest
    // pays only once the hotel has accepted, through the DrippleX gateway,
    // within BOOKING_PAYMENT_WINDOW_MS.
    //
    // What that costs us is the thing the wallet hold used to buy: abandoning
    // an application is now free, so the rooms held here are protected by
    // deadlines alone — BOOKING_ACCEPT_WINDOW_MS before the hotel answers and
    // BOOKING_PAYMENT_WINDOW_MS after. Both are enforced by the sweep.

    await this.auditService.record(BOOKING_AUDIT_ACTIONS.CREATED, context, {
      resource: 'booking',
      resourceId: booking.id,
      userId: customerId,
      metadata: {
        reference,
        businessId: booking.businessId,
        roomTypeId: roomType.id,
        nights: booking.nights,
        rooms,
        totalAmount: quote.totalAmount,
        acceptDeadline: booking.acceptDeadline.toISOString(),
      },
    });

    // The hotel's thirty minutes start now, and founder decision 9 chose that
    // window precisely because a small hotel is NOT watching the app. An
    // in-app badge alone cannot deliver it.
    await this.notifyHotel(booking, (merchantUserId) =>
      this.hotelNotifier.bookingRequested(booking, merchantUserId, context),
    );

    return booking;
  }

  /**
   * The hotel says yes. Now — and only now — the guest is actually charged.
   *
   * The commission is snapshotted at the rate in force at this moment, so a
   * later rate change cannot move what this booking owed. It is recorded, not
   * accrued onto the hotel's CommissionAccount: DrippleX is holding this money,
   * so the hotel owes nothing — the cut simply comes off what it is paid at
   * settlement. Accruing here would charge the hotel for money DrippleX already
   * has.
   */
  public async acceptBooking(
    merchantUserId: string,
    bookingId: string,
    context: AuditContext = {},
  ): Promise<Booking> {
    const booking = await this.requireOwnPending(merchantUserId, bookingId);

    if (booking.acceptDeadline.getTime() <= Date.now()) {
      throw new ConflictDomainException(
        'The window on this booking has closed and the rooms have gone back on sale.',
      );
    }

    // Accepting no longer takes money — there is none to take. It opens the
    // guest's 24 hours to pay (founder decision 2026-08-22) and keeps the rooms
    // held meanwhile. The commission is NOT computed here: it is computed and
    // recorded when the money actually arrives, so a booking that is accepted
    // and then never paid leaves no phantom revenue behind it.
    const claimed = await this.prisma.booking.updateMany({
      where: { id: booking.id, status: BookingStatus.PENDING_HOTEL },
      data: {
        status: BookingStatus.AWAITING_PAYMENT,
        acceptedAt: new Date(),
        paymentDeadline: new Date(Date.now() + BOOKING_PAYMENT_WINDOW_MS),
      },
    });
    if (claimed.count === 0) {
      throw new ConflictDomainException('This booking has already been answered — reload it.');
    }

    await this.auditService.record(BOOKING_AUDIT_ACTIONS.ACCEPTED, context, {
      resource: 'booking',
      resourceId: booking.id,
      metadata: {
        reference: booking.reference,
        totalAmount: Number(booking.totalAmount),
        paymentWindowHours: BOOKING_PAYMENT_WINDOW_MS / 3_600_000,
      },
    });

    const accepted = await this.prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    await this.notifyCustomer(accepted, context);
    return accepted;
  }

  /** The hotel says no. The guest was never charged, and the nights go back. */
  public async rejectBooking(
    merchantUserId: string,
    bookingId: string,
    reason: string | undefined,
    context: AuditContext = {},
  ): Promise<Booking> {
    const booking = await this.requireOwnPending(merchantUserId, bookingId);
    return await this.unwind(
      booking,
      BookingStatus.REJECTED,
      BOOKING_AUDIT_ACTIONS.REJECTED,
      reason,
      context,
    );
  }

  /**
   * The thirty minutes ran out.
   *
   * Runs as a sweep rather than a per-booking timer because a timer dies with
   * the process, and a guest whose hotel never answered would be left holding
   * a booking and missing their money until someone noticed.
   */
  public async expireOverdueBookings(now: Date = new Date()): Promise<number> {
    // Two deadlines, one sweep. A booking dies either because the hotel never
    // answered it, or because it was accepted and the guest never paid within
    // their 24 hours. Both leave rooms held against nothing, and both release
    // them the same way.
    const overdue = await this.prisma.booking.findMany({
      where: {
        OR: [
          { status: BookingStatus.PENDING_HOTEL, acceptDeadline: { lte: now } },
          { status: BookingStatus.AWAITING_PAYMENT, paymentDeadline: { lte: now } },
        ],
      },
      take: 100,
    });

    let unanswered = 0;
    let unpaid = 0;
    for (const booking of overdue) {
      const wasAwaitingPayment = booking.status === BookingStatus.AWAITING_PAYMENT;
      try {
        await this.unwind(
          booking,
          BookingStatus.EXPIRED,
          BOOKING_AUDIT_ACTIONS.EXPIRED,
          undefined,
          {},
        );
        if (wasAwaitingPayment) unpaid += 1;
        else unanswered += 1;
      } catch (error) {
        // One booking that cannot be unwound must not stop the rest — every
        // other row here is a room sitting unsellable.
        this.logger.error(
          `Could not expire booking ${booking.reference}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (unanswered > 0) {
      this.logger.warn(
        `Expired ${String(unanswered)} booking(s) the hotel did not answer in time. Rooms back on sale; nothing was ever charged.`,
      );
    }
    if (unpaid > 0) {
      this.logger.warn(
        `Expired ${String(unpaid)} accepted booking(s) the guest did not pay for within 24 hours. Rooms back on sale.`,
      );
    }
    return unanswered + unpaid;
  }

  // ── Payment, through DrippleX ─────────────────────────────────────────────

  /**
   * Start the guest's payment for an accepted booking.
   *
   * Founder decision 2026-08-22: the money passes through DrippleX rather than
   * to the hotel, using the same gateway that already takes card and transfer
   * payments for orders and wallet top-ups. That choice removes the trust
   * problem a receipt-and-confirm flow would have had — the gateway tells us
   * whether the money arrived, so nobody has to judge a screenshot, and a
   * forged receipt cannot assure a room.
   *
   * Returns the checkout URL. Calling it twice reuses the existing reference
   * rather than opening a second charge against the same booking.
   */
  public async initiateBookingPayment(
    customerId: string,
    bookingId: string,
    callbackUrl?: string,
  ): Promise<{ booking: Booking; authorizationUrl: string | undefined; reference: string }> {
    const booking = await this.getCustomerBooking(customerId, bookingId);

    if (booking.status !== BookingStatus.AWAITING_PAYMENT) {
      throw new ConflictDomainException(
        booking.status === BookingStatus.PENDING_HOTEL
          ? 'The hotel has not accepted this booking yet.'
          : 'This booking is not waiting for payment.',
      );
    }
    if (booking.paymentDeadline !== null && booking.paymentDeadline.getTime() <= Date.now()) {
      throw new ConflictDomainException(
        'The 24 hours to pay for this booking have passed and the rooms have gone back on sale.',
      );
    }

    const customer = await this.prisma.user.findUnique({ where: { id: customerId } });
    if (!customer?.email) {
      throw new ValidationDomainException('An email address is required to pay for a booking');
    }

    const provider = this.config.defaultCardProvider as PaymentProvider;
    const adapter = this.paymentProviders.find((a) => a.provider === provider);
    if (!adapter) {
      throw new ConflictDomainException('Card payments are not available right now');
    }

    // Reused, not regenerated: a guest who closes the checkout and comes back
    // must land on the same charge, or one booking could collect two payments.
    const reference = booking.paymentReference ?? bookingPaymentReference(booking.id);

    const init = await adapter.initializePayment({
      email: customer.email,
      amount: Number(booking.totalAmount),
      currency: 'NGN',
      reference,
      orderId: reference,
      orderNumber: booking.reference,
      ...(callbackUrl !== undefined ? { callbackUrl } : {}),
    });

    if (booking.paymentReference === null) {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { paymentReference: init.reference },
      });
    }

    return {
      booking: await this.prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }),
      authorizationUrl: init.authorizationUrl,
      reference: init.reference,
    };
  }

  /**
   * The money arrived. Assure the booking and issue the guest's PIN.
   *
   * The gateway is asked directly rather than trusted from the client — a
   * browser returning from a checkout page proves nothing about whether the
   * charge succeeded.
   *
   * **The PIN is issued here and nowhere else.** That is what makes it worth
   * something: a hotel holding a PIN knows the money is in, without having to
   * ask anyone. It is generated once and never regenerated, so a guest who
   * reads it off an old screen is still right.
   */
  public async confirmBookingPayment(
    customerId: string,
    bookingId: string,
    context: AuditContext = {},
  ): Promise<Booking> {
    const booking = await this.getCustomerBooking(customerId, bookingId);

    // Idempotent: a guest refreshing the return page, or a webhook arriving
    // after they already came back, must not charge or re-issue anything.
    if (booking.status === BookingStatus.CONFIRMED) {
      return booking;
    }
    if (booking.status !== BookingStatus.AWAITING_PAYMENT) {
      throw new ConflictDomainException('This booking is not waiting for payment.');
    }
    if (booking.paymentReference === null) {
      throw new ConflictDomainException('No payment has been started for this booking.');
    }

    const provider = this.config.defaultCardProvider as PaymentProvider;
    const adapter = this.paymentProviders.find((a) => a.provider === provider);
    if (!adapter) {
      throw new ConflictDomainException('Card payments are not available right now');
    }

    const verification = await adapter.verifyPayment({ reference: booking.paymentReference });
    if (!verification.success) {
      throw new ValidationDomainException('That payment has not completed');
    }

    // The rate in force at the moment the money arrives, snapshotted onto the
    // booking so a later rate change cannot move what this stay owed.
    const rate = Number((await this.commissionSettings.getEffective()).commissionRate);
    const commissionAmount = roundMoney(Number(booking.totalAmount) * rate);

    const claimed = await this.prisma.booking.updateMany({
      where: { id: booking.id, status: BookingStatus.AWAITING_PAYMENT },
      data: {
        status: BookingStatus.CONFIRMED,
        paidAt: new Date(),
        pin: generateBookingPin(),
        commissionAmount: new Prisma.Decimal(commissionAmount),
      },
    });
    if (claimed.count === 0) {
      // Something else confirmed it between the read and the write. Return
      // what is there rather than erroring at a guest who did nothing wrong.
      return await this.prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    }

    await this.auditService.record(BOOKING_AUDIT_ACTIONS.PAID, context, {
      resource: 'booking',
      resourceId: booking.id,
      userId: customerId,
      metadata: {
        reference: booking.reference,
        paymentReference: booking.paymentReference,
        totalAmount: Number(booking.totalAmount),
        commissionRate: rate,
        commissionAmount,
      },
    });

    this.logger.log(
      `Booking ${booking.reference} paid. DrippleX holds ${String(Number(booking.totalAmount))} and owes the hotel ${String(roundMoney(Number(booking.totalAmount) - commissionAmount))} at the next weekly settlement.`,
    );

    const confirmed = await this.prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    // Read back after the write so the PIN is on the row being announced — the
    // notification's whole value is carrying that code to the guest.
    await this.notifyCustomer(confirmed, context);
    await this.notifyHotel(confirmed, (merchantUserId) =>
      this.hotelNotifier.bookingPaid(confirmed, merchantUserId, context),
    );
    return confirmed;
  }

  public customerMessageFor(status: BookingStatus): string | null {
    if (status === BookingStatus.REJECTED) return BOOKING_REJECTED_CUSTOMER_MESSAGE;
    if (status === BookingStatus.EXPIRED) return BOOKING_EXPIRED_CUSTOMER_MESSAGE;
    return null;
  }

  // ── Shared ────────────────────────────────────────────────────────────────

  /**
   * Give back the money and give back the nights.
   *
   * The order matters. The hold is released first: if that succeeds and the
   * night release then fails, the guest has their money and the hotel looks
   * one room fuller than it is — recoverable, and visible in the calendar. The
   * other order leaves a guest short of money with the rooms already resold,
   * which is not.
   */
  private async unwind(
    booking: Booking,
    to: BookingStatus,
    auditAction: string,
    reason: string | undefined,
    context: AuditContext,
  ): Promise<Booking> {
    // Nothing to give back. Under the 2026-08-22 model no money is taken or
    // held until the guest pays through the gateway, so unwinding a booking
    // that was never paid is purely a matter of putting the rooms back.
    //
    // The status guard covers BOTH live states: a booking the hotel never
    // answered (PENDING_HOTEL) and one it accepted that the guest never paid
    // for (AWAITING_PAYMENT). A CONFIRMED booking has money behind it and must
    // never reach here — refunding is a different path with a different
    // decision behind it.
    const claimed = await this.prisma.booking.updateMany({
      where: {
        id: booking.id,
        status: { in: [BookingStatus.PENDING_HOTEL, BookingStatus.AWAITING_PAYMENT] },
      },
      data: {
        status: to,
        rejectedAt: new Date(),
        ...(reason !== undefined ? { rejectionReason: reason.slice(0, 500) } : {}),
      },
    });
    if (claimed.count === 0) {
      throw new ConflictDomainException('This booking has already been answered — reload it.');
    }

    await this.releaseNights(booking);

    await this.auditService.record(auditAction, context, {
      resource: 'booking',
      resourceId: booking.id,
      metadata: {
        reference: booking.reference,
        totalAmount: Number(booking.totalAmount),
        fromStatus: booking.status,
        reason: reason ?? null,
      },
    });

    const unwound = await this.prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    await this.notifyCustomer(unwound, context);
    // Only expiry is news to the hotel. A rejection is the hotel's own action
    // taken seconds earlier, and telling them what they just did is noise.
    if (to === BookingStatus.EXPIRED) {
      await this.notifyHotel(unwound, (merchantUserId) =>
        this.hotelNotifier.bookingLapsed(
          unwound,
          merchantUserId,
          // Only an accepted booking has a payment deadline, so its presence
          // separates "the guest never paid" from "we never answered".
          unwound.paymentDeadline !== null,
          context,
        ),
      );
    }
    return unwound;
  }

  /**
   * Tell the guest, and never let that fail the thing that just happened.
   *
   * Every caller has already committed a state change — rooms released, money
   * taken, a PIN issued. A notification that could not be sent must not undo
   * any of it, so this swallows and logs rather than throwing. The notifier
   * already guards each channel; this is the outer guard for everything around
   * it, including the hotel-name lookup.
   */
  private async notifyCustomer(booking: Booking, context: AuditContext): Promise<void> {
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: booking.businessId },
        select: { businessName: true },
      });
      await this.customerNotifier.bookingChanged(
        booking,
        business?.businessName ?? 'The hotel',
        this.customerMessageFor(booking.status),
        context,
      );
    } catch (error) {
      this.logger.error(
        `Could not notify the guest about booking ${booking.reference}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Tell the hotel, under the same rule as `notifyCustomer` — a failure here
   * must never undo the thing that just happened.
   *
   * `Business.merchantId` is the owning `User.id`, which is what a notification
   * is addressed to. Resolved per call rather than threaded through, because
   * every caller already has the booking and none of them has the user.
   */
  private async notifyHotel(
    booking: Booking,
    tell: (merchantUserId: string) => Promise<void>,
  ): Promise<void> {
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: booking.businessId },
        select: { merchantId: true },
      });
      if (!business) return;
      await tell(business.merchantId);
    } catch (error) {
      this.logger.error(
        `Could not notify the hotel about booking ${booking.reference}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /** Put every night of a stay back on sale. */
  private async releaseNights(booking: Booking): Promise<void> {
    const nights = nightsBetween(booking.checkIn, booking.checkOut);
    await this.prisma.$transaction(
      nights.map((night) =>
        this.prisma.roomAvailability.updateMany({
          // `roomsBooked: { gte: rooms }` keeps the decrement from taking the
          // count below zero if this ever runs twice — the CHECK constraint
          // guards that end of the range too, and a double release should be a
          // no-op rather than an error.
          where: { roomTypeId: booking.roomTypeId, night, roomsBooked: { gte: booking.rooms } },
          data: { roomsBooked: { decrement: booking.rooms } },
        }),
      ),
    );
  }

  // ── Reads ─────────────────────────────────────────────────────────────────

  /** A guest's own bookings, newest first. */
  public async listCustomerBookings(
    customerId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: Booking[]; total: number }> {
    const where = { customerId };
    const [total, items] = await Promise.all([
      this.prisma.booking.count({ where }),
      this.prisma.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items, total };
  }

  /** One booking, and only if it is this guest's. NOT_FOUND rather than
   *  FORBIDDEN so an id cannot be probed for existence. */
  public async getCustomerBooking(customerId: string, bookingId: string): Promise<Booking> {
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, customerId } });
    if (!booking) {
      throw new NotFoundDomainException('Booking not found');
    }
    return booking;
  }

  /**
   * The hotel's own book. Defaults to what needs answering, because that is
   * what a hotel opens this screen for and every minute of the thirty counts.
   */
  public async listMerchantBookings(
    merchantUserId: string,
    page: number,
    pageSize: number,
    status?: BookingStatus,
  ): Promise<{ items: Booking[]; total: number }> {
    const businessId = await this.requireOwnBusinessId(merchantUserId);
    const where = { businessId, ...(status ? { status } : {}) };
    const [total, items] = await Promise.all([
      this.prisma.booking.count({ where }),
      this.prisma.booking.findMany({
        where,
        // Pending first and by deadline: the one closest to expiring is the one
        // the hotel most needs to see.
        orderBy: [{ status: 'asc' }, { acceptDeadline: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items, total };
  }

  /** Every hotel's bookings, for Ops. Read-only by design — see
   *  AdminBookingsController on why an operator cannot accept one. */
  public async listAllBookings(
    page: number,
    pageSize: number,
    status?: BookingStatus,
  ): Promise<{ items: Booking[]; total: number }> {
    const where = status ? { status } : {};
    const [total, items] = await Promise.all([
      this.prisma.booking.count({ where }),
      this.prisma.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items, total };
  }

  // ── Ownership ─────────────────────────────────────────────────────────────

  private async requireOwnBusinessId(merchantUserId: string): Promise<string> {
    const business = await this.prisma.business.findUnique({
      where: { merchantId: merchantUserId },
      select: { id: true },
    });
    if (!business) {
      throw new NotFoundDomainException(
        'No business is registered against this account yet. Finish merchant registration first.',
      );
    }
    return business.id;
  }

  /**
   * A booking this hotel may answer.
   *
   * Scoped by the signed-in merchant's own business, so one hotel cannot
   * accept — and take a guest's money for — another hotel's booking. That is
   * the single worst thing this API could permit, so the check is here in the
   * service rather than in a controller that a future caller might bypass.
   */
  // ── Check-in, at the desk (DPX-HOTEL-001 slice 4) ─────────────────────────

  /**
   * Find a booking by the code the guest reads out.
   *
   * Until this existed the PIN was decorative: generated, shown to the guest,
   * announced to the hotel — and impossible to look up. A guest standing at a
   * desk saying "B7X9K" had no way to be found.
   *
   * **Scoped to the hotel's own bookings, always.** Five characters is
   * guessable — about 20.5 million combinations, a lot for a person and not
   * much for a script — so what bounds the risk is not the alphabet but how
   * many bookings a caller can reach. Restricted to the caller's own business,
   * the only thing guessing can surface is a booking they may already see.
   *
   * Any paid booking is findable, including one already checked out: a desk
   * asking about a code deserves the real answer ("they left on Tuesday")
   * rather than "not found". The transition guards are what stop a finished
   * booking being acted on again.
   */
  public async findBookingByPin(merchantUserId: string, pin: string): Promise<Booking> {
    // Shape-checked before touching the database. It costs nothing, rejects
    // input that could never match, and keeps a brute-force attempt from
    // being one query per attempt.
    if (!isBookingPinShaped(pin)) {
      throw new ValidationDomainException('That is not a valid check-in code.');
    }
    const businessId = await this.requireOwnBusinessId(merchantUserId);

    const booking = await this.prisma.booking.findFirst({
      where: {
        businessId,
        // Case-insensitive, matching `bookingPinsMatch` — the single
        // definition of "these are the same code". A guest reading a code
        // aloud and a receptionist typing it will not agree on case, and
        // turning a real guest away over that is the worst outcome here.
        pin: { equals: normalizeBookingPin(pin), mode: 'insensitive' },
      },
    });
    if (!booking) {
      throw new NotFoundDomainException('No booking here matches that code.');
    }
    return booking;
  }

  /** The guest has arrived. */
  public async checkInBooking(
    merchantUserId: string,
    bookingId: string,
    context: AuditContext = {},
  ): Promise<Booking> {
    return await this.transitionBooking(
      merchantUserId,
      bookingId,
      BookingStatus.CONFIRMED,
      BookingStatus.CHECKED_IN,
      { checkedInAt: new Date() },
      BOOKING_AUDIT_ACTIONS.CHECKED_IN,
      'Only a paid, confirmed booking can be checked in.',
      context,
    );
  }

  /** The guest has left. */
  public async checkOutBooking(
    merchantUserId: string,
    bookingId: string,
    context: AuditContext = {},
  ): Promise<Booking> {
    return await this.transitionBooking(
      merchantUserId,
      bookingId,
      BookingStatus.CHECKED_IN,
      BookingStatus.CHECKED_OUT,
      { checkedOutAt: new Date() },
      BOOKING_AUDIT_ACTIONS.CHECKED_OUT,
      'Only a guest who has checked in can be checked out.',
      context,
    );
  }

  /**
   * The guest never came.
   *
   * Refused before the stay was due to start. That is not a policy, it is
   * arithmetic: nobody can have failed to arrive for a night that has not
   * happened yet.
   *
   * **What is deliberately NOT decided here** is the policy question — whether
   * a hotel may mark a no-show at 6pm on the arrival day or must wait until the
   * night is over, and whether a no-show forfeits the guest's money. Neither is
   * a founder decision yet, so neither is enforced or implied.
   */
  public async markBookingNoShow(
    merchantUserId: string,
    bookingId: string,
    context: AuditContext = {},
  ): Promise<Booking> {
    const booking = await this.requireOwnBooking(merchantUserId, bookingId);
    if (Date.now() < booking.checkIn.getTime()) {
      throw new ConflictDomainException(
        'This stay has not started yet, so the guest cannot be a no-show.',
      );
    }
    return await this.transitionBooking(
      merchantUserId,
      bookingId,
      BookingStatus.CONFIRMED,
      BookingStatus.NO_SHOW,
      {},
      BOOKING_AUDIT_ACTIONS.NO_SHOW,
      'Only a confirmed booking can be recorded as a no-show.',
      context,
    );
  }

  /**
   * One guarded state change, shared by the three desk actions.
   *
   * The `from` status lives in the WHERE rather than being read and then
   * written, so two receptionists pressing the same button at the same moment
   * produce one transition and one audit line instead of two.
   */
  private async transitionBooking(
    merchantUserId: string,
    bookingId: string,
    from: BookingStatus,
    to: BookingStatus,
    data: Prisma.BookingUpdateManyMutationInput,
    auditAction: string,
    refusal: string,
    context: AuditContext,
  ): Promise<Booking> {
    const booking = await this.requireOwnBooking(merchantUserId, bookingId);

    const claimed = await this.prisma.booking.updateMany({
      where: { id: booking.id, businessId: booking.businessId, status: from },
      data: { ...data, status: to },
    });
    if (claimed.count === 0) {
      throw new ConflictDomainException(
        `${refusal} This one is ${describeStatus(booking.status)}.`,
      );
    }

    await this.auditService.record(auditAction, context, {
      resource: 'booking',
      resourceId: booking.id,
      metadata: { reference: booking.reference, fromStatus: from, toStatus: to },
    });

    return await this.prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
  }

  /** This hotel's booking, or nothing. NOT_FOUND rather than FORBIDDEN so an
   *  id cannot be probed for existence across hotels. */
  private async requireOwnBooking(merchantUserId: string, bookingId: string): Promise<Booking> {
    const businessId = await this.requireOwnBusinessId(merchantUserId);
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, businessId } });
    if (!booking) {
      throw new NotFoundDomainException('Booking not found');
    }
    return booking;
  }

  private async requireOwnPending(merchantUserId: string, bookingId: string): Promise<Booking> {
    const businessId = await this.requireOwnBusinessId(merchantUserId);
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, businessId } });
    if (!booking) {
      throw new NotFoundDomainException('Booking not found');
    }
    if (booking.status !== BookingStatus.PENDING_HOTEL) {
      throw new ConflictDomainException(
        `This booking is ${booking.status.toLowerCase().replace(/_/g, ' ')} and cannot be answered again.`,
      );
    }
    return booking;
  }
}

/** Naira, to the kobo. */
function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The gateway's reference for a booking payment. Derived from the booking id,
 * so re-opening a checkout finds the same charge rather than starting a second
 * one against the same room.
 */
export function bookingPaymentReference(bookingId: string): string {
  return `DXBK-${bookingId.replace(/-/g, '').slice(0, 20).toUpperCase()}`;
}

/** What the guest quotes at the desk. Derived from the id, so it is stable. */
export function bookingReference(bookingId: string): string {
  return `DXB-${bookingId.replace(/-/g, '').slice(0, 10).toUpperCase()}`;
}

/**
 * The overbooking CHECK constraint refusing a write. Matched by name so a
 * different constraint failing is never mistaken for a full hotel.
 */
function isOverbookingViolation(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return (
      error.code === 'P2010' ||
      JSON.stringify(error.meta ?? {}).includes('room_availability_not_overbooked')
    );
  }
  return error instanceof Error && error.message.includes('room_availability_not_overbooked');
}

export type { RoomAvailability };

/** `AWAITING_PAYMENT` → "awaiting payment", for a sentence a receptionist reads. */
function describeStatus(status: BookingStatus): string {
  return status.toLowerCase().replace(/_/g, ' ');
}
