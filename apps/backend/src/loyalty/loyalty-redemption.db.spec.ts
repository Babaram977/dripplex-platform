import { randomUUID } from 'node:crypto';

import { PrismaClient, WalletOwnerType } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { DomainEventBus } from '../events/domain-event-bus';
import { WalletService } from '../wallet/wallet.service';

import { LoyaltySettingsService } from './loyalty-settings.service';
import { LoyaltyService } from './loyalty.service';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * Redemption against a real database, because redemption moves money.
 *
 * The unit spec proves the service calls the wallet; only Postgres proves the
 * two ledgers actually end up agreeing — that the points debit and the naira
 * credit commit together, that the balances land where they should, and that
 * the unique index behind the idempotency key is really there. The unit spec
 * would pass just as happily against a wallet mock that never wrote anything.
 */
describe('Loyalty redemption (database)', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: LoyaltyService;
  let walletService: WalletService;
  let userId: string;
  const createdUserIds: string[] = [];

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
    const auditService = new AuditService(auditLogRepository);
    walletService = new WalletService(prisma, auditService, new DomainEventBus());
    service = new LoyaltyService(
      prisma,
      auditService,
      walletService,
      new LoyaltySettingsService(prisma, auditService),
    );

    const user = await prisma.user.create({
      data: {
        email: `loyalty-redemption-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Customer',
      },
    });
    userId = user.id;
    createdUserIds.push(userId);
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.loyaltyLedgerEntry.deleteMany({
        where: { account: { userId: { in: createdUserIds } } },
      });
      await prisma.loyaltyAccount.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.walletLedgerEntry.deleteMany({
        where: { wallet: { ownerId: { in: createdUserIds } } },
      });
      await prisma.wallet.deleteMany({ where: { ownerId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  it('moves points out and naira in, in agreement', async () => {
    if (!databaseAvailable) return;

    await service.awardPoints({ userId, points: 5_000, reason: 'Seeded for redemption test' });

    const result = await service.redeemPoints(userId, 4_000);

    // 4,000 points at 200 to the naira is NGN 20.
    expect(result.amountCredited).toBe(20);
    expect(result.overview.account.pointsBalance).toBe(1_000);

    const wallet = await prisma.wallet.findFirstOrThrow({
      where: { ownerType: WalletOwnerType.CUSTOMER, ownerId: userId },
    });
    expect(Number(wallet.availableBalance)).toBe(20);

    const credit = await prisma.walletLedgerEntry.findFirstOrThrow({
      where: { walletId: wallet.id, referenceType: 'LOYALTY_REDEMPTION' },
    });
    expect(Number(credit.amount)).toBe(20);

    // The wallet credit points back at the loyalty ledger row that paid for it,
    // so either ledger can be audited against the other.
    const debit = await prisma.loyaltyLedgerEntry.findUniqueOrThrow({
      where: { id: credit.referenceId ?? '' },
    });
    expect(debit.points).toBe(-4_000);
  });

  it('refuses a redemption the balance cannot cover, and takes nothing', async () => {
    if (!databaseAvailable) return;

    const before = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId } });
    const walletBefore = await prisma.wallet.findFirstOrThrow({
      where: { ownerType: WalletOwnerType.CUSTOMER, ownerId: userId },
    });

    await expect(service.redeemPoints(userId, 100_000)).rejects.toThrow(
      'Insufficient loyalty points',
    );

    const after = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId } });
    const walletAfter = await prisma.wallet.findFirstOrThrow({
      where: { ownerType: WalletOwnerType.CUSTOMER, ownerId: userId },
    });
    expect(after.pointsBalance).toBe(before.pointsBalance);
    expect(Number(walletAfter.availableBalance)).toBe(Number(walletBefore.availableBalance));
  });

  it('pays a given redemption only once', async () => {
    if (!databaseAvailable) return;

    const wallet = await prisma.wallet.findFirstOrThrow({
      where: { ownerType: WalletOwnerType.CUSTOMER, ownerId: userId },
    });
    const redemption = await prisma.loyaltyLedgerEntry.findFirstOrThrow({
      where: { account: { userId }, referenceType: 'REDEMPTION' },
    });
    const balanceBefore = Number(wallet.availableBalance);

    // A retry that reaches the wallet a second time with the same reference —
    // a webhook replay, a client resubmit — must not pay twice.
    const replay = await walletService.credit({
      ownerType: WalletOwnerType.CUSTOMER,
      ownerId: userId,
      amount: 20,
      referenceType: 'LOYALTY_REDEMPTION',
      referenceId: redemption.id,
    });

    expect(replay.availableBalance).toBe(balanceBefore);
    const credits = await prisma.walletLedgerEntry.count({
      where: { walletId: wallet.id, referenceType: 'LOYALTY_REDEMPTION' },
    });
    expect(credits).toBe(1);
  });

  it('expires nothing from an award the customer already spent', async () => {
    if (!databaseAvailable) return;

    // A second customer, so the arithmetic is not confused by the redemption
    // above. Two awards: an old one that has since been spent in full, and a
    // newer one that has not. Only the old one is due.
    const other = await prisma.user.create({
      data: {
        email: `loyalty-expiry-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Customer',
      },
    });
    createdUserIds.push(other.id);

    await service.awardPoints({ userId: other.id, points: 400, reason: 'Old award' });
    const account = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: other.id } });
    await prisma.loyaltyLedgerEntry.updateMany({
      where: { accountId: account.id, points: { gt: 0 } },
      data: {
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        expiresAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    });

    await service.awardPoints({ userId: other.id, points: 400, reason: 'Recent award' });
    // Spends the old award in full — oldest first.
    await service.redeemPoints(other.id, 400);

    const { expiredPoints } = await service.expirePoints(new Date());

    // The 400 still on the balance are the recent award's and are not due for
    // another year. The old arithmetic took min(400, 400) and wiped them.
    expect(expiredPoints).toBe(0);
    const after = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId: other.id } });
    expect(after.pointsBalance).toBe(400);
  });
});
