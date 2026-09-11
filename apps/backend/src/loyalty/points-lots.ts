/**
 * Which awarded points are still there.
 *
 * A loyalty balance is not one number — it is a stack of awards, each with its
 * own expiry date. `LoyaltyAccount.pointsBalance` is the total, and the ledger
 * is where the total comes from, but neither says *which* award a spent point
 * came out of. Expiry needs exactly that: when a 365-day-old award falls due,
 * the question is how much of that specific award is left, not how much the
 * account has.
 *
 * Getting it wrong destroys points. The old expiry took
 * `min(entry.points, account.pointsBalance)`, so a customer who earned 100 in
 * January and 100 in June, then spent 150, had 50 left — all of it June's. When
 * January's award fell due it expired `min(100, 50)` = 50 and the customer was
 * left with nothing, five months early.
 *
 * Points are consumed oldest-first: every debit — a redemption or an earlier
 * expiry — eats into the oldest award that still has something in it. That rule
 * is the whole of this file, and it is deliberately a pure function over ledger
 * rows so it can be tested without a database and so the ledger stays the only
 * source of truth (no denormalised per-lot counter to drift out of step).
 */

export interface PointsLedgerLine {
  id: string;
  /** Positive for an award, negative for a redemption or an expiry. */
  points: number;
  createdAt: Date;
  expiresAt: Date | null;
}

export interface PointsLot {
  id: string;
  awarded: number;
  /** How much of this award has not been spent or expired yet. */
  remaining: number;
  expiresAt: Date | null;
  createdAt: Date;
}

/**
 * Replays a whole account's ledger and reports what is left of each award.
 *
 * Debits are pooled rather than matched to the awards that existed when each
 * one happened. The result is the same — a debit can only ever spend points
 * that were already awarded, so pooling cannot consume an award from the
 * future — and it makes the outcome independent of how rows happen to be
 * ordered within the same millisecond.
 */
export function allocatePointsLots(lines: readonly PointsLedgerLine[]): PointsLot[] {
  const lots: PointsLot[] = lines
    .filter((line) => line.points > 0)
    .sort(oldestFirst)
    .map((line) => ({
      id: line.id,
      awarded: line.points,
      remaining: line.points,
      expiresAt: line.expiresAt,
      createdAt: line.createdAt,
    }));

  let outstanding = lines
    .filter((line) => line.points < 0)
    .reduce((total, line) => total + Math.abs(line.points), 0);

  for (const lot of lots) {
    if (outstanding <= 0) {
      break;
    }
    const taken = Math.min(lot.remaining, outstanding);
    lot.remaining -= taken;
    outstanding -= taken;
  }

  return lots;
}

/** What is left of one specific award, or 0 if it is spent or not an award. */
export function remainingForLot(lots: readonly PointsLot[], lotId: string): number {
  return lots.find((lot) => lot.id === lotId)?.remaining ?? 0;
}

/**
 * The part of a balance that survives past `at` — what a customer can still
 * count on, as opposed to what they hold right now.
 */
export function remainingAfter(lots: readonly PointsLot[], at: Date): number {
  return lots
    .filter((lot) => lot.expiresAt === null || lot.expiresAt.getTime() > at.getTime())
    .reduce((total, lot) => total + lot.remaining, 0);
}

/** The soonest expiry that still has points behind it, or null. */
export function nextExpiry(
  lots: readonly PointsLot[],
  at: Date,
): { at: Date; points: number } | null {
  const due = lots
    .filter(
      (lot): lot is PointsLot & { expiresAt: Date } =>
        lot.remaining > 0 && lot.expiresAt !== null && lot.expiresAt.getTime() > at.getTime(),
    )
    .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());

  const soonest = due[0];
  if (soonest === undefined) {
    return null;
  }

  const expiresAt = soonest.expiresAt;
  const points = due
    .filter((lot) => lot.expiresAt.getTime() === expiresAt.getTime())
    .reduce((total, lot) => total + lot.remaining, 0);

  return { at: expiresAt, points };
}

function oldestFirst(a: PointsLedgerLine, b: PointsLedgerLine): number {
  const byTime = a.createdAt.getTime() - b.createdAt.getTime();
  return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
}
