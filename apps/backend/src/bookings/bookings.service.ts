import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { BookingStatus, Prisma, WalletOwnerType } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { MerchantCommissionSettingsService } from '../orders/merchant-commission-settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

import { nightCount, nightsBetween, toNight, validateStay } from './booking.dates';
import {
  BOOKING_ACCEPT_WINDOW_MS,
  BOOKING_AUDIT_ACTIONS,
  BOOKING_EXPIRED_CUSTOMER_MESSAGE,
  BOOKING_MAX_ROOMS,
  BOOKING_REJECTED_CUSTOMER_MESSAGE,
  BOOKING_WALLET_REFERENCE_TYPE,
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
 * The whole design turns on founder decisions 3, 8 and 9: the hotel accepts
 * first, the guest's money is HELD rather than taken while it decides, and it
 * has thirty minutes. Every exit from PENDING_HOTEL therefore does exactly one
 * of two things to that hold — commits it or releases it — and never neither
 * and never both.
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
    private readonly walletService: WalletService,
    private readonly commissionSettings: MerchantCommissionSettingsService,
    private readonly auditService: AuditService,
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

    // The hold is placed AFTER the nights are held, and outside their
    // transaction, because WalletService runs its own. If it fails, the guest
    // is not charged and the nights must go back — otherwise a hotel looks
    // full because of a booking that never existed.
    try {
      await this.walletService.hold({
        ownerType: WalletOwnerType.CUSTOMER,
        ownerId: customerId,
        amount: quote.totalAmount,
        description: `Booking ${reference} — ${roomType.name}`,
        referenceType: BOOKING_WALLET_REFERENCE_TYPE,
        referenceId: booking.id,
        context,
      });
    } catch (error) {
      await this.releaseNights(booking).catch((cause: unknown) => {
        // Both failed. The nights are now held against a booking with no
        // money behind it, which needs a human — say so loudly rather than
        // swallowing it.
        this.logger.error(
          `Booking ${reference}: wallet hold failed AND releasing the nights failed (${String(cause)}). Rooms are held with no hold behind them — needs manual correction.`,
        );
      });
      await this.prisma.booking.delete({ where: { id: booking.id } }).catch(() => undefined);
      throw error;
    }

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
  public async acceptBooking(bookingId: string, context: AuditContext = {}): Promise<Booking> {
    const booking = await this.requirePending(bookingId);

    if (booking.acceptDeadline.getTime() <= Date.now()) {
      throw new ConflictDomainException(
        'The thirty-minute window on this booking has closed and the guest has been refunded.',
      );
    }

    const rate = Number((await this.commissionSettings.getEffective()).commissionRate);
    const commissionAmount = roundMoney(Number(booking.totalAmount) * rate);

    await this.walletService.commitHold({
      ownerType: WalletOwnerType.CUSTOMER,
      ownerId: booking.customerId,
      amount: booking.totalAmount,
      description: `Booking ${booking.reference} confirmed`,
      referenceType: BOOKING_WALLET_REFERENCE_TYPE,
      referenceId: booking.id,
      context,
    });

    // Claimed conditionally so a hotel double-tapping Accept, or Accept racing
    // the expiry sweep, cannot move the money twice — commitHold is itself
    // idempotent on its reference, and this makes the status transition so too.
    const claimed = await this.prisma.booking.updateMany({
      where: { id: booking.id, status: BookingStatus.PENDING_HOTEL },
      data: {
        status: BookingStatus.CONFIRMED,
        acceptedAt: new Date(),
        commissionAmount: new Prisma.Decimal(commissionAmount),
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
        commissionRate: rate,
        commissionAmount,
      },
    });

    return await this.prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
  }

  /** The hotel says no. The guest was never charged, and the nights go back. */
  public async rejectBooking(
    bookingId: string,
    reason: string | undefined,
    context: AuditContext = {},
  ): Promise<Booking> {
    const booking = await this.requirePending(bookingId);
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
    const overdue = await this.prisma.booking.findMany({
      where: { status: BookingStatus.PENDING_HOTEL, acceptDeadline: { lte: now } },
      take: 100,
    });

    let expired = 0;
    for (const booking of overdue) {
      try {
        await this.unwind(
          booking,
          BookingStatus.EXPIRED,
          BOOKING_AUDIT_ACTIONS.EXPIRED,
          undefined,
          {},
        );
        expired += 1;
      } catch (error) {
        // One booking that cannot be unwound must not stop the rest — the
        // others are guests whose money is still held.
        this.logger.error(
          `Could not expire booking ${booking.reference}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (expired > 0) {
      this.logger.warn(
        `Expired ${String(expired)} booking(s) the hotel did not answer within thirty minutes. Money released to the guests.`,
      );
    }
    return expired;
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
    await this.walletService.releaseHold({
      ownerType: WalletOwnerType.CUSTOMER,
      ownerId: booking.customerId,
      amount: booking.totalAmount,
      description: `Booking ${booking.reference} — money returned`,
      referenceType: BOOKING_WALLET_REFERENCE_TYPE,
      referenceId: booking.id,
      context,
    });

    const claimed = await this.prisma.booking.updateMany({
      where: { id: booking.id, status: BookingStatus.PENDING_HOTEL },
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
        reason: reason ?? null,
      },
    });

    return await this.prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
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

  private async requirePending(bookingId: string): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
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
