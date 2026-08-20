import { randomUUID } from 'node:crypto';

import { PrismaClient, WalletOwnerType, WalletTransactionType } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { DomainEventBus } from '../events/domain-event-bus';

import { holdReferenceType, WalletService, type WalletMutationInput } from './wallet.service';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * Wallet holds, against a real Postgres.
 *
 * Mocks cannot test what matters here. Every invariant below is enforced by a
 * conditional UPDATE and a uniqueness constraint — a mocked `updateMany` that
 * returns `{count: 1}` proves nothing about whether the database would
 * actually have allowed it. These run against the real thing.
 *
 * What is being protected, in one line: money that is held is neither spent
 * nor spendable, and a hold ends exactly once.
 */
describe('WalletService holds', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: WalletService;
  const createdOwnerIds: string[] = [];

  const REF = 'hotel_booking';

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
    const auditLogRepository: jest.Mocked<AuditLogRepository> = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    service = new WalletService(prisma, new AuditService(auditLogRepository), new DomainEventBus());
  });

  afterAll(async () => {
    if (databaseAvailable && createdOwnerIds.length > 0) {
      await prisma.wallet
        .deleteMany({ where: { ownerId: { in: createdOwnerIds } } })
        .catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  /** A funded wallet. The credit goes through the real service so the ledger
   *  and the balance agree the way they would in production. */
  const funded = async (amount: number): Promise<string> => {
    const ownerId = randomUUID();
    createdOwnerIds.push(ownerId);
    await service.credit({
      ownerType: WalletOwnerType.CUSTOMER,
      ownerId,
      amount,
      description: 'Test funding',
      referenceType: 'test_funding',
      referenceId: ownerId,
    });
    return ownerId;
  };

  /** One hold, described once. Annotated as WalletMutationInput so
   *  `ownerType` keeps its enum type instead of widening to string —
   *  `WalletOwnerType.CUSTOMER as const` is not a legal const assertion,
   *  because Prisma generates that enum as a plain object. */
  const holdOf = (ownerId: string, referenceId: string, amount = 4_000): WalletMutationInput => ({
    ownerType: WalletOwnerType.CUSTOMER,
    ownerId,
    amount,
    referenceType: REF,
    referenceId,
  });

  const balances = async (ownerId: string): Promise<{ available: number; pending: number }> => {
    const wallet = await prisma.wallet.findFirstOrThrow({
      where: { ownerType: WalletOwnerType.CUSTOMER, ownerId },
    });
    return {
      available: Number(wallet.availableBalance),
      pending: Number(wallet.pendingBalance),
    };
  };

  it('moves money out of reach without taking it', async () => {
    if (!databaseAvailable) return;
    const ownerId = await funded(10_000);
    const bookingId = randomUUID();

    await service.hold({
      ownerType: WalletOwnerType.CUSTOMER,
      ownerId,
      amount: 4_000,
      description: 'Held while the hotel confirms',
      referenceType: REF,
      referenceId: bookingId,
    });

    // Gone from spendable, but still the customer's — the total is unchanged.
    const after = await balances(ownerId);
    expect(after.available).toBe(6_000);
    expect(after.pending).toBe(4_000);
    expect(after.available + after.pending).toBe(10_000);
  });

  it('takes the money on commit, and the total finally falls', async () => {
    if (!databaseAvailable) return;
    const ownerId = await funded(10_000);
    const bookingId = randomUUID();
    const hold = holdOf(ownerId, bookingId);

    await service.hold(hold);
    await service.commitHold(hold);

    const after = await balances(ownerId);
    // Available did not move on commit — the hold already reduced it.
    expect(after.available).toBe(6_000);
    expect(after.pending).toBe(0);
  });

  it('gives the money back on release, leaving the wallet where it started', async () => {
    if (!databaseAvailable) return;
    const ownerId = await funded(10_000);
    const bookingId = randomUUID();
    const hold = holdOf(ownerId, bookingId);

    await service.hold(hold);
    await service.releaseHold(hold);

    const after = await balances(ownerId);
    expect(after.available).toBe(10_000);
    expect(after.pending).toBe(0);
  });

  it('cannot promise the same money twice', async () => {
    if (!databaseAvailable) return;
    const ownerId = await funded(10_000);

    await service.hold({
      ownerType: WalletOwnerType.CUSTOMER,
      ownerId,
      amount: 7_000,
      referenceType: REF,
      referenceId: randomUUID(),
    });

    // The first hold reduced the spendable balance, so the second finds
    // insufficient funds — exactly as a second debit would. This is the
    // whole reason a hold takes money out of `availableBalance` immediately.
    await expect(
      service.hold({
        ownerType: WalletOwnerType.CUSTOMER,
        ownerId,
        amount: 7_000,
        referenceType: REF,
        referenceId: randomUUID(),
      }),
    ).rejects.toThrow(/Insufficient/i);

    const after = await balances(ownerId);
    expect(after.available).toBe(3_000);
    expect(after.pending).toBe(7_000);
  });

  it('holds once however many times the request arrives', async () => {
    if (!databaseAvailable) return;
    const ownerId = await funded(10_000);
    const hold = holdOf(ownerId, randomUUID());

    await service.hold(hold);
    await service.hold(hold);
    await service.hold(hold);

    // A retried request on a weak connection must not hold three times.
    const after = await balances(ownerId);
    expect(after.available).toBe(6_000);
    expect(after.pending).toBe(4_000);
  });

  it('commits once however many times the request arrives', async () => {
    if (!databaseAvailable) return;
    const ownerId = await funded(10_000);
    const hold = holdOf(ownerId, randomUUID());

    await service.hold(hold);
    await service.commitHold(hold);
    await service.commitHold(hold);

    const after = await balances(ownerId);
    expect(after.available).toBe(6_000);
    expect(after.pending).toBe(0);
  });

  // ── The invariant that loses money if it breaks ───────────────────────────

  it('refuses to commit a hold that was already released', async () => {
    if (!databaseAvailable) return;
    const ownerId = await funded(10_000);
    const hold = holdOf(ownerId, randomUUID());

    await service.hold(hold);
    await service.releaseHold(hold);

    // The hotel accepting after the expiry sweep already returned the money.
    // Committing here would charge for a booking that was cancelled.
    await expect(service.commitHold(hold)).rejects.toThrow(/already released/i);
    const after = await balances(ownerId);
    expect(after.available).toBe(10_000);
    expect(after.pending).toBe(0);
  });

  it('refuses to release a hold that was already committed', async () => {
    if (!databaseAvailable) return;
    const ownerId = await funded(10_000);
    const hold = holdOf(ownerId, randomUUID());

    await service.hold(hold);
    await service.commitHold(hold);

    // The sweep firing after the hotel accepted. Releasing here would hand
    // back money that has already been paid to the hotel.
    await expect(service.releaseHold(hold)).rejects.toThrow(/already committed/i);
    const after = await balances(ownerId);
    expect(after.available).toBe(6_000);
    expect(after.pending).toBe(0);
  });

  it('lets exactly one of a simultaneous commit and release win', async () => {
    if (!databaseAvailable) return;
    const ownerId = await funded(10_000);
    const hold = holdOf(ownerId, randomUUID());
    await service.hold(hold);

    // The 29th-minute race: the hotel accepts at the same moment the expiry
    // sweep gives up. Both must not win.
    const outcomes = await Promise.allSettled([
      service.commitHold(hold),
      service.releaseHold(hold),
    ]);
    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);

    const after = await balances(ownerId);
    expect(after.pending).toBe(0);
    // Whichever won, the wallet is in one of the two legal end states and
    // never somewhere in between.
    expect([6_000, 10_000]).toContain(after.available);
  });

  it('will not settle an amount that does not match the hold', async () => {
    if (!databaseAvailable) return;
    const ownerId = await funded(10_000);
    const referenceId = randomUUID();
    await service.hold({
      ownerType: WalletOwnerType.CUSTOMER,
      ownerId,
      amount: 4_000,
      referenceType: REF,
      referenceId,
    });

    // Releasing more than was held would mint the difference out of nothing.
    await expect(
      service.releaseHold({
        ownerType: WalletOwnerType.CUSTOMER,
        ownerId,
        amount: 9_000,
        referenceType: REF,
        referenceId,
      }),
    ).rejects.toThrow(/does not match/i);
    expect((await balances(ownerId)).available).toBe(6_000);
  });

  it('refuses to settle a hold that never existed', async () => {
    if (!databaseAvailable) return;
    const ownerId = await funded(10_000);
    await expect(
      service.commitHold({
        ownerType: WalletOwnerType.CUSTOMER,
        ownerId,
        amount: 100,
        referenceType: REF,
        referenceId: randomUUID(),
      }),
    ).rejects.toThrow(/no hold/i);
  });

  it('refuses a hold with no reference, because it could never be ended', async () => {
    if (!databaseAvailable) return;
    const ownerId = await funded(10_000);
    await expect(
      service.hold({ ownerType: WalletOwnerType.CUSTOMER, ownerId, amount: 100 }),
    ).rejects.toThrow(/referenceType/i);
  });

  // Reconciliation sums the ledger and compares it to the spendable balance.
  // A HOLD debit already accounts for money leaving `availableBalance`; if
  // the HOLD_COMMIT entry were counted too, the same money would be debited
  // twice and every wallet that ever committed a hold would drift out of
  // balance permanently. Caught while building this — pinned here so it
  // cannot come back.
  it('still reconciles at every stage of a hold', async () => {
    if (!databaseAvailable) return;
    const ownerId = await funded(10_000);
    const hold = holdOf(ownerId, randomUUID());
    const check = async (): Promise<boolean> =>
      (await service.reconcileWallet(WalletOwnerType.CUSTOMER, ownerId)).reconciled;

    expect(await check()).toBe(true);
    await service.hold(hold);
    expect(await check()).toBe(true); // open hold: reduced available is the truth
    await service.commitHold(hold);
    expect(await check()).toBe(true); // committed: not debited twice
  });

  it('still reconciles when a hold is released instead', async () => {
    if (!databaseAvailable) return;
    const ownerId = await funded(10_000);
    const hold = holdOf(ownerId, randomUUID());
    await service.hold(hold);
    await service.releaseHold(hold);

    const result = await service.reconcileWallet(WalletOwnerType.CUSTOMER, ownerId);
    expect(result.reconciled).toBe(true);
    expect(result.availableBalance).toBe(10_000);
  });

  it('records all three legs on the ledger, distinctly', async () => {
    if (!databaseAvailable) return;
    const ownerId = await funded(10_000);
    const referenceId = randomUUID();
    const hold = holdOf(ownerId, referenceId);
    await service.hold(hold);
    await service.commitHold(hold);

    const wallet = await prisma.wallet.findFirstOrThrow({
      where: { ownerType: WalletOwnerType.CUSTOMER, ownerId },
    });
    const entries = await prisma.walletLedgerEntry.findMany({
      where: { walletId: wallet.id, referenceId },
      orderBy: { createdAt: 'asc' },
    });

    // Two legs, two distinct referenceTypes — they share a referenceId, so
    // without the suffixes the ledger's uniqueness constraint would have
    // rejected the second one.
    expect(entries.map((e) => e.type)).toEqual([
      WalletTransactionType.HOLD,
      WalletTransactionType.HOLD_COMMIT,
    ]);
    expect(entries.map((e) => e.referenceType)).toEqual([
      holdReferenceType(REF, 'HOLD'),
      holdReferenceType(REF, 'HOLD_COMMIT'),
    ]);
    // balanceAfter is the SPENDABLE balance on every row, so a statement
    // line means the same thing whatever produced it.
    expect(entries.map((e) => Number(e.balanceAfter))).toEqual([6_000, 6_000]);
  });
});
