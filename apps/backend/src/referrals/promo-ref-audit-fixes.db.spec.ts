import { randomUUID } from 'node:crypto';

import { LoyaltyLedgerEntryType, PrismaClient } from '@prisma/client';

import { LOYALTY_SETTING_ID } from '../loyalty/loyalty.constants';
import { LoyaltyService } from '../loyalty/loyalty.service';

import type { AuditService } from '../audit/audit.service';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * DPX-PROMO-REF-001 — the cross-increment financial defects the feature audit
 * found, and the guards that now close them.
 *
 * Each of these passed every increment's own tests. They are here together
 * because that is the level at which they were wrong: the pieces were correct
 * and their interaction was not.
 */
describe('promo-ref audit fixes', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let loyalty: LoyaltyService;
  const users: string[] = [];

  async function aUser(): Promise<string> {
    const id = randomUUID();
    await prisma.user.create({
      data: {
        id,
        email: `${id}@audit.test`,
        passwordHash: 'x',
        firstName: 'Audit',
        lastName: 'Subject',
      },
    });
    users.push(id);
    return id;
  }

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    }) as unknown as PrismaService;
    try {
      await prisma.$connect();
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
      return;
    }
    const audit = { record: () => Promise.resolve(undefined) } as unknown as AuditService;
    loyalty = new LoyaltyService(
      prisma,
      audit,
      { credit: () => Promise.resolve(undefined) } as never,
      {
        getEffective: () =>
          Promise.resolve({
            pointsPerNaira: 100,
            minRedemptionPoints: 100,
            dailyRedemptionPointsCap: null,
          }),
      } as never,
    );
  });

  afterAll(async () => {
    if (!databaseAvailable) return;
    for (const id of users) {
      await prisma.loyaltyLedgerEntry.deleteMany({ where: { account: { userId: id } } });
      await prisma.loyaltyAccount.deleteMany({ where: { userId: id } });
      await prisma.user.deleteMany({ where: { id } });
    }
    await prisma.$disconnect();
  });

  /* ------------------------------------------------------------------ *
   * F3 — a points award keyed on a reference happens exactly once.
   * ------------------------------------------------------------------ */

  describe('points payout idempotency', () => {
    it('a replayed award credits nothing further', async () => {
      if (!databaseAvailable) return;
      const userId = await aUser();
      const redemptionId = randomUUID();

      const first = await loyalty.awardPoints({
        userId,
        points: 15_000,
        reason: 'Referral reward',
        referenceType: 'REFERRER_REWARD',
        referenceId: redemptionId,
        type: LoyaltyLedgerEntryType.BONUS,
      });
      const second = await loyalty.awardPoints({
        userId,
        points: 15_000,
        reason: 'Referral reward',
        referenceType: 'REFERRER_REWARD',
        referenceId: redemptionId,
        type: LoyaltyLedgerEntryType.BONUS,
      });

      expect(first.points.balance).toBe(15_000);
      // The number that matters: replaying the payout does not pay again.
      expect(second.points.balance).toBe(15_000);
      expect(
        await prisma.loyaltyLedgerEntry.count({
          where: { account: { userId }, referenceId: redemptionId, points: { gt: 0 } },
        }),
      ).toBe(1);
    });

    /**
     * The concurrent case the in-transaction check cannot see.
     *
     * Reported as a ratio over repeated runs, never as one green pass: a race
     * that fails one run in ten looks identical to a fixed one if you only run
     * it once.
     */
    it('concurrent awards under one reference credit once, every run', async () => {
      if (!databaseAvailable) return;
      const RUNS = 10;
      const outcomes: number[] = [];

      for (let run = 0; run < RUNS; run += 1) {
        const userId = await aUser();
        const redemptionId = randomUUID();
        const award = (): Promise<unknown> =>
          loyalty
            .awardPoints({
              userId,
              points: 15_000,
              reason: 'Referral reward',
              referenceType: 'REFERRER_REWARD',
              referenceId: redemptionId,
              type: LoyaltyLedgerEntryType.BONUS,
            })
            // A concurrent loser may surface as the unique violation before the
            // service converts it; either way nothing extra may be credited.
            .catch(() => undefined);

        await Promise.all([award(), award(), award()]);
        const account = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId } });
        outcomes.push(account.pointsBalance);
      }

      const overpaid = outcomes.filter((balance) => balance !== 15_000);
      expect(`${String(RUNS - overpaid.length)}/${String(RUNS)} credited once`).toBe(
        `${String(RUNS)}/${String(RUNS)} credited once`,
      );
    });

    it('the database refuses a second award even when the service is bypassed', async () => {
      if (!databaseAvailable) return;
      const userId = await aUser();
      const redemptionId = randomUUID();
      await loyalty.awardPoints({
        userId,
        points: 15_000,
        reason: 'Referral reward',
        referenceType: 'REFERRER_REWARD',
        referenceId: redemptionId,
        type: LoyaltyLedgerEntryType.BONUS,
      });
      const account = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId } });

      // Straight at the table, the way a future code path might.
      await expect(
        prisma.loyaltyLedgerEntry.create({
          data: {
            accountId: account.id,
            points: 15_000,
            type: LoyaltyLedgerEntryType.BONUS,
            reason: 'Referral reward',
            referenceType: 'REFERRER_REWARD',
            referenceId: redemptionId,
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('still allows a reversal against the same reference', async () => {
      if (!databaseAvailable) return;
      const userId = await aUser();
      const redemptionId = randomUUID();
      await loyalty.awardPoints({
        userId,
        points: 15_000,
        reason: 'Referral reward',
        referenceType: 'REFERRER_REWARD',
        referenceId: redemptionId,
        type: LoyaltyLedgerEntryType.BONUS,
      });

      // The award and its reversal share a reference and differ only by type.
      // A three-column key would have made every reward irreversible.
      const result = await loyalty.reversePointsFor({
        userId,
        referenceType: 'REFERRER_REWARD',
        referenceId: redemptionId,
        reason: 'Referral reward reversed',
      });

      expect(result.reversed).toBe(15_000);
      const account = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId } });
      expect(account.pointsBalance).toBe(0);
    });

    /**
     * The application check, proven on its own.
     *
     * With the index in place a mutation deleting the in-transaction guard
     * changes nothing observable — the database catches the replay instead and
     * the service converts it. That makes the two layers indistinguishable from
     * outside, so this test removes the database's half and asserts the
     * application still refuses. Both layers are wanted: the index is the
     * guarantee, the check is what keeps the common replay off the exception
     * path.
     */
    it('refuses a replay in the application even with the index dropped', async () => {
      if (!databaseAvailable) return;
      const userId = await aUser();
      const redemptionId = randomUUID();
      await prisma.$executeRawUnsafe(
        'DROP INDEX IF EXISTS "loyalty_ledger_entries_account_reference_kind_key"',
      );
      try {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          await loyalty.awardPoints({
            userId,
            points: 15_000,
            reason: 'Referral reward',
            referenceType: 'REFERRER_REWARD',
            referenceId: redemptionId,
            type: LoyaltyLedgerEntryType.BONUS,
          });
        }
        const account = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId } });
        expect(account.pointsBalance).toBe(15_000);
      } finally {
        await prisma.$executeRawUnsafe(
          'CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_ledger_entries_account_reference_kind_key" ON "loyalty_ledger_entries"("account_id", "reference_type", "reference_id", "type")',
        );
      }
    });

    it('does not constrain rows that carry no reference id', async () => {
      if (!databaseAvailable) return;
      const userId = await aUser();
      await loyalty.awardPoints({ userId, points: 100, reason: 'One' });
      await loyalty.awardPoints({ userId, points: 100, reason: 'Two' });

      // Operations adjustments and redemptions carry a null reference id, and
      // Postgres treats nulls in a unique tuple as distinct. Any number coexist.
      const account = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId } });
      expect(account.pointsBalance).toBe(200);
    });
  });

  /* ------------------------------------------------------------------ *
   * F5 — reversal takes back the points that were granted.
   * ------------------------------------------------------------------ */

  describe('points reversal', () => {
    it('reverses the points actually awarded, not a figure recomputed at today rate', async () => {
      if (!databaseAvailable) return;
      const userId = await aUser();
      const redemptionId = randomUUID();
      // Granted when a naira was 200 points: ₦150 bought 30,000.
      await loyalty.awardPoints({
        userId,
        points: 30_000,
        reason: 'Referral reward',
        referenceType: 'REFERRER_REWARD',
        referenceId: redemptionId,
        type: LoyaltyLedgerEntryType.BONUS,
      });

      const result = await loyalty.reversePointsFor({
        userId,
        referenceType: 'REFERRER_REWARD',
        referenceId: redemptionId,
        reason: 'Referral reward reversed',
      });

      // 30,000, read back from the ledger. Recomputing ₦150 at today's 100:1
      // would have clawed back 15,000 and left the promoter 15,000 up.
      expect(result.reversed).toBe(30_000);
    });

    it('reverses once — a replayed reversal takes nothing more', async () => {
      if (!databaseAvailable) return;
      const userId = await aUser();
      const redemptionId = randomUUID();
      await loyalty.awardPoints({
        userId,
        points: 15_000,
        reason: 'Referral reward',
        referenceType: 'REFERRER_REWARD',
        referenceId: redemptionId,
        type: LoyaltyLedgerEntryType.BONUS,
      });
      await loyalty.awardPoints({
        userId,
        points: 5_000,
        reason: 'Unrelated bonus',
        referenceType: 'ACHIEVEMENT',
        referenceId: randomUUID(),
        type: LoyaltyLedgerEntryType.BONUS,
      });

      const first = await loyalty.reversePointsFor({
        userId,
        referenceType: 'REFERRER_REWARD',
        referenceId: redemptionId,
        reason: 'Reversed',
      });
      const second = await loyalty.reversePointsFor({
        userId,
        referenceType: 'REFERRER_REWARD',
        referenceId: redemptionId,
        reason: 'Reversed',
      });

      expect(first.reversed).toBe(15_000);
      expect(second.reversed).toBe(0);
      // The unrelated award is untouched — reversal is keyed, not a sweep.
      const account = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId } });
      expect(account.pointsBalance).toBe(5_000);
    });

    it('reports a shortfall rather than forcing a balance negative', async () => {
      if (!databaseAvailable) return;
      const userId = await aUser();
      const redemptionId = randomUUID();
      await loyalty.awardPoints({
        userId,
        points: 15_000,
        reason: 'Referral reward',
        referenceType: 'REFERRER_REWARD',
        referenceId: redemptionId,
        type: LoyaltyLedgerEntryType.BONUS,
      });
      // Spent most of it before anybody looked.
      const account = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId } });
      await prisma.loyaltyAccount.update({
        where: { id: account.id },
        data: { pointsBalance: 4_000 },
      });

      const result = await loyalty.reversePointsFor({
        userId,
        referenceType: 'REFERRER_REWARD',
        referenceId: redemptionId,
        reason: 'Reversed',
      });

      expect(result).toEqual({ reversed: 4_000, shortfall: 11_000 });
      const after = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId } });
      expect(after.pointsBalance).toBe(0);
    });
  });

  /* ------------------------------------------------------------------ *
   * O — the canonical rate really is the only one.
   * ------------------------------------------------------------------ */

  it('holds the ruled 100:1 rate in the canonical setting row', async () => {
    if (!databaseAvailable) return;
    const setting = await prisma.loyaltySetting.findUnique({ where: { id: LOYALTY_SETTING_ID } });
    expect(setting?.pointsPerNaira).toBe(100);
    expect(setting?.minRedemptionPoints).toBe(100);
  });
});
