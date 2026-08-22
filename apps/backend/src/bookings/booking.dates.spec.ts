import { nightCount, nightsBetween, toNight, validateStay } from './booking.dates';
import { BOOKING_MAX_HORIZON_DAYS, BOOKING_MAX_NIGHTS } from './bookings.constants';

const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

describe('booking dates', () => {
  describe('nightsBetween', () => {
    /**
     * The one that matters. A stay from the 14th to the 16th sleeps the 14th
     * and the 15th; the 16th is the morning they leave. Holding the checkout
     * day would cost a hotel a sellable night on every single booking.
     */
    it('holds the nights slept and never the departure day', () => {
      expect(nightsBetween(day('2026-08-14'), day('2026-08-16'))).toEqual([
        day('2026-08-14'),
        day('2026-08-15'),
      ]);
    });

    it('holds exactly one night for a one-night stay', () => {
      expect(nightsBetween(day('2026-08-14'), day('2026-08-15'))).toEqual([day('2026-08-14')]);
    });

    it('holds nothing when checkout is not after checkin', () => {
      expect(nightsBetween(day('2026-08-14'), day('2026-08-14'))).toEqual([]);
      expect(nightsBetween(day('2026-08-16'), day('2026-08-14'))).toEqual([]);
    });

    it('crosses a month boundary without losing a night', () => {
      expect(nightsBetween(day('2026-08-30'), day('2026-09-02'))).toEqual([
        day('2026-08-30'),
        day('2026-08-31'),
        day('2026-09-01'),
      ]);
    });

    /** Lagos is UTC+1, so an evening timestamp is already "tomorrow" locally.
     *  The night held must still be the UTC date the calendar row uses. */
    it('normalises a timestamp to the UTC night, whatever the time of day', () => {
      expect(nightsBetween(new Date('2026-08-14T23:30:00.000Z'), day('2026-08-15'))).toEqual([
        day('2026-08-14'),
      ]);
      expect(toNight(new Date('2026-08-14T23:30:00.000Z'))).toEqual(day('2026-08-14'));
    });
  });

  describe('nightCount', () => {
    it('counts the nights slept', () => {
      expect(nightCount(day('2026-08-14'), day('2026-08-16'))).toBe(2);
      expect(nightCount(day('2026-08-14'), day('2026-08-15'))).toBe(1);
      expect(nightCount(day('2026-08-14'), day('2026-08-14'))).toBe(0);
    });
  });

  describe('validateStay — founder decision 7', () => {
    const now = day('2026-08-21');

    it('accepts an ordinary stay', () => {
      expect(validateStay(day('2026-08-25'), day('2026-08-27'), now)).toBeNull();
    });

    it('accepts a room for tonight', () => {
      expect(validateStay(day('2026-08-21'), day('2026-08-22'), now)).toBeNull();
    });

    it('refuses a checkout that is not after checkin', () => {
      expect(validateStay(day('2026-08-25'), day('2026-08-25'), now)?.code).toBe(
        'CHECKOUT_NOT_AFTER_CHECKIN',
      );
    });

    it('refuses a night already gone', () => {
      expect(validateStay(day('2026-08-20'), day('2026-08-22'), now)?.code).toBe(
        'CHECKIN_IN_THE_PAST',
      );
    });

    it('accepts the last day of the three-month horizon and refuses the next', () => {
      const lastAllowed = new Date(now.getTime() + BOOKING_MAX_HORIZON_DAYS * 86_400_000);
      const oneTooFar = new Date(lastAllowed.getTime() + 86_400_000);
      expect(
        validateStay(lastAllowed, new Date(lastAllowed.getTime() + 86_400_000), now),
      ).toBeNull();
      expect(validateStay(oneTooFar, new Date(oneTooFar.getTime() + 86_400_000), now)?.code).toBe(
        'TOO_FAR_AHEAD',
      );
    });

    it('accepts the longest allowed stay and refuses one night more', () => {
      const checkIn = day('2026-08-25');
      const longest = new Date(checkIn.getTime() + BOOKING_MAX_NIGHTS * 86_400_000);
      const tooLong = new Date(longest.getTime() + 86_400_000);
      expect(validateStay(checkIn, longest, now)).toBeNull();
      expect(validateStay(checkIn, tooLong, now)?.code).toBe('TOO_LONG');
    });
  });
});
