import {
  allocatePointsLots,
  nextExpiry,
  remainingAfter,
  remainingForLot,
  type PointsLedgerLine,
} from './points-lots';

function line(
  id: string,
  points: number,
  createdAt: string,
  expiresAt: string | null = null,
): PointsLedgerLine {
  return {
    id,
    points,
    createdAt: new Date(createdAt),
    expiresAt: expiresAt === null ? null : new Date(expiresAt),
  };
}

describe('allocatePointsLots', () => {
  it('leaves untouched awards whole', () => {
    const lots = allocatePointsLots([
      line('a', 100, '2026-01-01T00:00:00.000Z'),
      line('b', 250, '2026-06-01T00:00:00.000Z'),
    ]);

    expect(lots.map((lot) => [lot.id, lot.remaining])).toEqual([
      ['a', 100],
      ['b', 250],
    ]);
  });

  it('spends the oldest award first', () => {
    const lots = allocatePointsLots([
      line('jan', 100, '2026-01-01T00:00:00.000Z'),
      line('jun', 100, '2026-06-01T00:00:00.000Z'),
      line('spend', -150, '2026-07-01T00:00:00.000Z'),
    ]);

    // This is the case the old expiry got wrong: January is gone, and what is
    // left belongs to June — so nothing should expire when January falls due.
    expect(remainingForLot(lots, 'jan')).toBe(0);
    expect(remainingForLot(lots, 'jun')).toBe(50);
  });

  it('never reports more spent than was ever awarded', () => {
    const lots = allocatePointsLots([
      line('a', 50, '2026-01-01T00:00:00.000Z'),
      line('spend', -500, '2026-02-01T00:00:00.000Z'),
    ]);

    expect(remainingForLot(lots, 'a')).toBe(0);
  });

  it('does not depend on the order rows arrive in', () => {
    const shuffled = allocatePointsLots([
      line('spend', -150, '2026-07-01T00:00:00.000Z'),
      line('jun', 100, '2026-06-01T00:00:00.000Z'),
      line('jan', 100, '2026-01-01T00:00:00.000Z'),
    ]);

    expect(remainingForLot(shuffled, 'jan')).toBe(0);
    expect(remainingForLot(shuffled, 'jun')).toBe(50);
  });

  it('treats an earlier expiry as a debit like any other', () => {
    const lots = allocatePointsLots([
      line('jan', 100, '2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z'),
      line('expired-jan', -100, '2027-01-02T00:00:00.000Z'),
      line('feb', 40, '2026-02-01T00:00:00.000Z', '2027-02-01T00:00:00.000Z'),
    ]);

    expect(remainingForLot(lots, 'jan')).toBe(0);
    expect(remainingForLot(lots, 'feb')).toBe(40);
  });

  it('reports 0 for a ledger row that is not an award', () => {
    const lots = allocatePointsLots([line('spend', -10, '2026-01-01T00:00:00.000Z')]);

    expect(remainingForLot(lots, 'spend')).toBe(0);
    expect(lots).toHaveLength(0);
  });
});

describe('remainingAfter', () => {
  it('excludes points that will be gone by then', () => {
    const lots = allocatePointsLots([
      line('soon', 100, '2026-01-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z'),
      line('later', 300, '2026-02-01T00:00:00.000Z', '2027-02-01T00:00:00.000Z'),
      line('never', 50, '2026-03-01T00:00:00.000Z', null),
    ]);

    expect(remainingAfter(lots, new Date('2026-11-01T00:00:00.000Z'))).toBe(350);
  });
});

describe('nextExpiry', () => {
  it('reports the soonest expiry and everything falling due with it', () => {
    const lots = allocatePointsLots([
      line('a', 100, '2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z'),
      line('b', 25, '2026-01-02T00:00:00.000Z', '2027-01-01T00:00:00.000Z'),
      line('c', 400, '2026-02-01T00:00:00.000Z', '2027-06-01T00:00:00.000Z'),
    ]);

    expect(nextExpiry(lots, new Date('2026-09-11T00:00:00.000Z'))).toEqual({
      at: new Date('2027-01-01T00:00:00.000Z'),
      points: 125,
    });
  });

  it('ignores awards that have already been spent', () => {
    const lots = allocatePointsLots([
      line('a', 100, '2026-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z'),
      line('b', 400, '2026-02-01T00:00:00.000Z', '2027-06-01T00:00:00.000Z'),
      line('spend', -100, '2026-03-01T00:00:00.000Z'),
    ]);

    expect(nextExpiry(lots, new Date('2026-09-11T00:00:00.000Z'))?.at).toEqual(
      new Date('2027-06-01T00:00:00.000Z'),
    );
  });

  it('returns null when nothing is due to expire', () => {
    const lots = allocatePointsLots([line('a', 100, '2026-01-01T00:00:00.000Z', null)]);

    expect(nextExpiry(lots, new Date('2026-09-11T00:00:00.000Z'))).toBeNull();
  });
});
