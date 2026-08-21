import { describe, expect, it } from 'vitest';

import {
  addNights,
  formatNight,
  formatStay,
  naira,
  nightRange,
  nightsBetween,
  parseNight,
  timeLeft,
  todayNight,
} from './bookingDates';

describe('booking dates', () => {
  describe('formatNight', () => {
    /**
     * The reason every helper here works in UTC. Lagos runs UTC+1, so a Date
     * built from a bare ISO date and read with local getters can name the day
     * before. The label must always be the night actually being sold.
     */
    it('names the night itself, not the local rendering of it', () => {
      expect(formatNight('2026-09-11')).toBe('Fri 11 Sep');
      expect(formatNight('2026-01-01')).toBe('Thu 1 Jan');
      expect(formatNight('2026-12-31')).toBe('Thu 31 Dec');
    });

    it('returns the input unchanged when it is not a night', () => {
      expect(formatNight('not-a-date')).toBe('not-a-date');
    });
  });

  describe('nightsBetween', () => {
    it('counts the nights slept, never the departure day', () => {
      expect(nightsBetween('2026-09-10', '2026-09-12')).toBe(2);
      expect(nightsBetween('2026-09-10', '2026-09-11')).toBe(1);
    });

    it('is zero when checkout is not after checkin', () => {
      expect(nightsBetween('2026-09-10', '2026-09-10')).toBe(0);
      expect(nightsBetween('2026-09-12', '2026-09-10')).toBe(0);
    });

    it('crosses a month boundary correctly', () => {
      expect(nightsBetween('2026-08-30', '2026-09-02')).toBe(3);
    });
  });

  describe('nightRange', () => {
    it('lists the nights slept and excludes the checkout day', () => {
      expect(nightRange('2026-09-10', '2026-09-13')).toEqual([
        '2026-09-10',
        '2026-09-11',
        '2026-09-12',
      ]);
    });

    it('is empty for a zero-length range', () => {
      expect(nightRange('2026-09-10', '2026-09-10')).toEqual([]);
    });
  });

  describe('addNights', () => {
    it('walks forward and back across a month boundary', () => {
      expect(addNights('2026-08-31', 1)).toBe('2026-09-01');
      expect(addNights('2026-09-01', -1)).toBe('2026-08-31');
      expect(addNights('2026-09-10', 90)).toBe('2026-12-09');
    });

    it('crosses a leap day rather than skipping it', () => {
      expect(addNights('2028-02-28', 1)).toBe('2028-02-29');
      expect(addNights('2028-02-29', 1)).toBe('2028-03-01');
    });
  });

  describe('todayNight', () => {
    it('reads the UTC day, so an evening in Lagos is still today', () => {
      expect(todayNight(new Date('2026-09-10T23:30:00.000Z'))).toBe('2026-09-10');
      expect(todayNight(new Date('2026-09-10T00:00:01.000Z'))).toBe('2026-09-10');
    });
  });

  describe('parseNight', () => {
    it('accepts a bare date and refuses anything else', () => {
      expect(parseNight('2026-09-10')?.toISOString()).toBe('2026-09-10T00:00:00.000Z');
      expect(parseNight('2026-09-10T12:00:00Z')).toBeNull();
      expect(parseNight('10/09/2026')).toBeNull();
      expect(parseNight('')).toBeNull();
    });
  });

  describe('timeLeft', () => {
    const deadline = '2026-09-10T12:30:00.000Z';

    it('counts down the thirty minutes', () => {
      expect(timeLeft(deadline, new Date('2026-09-10T12:00:00.000Z'))).toBe('30m 00s');
      expect(timeLeft(deadline, new Date('2026-09-10T12:28:30.000Z'))).toBe('1m 30s');
    });

    it('drops to seconds in the last minute', () => {
      expect(timeLeft(deadline, new Date('2026-09-10T12:29:45.000Z'))).toBe('15s');
    });

    /** Null, not a negative countdown: the window is closed and the guest
     *  already has their money back. */
    it('returns null once the window has closed', () => {
      expect(timeLeft(deadline, new Date('2026-09-10T12:30:00.000Z'))).toBeNull();
      expect(timeLeft(deadline, new Date('2026-09-10T13:00:00.000Z'))).toBeNull();
    });
  });

  describe('formatStay', () => {
    it('reads the way a hotel reads a stay', () => {
      expect(formatStay('2026-09-10', '2026-09-12')).toBe('Thu 10 Sep – Sat 12 Sep · 2 nights');
    });

    it('says night, singular, for one night', () => {
      expect(formatStay('2026-09-10', '2026-09-11')).toBe('Thu 10 Sep – Fri 11 Sep · 1 night');
    });
  });

  describe('naira', () => {
    it('groups thousands and drops trailing zeros', () => {
      expect(naira(20000)).toBe('₦20,000');
      expect(naira(1500.5)).toBe('₦1,500.5');
    });
  });
});
