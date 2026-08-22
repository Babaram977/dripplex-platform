/**
 * Nights, as the booking API speaks them.
 *
 * The wire format is `YYYY-MM-DD` and every helper here stays in that format or
 * in UTC. A night is a calendar day, not an instant: building a `new Date(iso)`
 * and reading `.getDate()` gives the previous day for anyone west of UTC, and a
 * hotel in Lagos setting a Friday rate must not quietly set Thursday's.
 *
 * `to` is always exclusive, like a check-out — the morning after the last night.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Today, as the night it is in UTC. */
export function todayNight(now: Date = new Date()): string {
  return toNightString(now);
}

export function toNightString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` → the UTC midnight it names. Null if it is not a bare date. */
export function parseNight(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** The night `days` after `iso`. Negative goes back. */
export function addNights(iso: string, days: number): string {
  const base = parseNight(iso);
  if (!base) return iso;
  return toNightString(new Date(base.getTime() + days * MS_PER_DAY));
}

/** Nights slept between two dates — `to` exclusive. Zero if `to` is not after. */
export function nightsBetween(fromIso: string, toIso: string): number {
  const from = parseNight(fromIso);
  const to = parseNight(toIso);
  if (!from || !to) return 0;
  const diff = to.getTime() - from.getTime();
  return diff <= 0 ? 0 : Math.round(diff / MS_PER_DAY);
}

/** Every night in a range, `to` exclusive — what a calendar strip renders. */
export function nightRange(fromIso: string, toIso: string): string[] {
  const count = nightsBetween(fromIso, toIso);
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) out.push(addNights(fromIso, i));
  return out;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "Fri 12 Sep" — read off the UTC parts, never the local ones, so the label
 * always names the night actually being sold.
 */
export function formatNight(iso: string): string {
  const date = parseNight(iso);
  if (!date) return iso;
  return `${WEEKDAYS[date.getUTCDay()]} ${String(date.getUTCDate())} ${MONTHS[date.getUTCMonth()]}`;
}

/** "Fri 12 Sep – Sun 14 Sep · 2 nights", the way a hotel reads a stay. */
export function formatStay(checkIn: string, checkOut: string): string {
  const nights = nightsBetween(checkIn, checkOut);
  const plural = nights === 1 ? 'night' : 'nights';
  return `${formatNight(checkIn)} – ${formatNight(checkOut)} · ${String(nights)} ${plural}`;
}

/**
 * How long a hotel has left to answer, in words.
 *
 * Returns null once the window has closed, so a caller renders "expired"
 * rather than a negative countdown — a booking past its deadline is gone and
 * the guest already has their money back.
 */
export function timeLeft(deadlineIso: string, now: Date = new Date()): string | null {
  const remaining = new Date(deadlineIso).getTime() - now.getTime();
  if (Number.isNaN(remaining) || remaining <= 0) return null;

  const minutes = Math.floor(remaining / 60_000);
  if (minutes >= 1) {
    const seconds = Math.floor((remaining % 60_000) / 1000);
    return `${String(minutes)}m ${String(seconds).padStart(2, '0')}s`;
  }
  return `${String(Math.ceil(remaining / 1000))}s`;
}

/** Naira, the way a price is written on a rate card. */
export function naira(amount: number): string {
  return `₦${amount.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}
