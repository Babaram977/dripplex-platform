import {
  isSettlementDay,
  settlementPeriod,
  settlementWeekStarting,
  toUtcDay,
} from './settlement-week';

const at = (iso: string): Date => new Date(iso);

describe('settlement week', () => {
  describe('isSettlementDay', () => {
    it('is true on a Monday and false on every other day', () => {
      // 2026-08-24 is a Monday.
      expect(isSettlementDay(at('2026-08-24T00:00:00.000Z'))).toBe(true);
      expect(isSettlementDay(at('2026-08-24T23:59:59.000Z'))).toBe(true);
      for (const day of ['23', '25', '26', '27', '28', '29', '30']) {
        expect(isSettlementDay(at(`2026-08-${day}T09:00:00.000Z`))).toBe(false);
      }
    });

    /**
     * Lagos is UTC+1. A run at 00:30 Monday local time is still Sunday in UTC,
     * and treating it as Monday would settle a week that has not finished.
     */
    it('reads the UTC day, not a local one', () => {
      // 23:30 UTC on Sunday = 00:30 Monday in Lagos.
      expect(isSettlementDay(at('2026-08-23T23:30:00.000Z'))).toBe(false);
      // 23:30 UTC on Monday = 00:30 Tuesday in Lagos, still Monday's run.
      expect(isSettlementDay(at('2026-08-24T23:30:00.000Z'))).toBe(true);
    });
  });

  describe('settlementWeekStarting', () => {
    /** The label the unique index keys on. Every run on the same Monday must
     *  resolve to the same value, or the second one would pay again. */
    it('is the same value at any hour of the same Monday', () => {
      const early = settlementWeekStarting(at('2026-08-24T00:00:01.000Z'));
      const late = settlementWeekStarting(at('2026-08-24T23:59:59.000Z'));
      expect(early.toISOString()).toBe('2026-08-24T00:00:00.000Z');
      expect(late.toISOString()).toBe(early.toISOString());
    });
  });

  describe('settlementPeriod', () => {
    it('covers the seven days before the Monday it runs on', () => {
      const period = settlementPeriod(at('2026-08-24T06:00:00.000Z'));
      expect(period.weekStarting.toISOString()).toBe('2026-08-24T00:00:00.000Z');
      expect(period.from.toISOString()).toBe('2026-08-17T00:00:00.000Z');
      expect(period.to.toISOString()).toBe('2026-08-24T00:00:00.000Z');
    });

    /**
     * The boundary that decides which week a booking is paid in. Sunday's last
     * second is settled now; Monday's first second waits a week. An inclusive
     * end would put that instant in both weeks or neither.
     */
    it('includes the last second of Sunday and excludes the first of Monday', () => {
      const { from, to } = settlementPeriod(at('2026-08-24T06:00:00.000Z'));
      const sundayLast = at('2026-08-23T23:59:59.999Z');
      const mondayFirst = at('2026-08-24T00:00:00.000Z');

      expect(sundayLast >= from && sundayLast < to).toBe(true);
      expect(mondayFirst >= from && mondayFirst < to).toBe(false);
    });

    it('is exactly seven days long', () => {
      const { from, to } = settlementPeriod(at('2026-08-24T06:00:00.000Z'));
      expect(to.getTime() - from.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('walks back across a month boundary without losing days', () => {
      // 2026-09-07 is a Monday; the week before crosses into August.
      const period = settlementPeriod(at('2026-09-07T06:00:00.000Z'));
      expect(period.from.toISOString()).toBe('2026-08-31T00:00:00.000Z');
      expect(period.to.toISOString()).toBe('2026-09-07T00:00:00.000Z');
    });

    /** Consecutive weeks must abut exactly — no booking falls in a gap, none
     *  is paid in two runs. */
    it('leaves no gap and no overlap between consecutive weeks', () => {
      const thisWeek = settlementPeriod(at('2026-08-24T06:00:00.000Z'));
      const nextWeek = settlementPeriod(at('2026-08-31T06:00:00.000Z'));
      expect(nextWeek.from.toISOString()).toBe(thisWeek.to.toISOString());
    });
  });

  describe('toUtcDay', () => {
    it('strips the time and keeps the UTC date', () => {
      expect(toUtcDay(at('2026-08-24T23:59:59.000Z')).toISOString()).toBe(
        '2026-08-24T00:00:00.000Z',
      );
    });
  });
});
