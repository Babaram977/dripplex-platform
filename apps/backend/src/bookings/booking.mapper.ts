import type { Booking, BookingSettlement, RoomAvailability, RoomType } from '@prisma/client';

/**
 * What leaves the API.
 *
 * Decimals become numbers and dates become ISO strings, because a client that
 * has to know Prisma's Decimal is a client coupled to our ORM. Nights are
 * rendered `YYYY-MM-DD` rather than as timestamps: a night is a calendar day,
 * and handing a phone `2026-09-10T00:00:00.000Z` invites it to render "9
 * September" for anyone west of UTC.
 */

export interface RoomTypeDto {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  capacity: number;
  basePrice: number;
  totalRooms: number;
  photoUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface RoomAvailabilityDto {
  night: string;
  roomsOpen: number;
  roomsBooked: number;
  roomsLeft: number;
  /** What this night costs — the override if the hotel set one, else the base. */
  price: number;
}

export interface BookingDto {
  id: string;
  reference: string;
  businessId: string;
  roomTypeId: string;
  status: Booking['status'];
  checkIn: string;
  checkOut: string;
  nights: number;
  rooms: number;
  guests: number;
  totalAmount: number;
  guestName: string;
  guestPhone: string;
  guestNote: string | null;
  /** When the hotel's window closes. The customer app counts down to this. */
  acceptDeadline: string;
  /** When the guest's 24 hours to pay run out. Null until the hotel accepts. */
  paymentDeadline: string | null;
  paidAt: string | null;
  /** The five-character code for the desk. Present ONLY on a paid booking —
   *  its existence is the proof the money arrived. */
  pin: string | null;
  acceptedAt: string | null;
  /** When the guest actually arrived and left, as recorded at the desk. */
  checkedInAt: string | null;
  checkedOutAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

/**
 * What a guest sees, plus the two names they actually recognise.
 *
 * `BookingDto` carries `businessId` and `roomTypeId` and nothing else about
 * either, which is fine for a hotel reading its own book — it knows which hotel
 * it is. It is not fine for a guest: their bookings list showed a reference,
 * some dates and an amount, with no way to tell a room in Kano from a room in
 * Abuja. A guest recognises "Tahir Guest Palace · Deluxe King", never
 * `b61f05a2-…`.
 *
 * Denormalised onto the DTO rather than left to the client to fetch. A list of
 * ten bookings would otherwise be ten extra merchant lookups, each able to fail
 * on its own and leave a row half-named.
 */
export interface CustomerBookingDto extends BookingDto {
  hotelName: string;
  roomName: string;
}

/** A booking read with the two relations `toCustomerBookingDto` needs. Stated
 *  as a type so a caller that forgets the `include` fails to compile rather
 *  than at runtime on `undefined.businessName`. */
export type BookingWithNames = Booking & {
  business: { businessName: string };
  roomType: { name: string };
};

export function toCustomerBookingDto(booking: BookingWithNames): CustomerBookingDto {
  return {
    ...toBookingDto(booking),
    hotelName: booking.business.businessName,
    roomName: booking.roomType.name,
  };
}

/** Everything a customer's BookingDto has, plus what only the hotel may see. */
export interface MerchantBookingDto extends BookingDto {
  /** DrippleX's cut, once the hotel has accepted. Null while pending — no cut
   *  is owed on a booking nobody has agreed to. */
  commissionAmount: number | null;
  /** What the hotel actually receives: total less commission. Computed rather
   *  than stored, so it cannot disagree with the two numbers behind it. */
  payoutAmount: number | null;
}

export function toRoomTypeDto(roomType: RoomType): RoomTypeDto {
  return {
    id: roomType.id,
    businessId: roomType.businessId,
    name: roomType.name,
    description: roomType.description,
    capacity: roomType.capacity,
    basePrice: Number(roomType.basePrice),
    totalRooms: roomType.totalRooms,
    photoUrl: roomType.photoUrl,
    isActive: roomType.isActive,
    createdAt: roomType.createdAt.toISOString(),
  };
}

export function toAvailabilityDto(
  row: RoomAvailability,
  basePrice: RoomType['basePrice'],
): RoomAvailabilityDto {
  return {
    night: toNightString(row.night),
    roomsOpen: row.roomsOpen,
    roomsBooked: row.roomsBooked,
    roomsLeft: row.roomsOpen - row.roomsBooked,
    price: Number(row.priceOverride ?? basePrice),
  };
}

export function toBookingDto(booking: Booking): BookingDto {
  return {
    id: booking.id,
    reference: booking.reference,
    businessId: booking.businessId,
    roomTypeId: booking.roomTypeId,
    status: booking.status,
    checkIn: toNightString(booking.checkIn),
    checkOut: toNightString(booking.checkOut),
    nights: booking.nights,
    rooms: booking.rooms,
    guests: booking.guests,
    totalAmount: Number(booking.totalAmount),
    guestName: booking.guestName,
    guestPhone: booking.guestPhone,
    guestNote: booking.guestNote,
    acceptDeadline: booking.acceptDeadline.toISOString(),
    paymentDeadline: booking.paymentDeadline?.toISOString() ?? null,
    paidAt: booking.paidAt?.toISOString() ?? null,
    pin: booking.pin,
    acceptedAt: booking.acceptedAt?.toISOString() ?? null,
    checkedInAt: booking.checkedInAt?.toISOString() ?? null,
    checkedOutAt: booking.checkedOutAt?.toISOString() ?? null,
    rejectedAt: booking.rejectedAt?.toISOString() ?? null,
    rejectionReason: booking.rejectionReason,
    createdAt: booking.createdAt.toISOString(),
  };
}

export function toMerchantBookingDto(booking: Booking): MerchantBookingDto {
  const commissionAmount =
    booking.commissionAmount === null ? null : Number(booking.commissionAmount);
  return {
    ...toBookingDto(booking),
    commissionAmount,
    payoutAmount:
      commissionAmount === null
        ? null
        : Math.round((Number(booking.totalAmount) - commissionAmount) * 100) / 100,
  };
}

/** A Postgres DATE read back as a UTC-midnight Date, rendered as the day it is. */
export function toNightString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * A weekly payout, as a hotel or an operator sees it.
 *
 * `weekStarting` is the Monday the run was labelled by; the week it actually
 * paid for is the seven days *before* it. `weekFrom`/`weekTo` are sent so a
 * hotel reconciling against its own book is not left to work that out — the
 * question a hotel asks is "which nights is this money for", and the answer
 * should not depend on the client knowing the settlement calendar.
 */
export interface BookingSettlementDto {
  id: string;
  businessId: string;
  /** The Monday this run is labelled by, `YYYY-MM-DD`. */
  weekStarting: string;
  /** First day covered, inclusive, `YYYY-MM-DD`. */
  weekFrom: string;
  /** Last day covered, inclusive — the Sunday, not the following Monday. A
   *  hotel reading "to: Monday" would reasonably think Monday was included. */
  weekTo: string;
  status: BookingSettlement['status'];
  bookingCount: number;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  currency: string;
  /** Why a payout did not land. Null unless the status is FAILED. */
  failureReason: string | null;
  settledAt: string | null;
  createdAt: string;
}

export function toBookingSettlementDto(row: BookingSettlement): BookingSettlementDto {
  const weekStarting = row.weekStarting;
  const from = new Date(weekStarting.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lastDay = new Date(weekStarting.getTime() - 24 * 60 * 60 * 1000);
  return {
    id: row.id,
    businessId: row.businessId,
    weekStarting: toNightString(weekStarting),
    weekFrom: toNightString(from),
    weekTo: toNightString(lastDay),
    status: row.status,
    bookingCount: row.bookingCount,
    grossAmount: Number(row.grossAmount),
    commissionAmount: Number(row.commissionAmount),
    netAmount: Number(row.netAmount),
    currency: row.currency,
    failureReason: row.failureReason,
    settledAt: row.settledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
