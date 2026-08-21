import type { Booking, RoomAvailability, RoomType } from '@prisma/client';

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
  acceptedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
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
    acceptedAt: booking.acceptedAt?.toISOString() ?? null,
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
