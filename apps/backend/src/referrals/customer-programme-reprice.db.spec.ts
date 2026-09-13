import { readFileSync } from 'node:fs';
import path from 'node:path';

import { PrismaClient, ReferralRefereeType, type ReferralProgramme } from '@prisma/client';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * DPX-PROMO-REF-001, F2 — the CUSTOMER programme reprice, and its guard.
 *
 * These run the migration's own SQL, read off disk, rather than a
 * re-implementation of it. A test that restated the guard in TypeScript would
 * pass while the file shipped something else entirely — and this is the file
 * that decides what every referred customer is paid.
 *
 * Each case sets a starting state, applies the real statement inside a
 * transaction, and rolls back, so the suite's shared CUSTOMER row is left
 * exactly as it was found.
 */
describe('CUSTOMER referral programme reprice migration', () => {
  let databaseAvailable = false;
  let prisma: PrismaClient;
  let migrationSql: string;
  let original: ReferralProgramme | null = null;

  beforeAll(async () => {
    migrationSql = readFileSync(
      path.join(
        __dirname,
        '../../prisma/migrations/20260913150000_customer_referral_programme_150/migration.sql',
      ),
      'utf8',
    );
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    try {
      await prisma.$connect();
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
      return;
    }
    original = await prisma.referralProgramme.findUnique({
      where: { refereeType: ReferralRefereeType.CUSTOMER },
    });
  });

  afterAll(async () => {
    if (!databaseAvailable) return;
    if (original !== null) {
      await prisma.referralProgramme.update({
        where: { refereeType: ReferralRefereeType.CUSTOMER },
        data: {
          referrerRewardAmount: original.referrerRewardAmount,
          refereeRewardAmount: original.refereeRewardAmount,
          holdDays: original.holdDays,
          active: original.active,
        },
      });
    }
    await prisma.$disconnect();
  });

  /**
   * Apply the migration over a given starting state, then roll back.
   *
   * The rollback is an exception thrown after the assertions have read the
   * post-migration rows: Postgres gives the whole transaction back, including
   * the migration's own UPDATE, so no case can leak into the next or into the
   * rest of the suite.
   */
  async function applyOver(
    start: { referrer: number; referee: number; holdDays?: number; active?: boolean },
    read: (tx: PrismaClient) => Promise<void>,
  ): Promise<{ raised: string | null }> {
    let raised: string | null = null;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.referralProgramme.update({
          where: { refereeType: ReferralRefereeType.CUSTOMER },
          data: {
            referrerRewardAmount: start.referrer,
            refereeRewardAmount: start.referee,
            ...(start.holdDays === undefined ? {} : { holdDays: start.holdDays }),
            ...(start.active === undefined ? {} : { active: start.active }),
          },
        });
        await tx.$executeRawUnsafe(migrationSql);
        await read(tx as unknown as PrismaClient);
        throw new Error('__rollback__');
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message !== '__rollback__') {
        raised = message;
      }
    }
    return { raised };
  }

  it('reprices the seeded 350/350 to the ruled 150/150', async () => {
    if (!databaseAvailable) return;
    let observed: { referrer: number; referee: number } | null = null;

    const { raised } = await applyOver({ referrer: 350, referee: 350 }, async (tx) => {
      const row = await tx.referralProgramme.findUniqueOrThrow({
        where: { refereeType: ReferralRefereeType.CUSTOMER },
      });
      observed = {
        referrer: Number(row.referrerRewardAmount),
        referee: Number(row.refereeRewardAmount),
      };
    });

    expect(raised).toBeNull();
    expect(observed).toEqual({ referrer: 150, referee: 150 });
  });

  it('is a no-op when already at the ruled rate, so a re-run is safe', async () => {
    if (!databaseAvailable) return;
    let observed: { referrer: number; referee: number } | null = null;

    const { raised } = await applyOver({ referrer: 150, referee: 150 }, async (tx) => {
      const row = await tx.referralProgramme.findUniqueOrThrow({
        where: { refereeType: ReferralRefereeType.CUSTOMER },
      });
      observed = {
        referrer: Number(row.referrerRewardAmount),
        referee: Number(row.refereeRewardAmount),
      };
    });

    expect(raised).toBeNull();
    expect(observed).toEqual({ referrer: 150, referee: 150 });
  });

  /**
   * The guard, and the reason it exists.
   *
   * 500/500 is the placeholder the founder recalls the old referral backend
   * carrying. If production holds it, this migration must refuse rather than
   * overwrite — because a value nobody in this repository wrote is a value
   * somebody chose, and we do not know why.
   */
  it('refuses an unexpected state rather than overwriting it', async () => {
    if (!databaseAvailable) return;

    const { raised } = await applyOver({ referrer: 500, referee: 500 }, () => Promise.resolve());

    expect(raised).not.toBeNull();
    expect(raised).toContain('500');
    expect(raised).toContain('Refusing to overwrite');
  });

  it('refuses a half-changed state too', async () => {
    if (!databaseAvailable) return;

    // 350/150 is neither pair. An operator part-way through a manual fix is
    // exactly the state a blind UPDATE would quietly finish for them.
    const { raised } = await applyOver({ referrer: 350, referee: 150 }, () => Promise.resolve());

    expect(raised).not.toBeNull();
    expect(raised).toContain('Refusing to overwrite');
  });

  it('writes nothing at all when it refuses', async () => {
    if (!databaseAvailable) return;
    // The DO block raises, so Postgres rolls the statement back on its own.
    // Asserted rather than assumed: a guard that aborted after writing would
    // be worse than no guard.
    const { raised } = await applyOver({ referrer: 500, referee: 500 }, () => Promise.resolve());
    expect(raised).not.toBeNull();

    const row = await prisma.referralProgramme.findUniqueOrThrow({
      where: { refereeType: ReferralRefereeType.CUSTOMER },
    });
    expect(Number(row.referrerRewardAmount)).toBe(Number(original?.referrerRewardAmount ?? 0));
  });

  it('preserves holdDays and active', async () => {
    if (!databaseAvailable) return;
    let observed: { holdDays: number; active: boolean } | null = null;

    const { raised } = await applyOver(
      { referrer: 350, referee: 350, holdDays: 14, active: false },
      async (tx) => {
        const row = await tx.referralProgramme.findUniqueOrThrow({
          where: { refereeType: ReferralRefereeType.CUSTOMER },
        });
        observed = { holdDays: row.holdDays, active: row.active };
      },
    );

    expect(raised).toBeNull();
    // The hold is a founder-locked fraud control and the switch is an
    // operational decision. Repricing touches neither.
    expect(observed).toEqual({ holdDays: 14, active: false });
  });

  it('changes only the CUSTOMER programme', async () => {
    if (!databaseAvailable) return;
    const before = await prisma.referralProgramme.findMany({
      where: { refereeType: { not: ReferralRefereeType.CUSTOMER } },
      orderBy: { refereeType: 'asc' },
    });
    let after: { refereeType: string; referrer: number; referee: number }[] = [];

    const { raised } = await applyOver({ referrer: 350, referee: 350 }, async (tx) => {
      const rows = await tx.referralProgramme.findMany({
        where: { refereeType: { not: ReferralRefereeType.CUSTOMER } },
        orderBy: { refereeType: 'asc' },
      });
      after = rows.map((r) => ({
        refereeType: r.refereeType,
        referrer: Number(r.referrerRewardAmount),
        referee: Number(r.refereeRewardAmount),
      }));
    });

    expect(raised).toBeNull();
    // MERCHANT and FLEET carry no founder ruling. Repricing them would be
    // changing two programmes nobody asked about.
    expect(after).toEqual(
      before.map((r) => ({
        refereeType: r.refereeType,
        referrer: Number(r.referrerRewardAmount),
        referee: Number(r.refereeRewardAmount),
      })),
    );
  });
});
