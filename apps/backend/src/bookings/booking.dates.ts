import {
  BOOKING_MAX_HORIZON_DAYS,
  BOOKING_MAX_NIGHTS,
  BOOKING_MIN_NIGHTS,
} from './bookings.constants';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Dates for a hotel calendar.
 *
 * Every date here is a **night**, normalised to UTC midnight, and a stay from
 * the 14th to the 16th occupies the 14th and the 15th — never the 16th. The
 * departure day is not slept in and must never be held, or a hotel loses a
 * sellable night on every booking.
 *
 * Everything is UTC because `room_availability.night` is a Postgres DATE and a
 * local-midnight Date would shift across the boundary in Lagos (UTC+1) and hold
 * the wrong night. Nigeria has no daylight saving, which removes the other
 * classic source of off-by-one here, but the UTC normalisation is what makes it
 * correct rather than lucky.
 */

/** Strip a timestamp back to the UTC midnight of its calendar day. */
export function toNight(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0),
  );
}

/**
 * Every night a stay occupies: checkIn through checkOut-1, inclusive of the
 * first and exclusive of the last.
 */
export function nightsBetween(checkIn: Date, checkOut: Date): Date[] {
  const first = toNight(checkIn);
  const last = toNight(checkOut);
  const nights: Date[] = [];
  for (let t = first.getTime(); t < last.getTime(); t += MS_PER_DAY) {
    nights.push(new Date(t));
  }
  return nights;
}

/** How many nights a stay is. Zero when checkOut is not after checkIn. */
export function nightCount(checkIn: Date, checkOut: Date): number {
  const diff = toNight(checkOut).getTime() - toNight(checkIn).getTime();
  return diff <= 0 ? 0 : Math.round(diff / MS_PER_DAY);
}

export interface StayProblem {
  code:
    | 'CHECKOUT_NOT_AFTER_CHECKIN'
    | 'CHECKIN_IN_THE_PAST'
    | 'TOO_FAR_AHEAD'
    | 'TOO_SHORT'
    | 'TOO_LONG';
  message: string;
}

/**
 * Whether these dates are a stay DrippleX will take, per founder decision 7:
 * three months ahead at most, one night minimum.
 *
 * Returns the first problem rather than throwing, so the caller decides whether
 * this is a validation error for a guest or a reason to hide a date on a
 * calendar. `null` means the dates are fine.
 */
export function validateStay(checkIn: Date, checkOut: Date, now: Date): StayProblem | null {
  const nights = nightCount(checkIn, checkOut);
  if (nights === 0) {
    return {
      code: 'CHECKOUT_NOT_AFTER_CHECKIN',
      message: 'Check-out must be at least one night after check-in.',
    };
  }

  // Today still counts as bookable — someone looking for a room tonight is the
  // most common booking there is. Only a night already past is refused.
  if (toNight(checkIn).getTime() < toNight(now).getTime()) {
    return { code: 'CHECKIN_IN_THE_PAST', message: 'That check-in date has already passed.' };
  }

  const horizon = toNight(now).getTime() + BOOKING_MAX_HORIZON_DAYS * MS_PER_DAY;
  if (toNight(checkIn).getTime() > horizon) {
    return {
      code: 'TOO_FAR_AHEAD',
      message: `Bookings open ${String(BOOKING_MAX_HORIZON_DAYS)} days ahead. Please pick an earlier date.`,
    };
  }

  if (nights < BOOKING_MIN_NIGHTS) {
    return { code: 'TOO_SHORT', message: 'A stay is at least one night.' };
  }

  if (nights > BOOKING_MAX_NIGHTS) {
    return {
      code: 'TOO_LONG',
      message: `A single booking covers up to ${String(BOOKING_MAX_NIGHTS)} nights. Please contact the hotel for a longer stay.`,
    };
  }

  return null;
}
