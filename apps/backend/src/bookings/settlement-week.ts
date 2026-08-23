/**
 * Which week a settlement run covers.
 *
 * Founder decision 2026-08-22: hotel settlements run **weekly, every Monday**.
 * A run on Monday the 24th settles the seven days before it — Monday the 17th
 * through Sunday the 23rd — so a hotel is paid for a week that has finished,
 * never for one still in progress.
 *
 * Everything is UTC, for the same reason the booking calendar is: a
 * local-midnight boundary in Lagos (UTC+1) puts Sunday's late bookings into
 * the wrong week, and a hotel reconciling a figure against its own records
 * would find it short by exactly those.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** UTC midnight of the day this timestamp falls on. */
export function toUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0),
  );
}

/** Whether a settlement run should happen at this moment. */
export function isSettlementDay(now: Date): boolean {
  return now.getUTCDay() === 1; // 0 = Sunday, 1 = Monday
}

/**
 * The Monday that labels this run — today, when today is a Monday.
 *
 * Used as the settlement's `weekStarting`, which is what the unique index
 * keys on, so every run on the same Monday resolves to the same value and the
 * second one collides instead of paying again.
 */
export function settlementWeekStarting(now: Date): Date {
  const today = toUtcDay(now);
  const daysSinceMonday = (today.getUTCDay() + 6) % 7;
  return new Date(today.getTime() - daysSinceMonday * MS_PER_DAY);
}

export interface SettlementPeriod {
  /** The Monday this run is labelled by. */
  weekStarting: Date;
  /** First moment included — the previous Monday, 00:00 UTC. */
  from: Date;
  /** Exclusive end — this Monday, 00:00 UTC. Sunday's last booking is in. */
  to: Date;
}

/**
 * The seven days a Monday run pays for.
 *
 * `to` is exclusive so a booking paid at 23:59:59 on Sunday belongs to the week
 * being settled, and one paid at 00:00:00 on Monday belongs to the next. An
 * inclusive end would put that instant in both weeks or neither, depending on
 * how the comparison happened to be written.
 */
export function settlementPeriod(now: Date): SettlementPeriod {
  const weekStarting = settlementWeekStarting(now);
  return {
    weekStarting,
    from: new Date(weekStarting.getTime() - 7 * MS_PER_DAY),
    to: weekStarting,
  };
}

/**
 * The next Monday a settlement will run on — today, if today is Monday.
 *
 * Needed because previewing is asked on a day that is *not* the run day.
 * `settlementPeriod(now)` answers "what does a run happening now cover", and on
 * a Sunday that is the week that already settled last Monday — the wrong answer
 * to "what will I be paid tomorrow". This walks forward to the run instead of
 * backward from it.
 */
export function nextSettlementDay(now: Date): Date {
  const today = toUtcDay(now);
  // 0 = Sunday, 1 = Monday. Days until the next Monday, or 0 if it is Monday.
  const untilMonday = (8 - today.getUTCDay()) % 7;
  return new Date(today.getTime() + untilMonday * MS_PER_DAY);
}
