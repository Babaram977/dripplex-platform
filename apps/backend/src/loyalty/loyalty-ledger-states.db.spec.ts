import { randomUUID } from 'node:crypto';

import { LoyaltyLedgerEntryType, PrismaClient } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { DomainEventBus } from '../events/domain-event-bus';
import { WalletService } from '../wallet/wallet.service';

import { LoyaltySettingsService } from './loyalty-settings.service';
import { LOYALTY_REFERENCE_TYPES } from './loyalty.constants';
import { LoyaltyService } from './loyalty.service';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * DPX-LOYALTY-006 — the DX Points ledger, auditable by state.
 *
 * Nora's policy: EARNED / BONUS / REDEEMED / EXPIRED / REVERSED / ADJUSTED.
 * Before this the only thing separating one line from another was the sign of
 * `points` and a free-text reference type, so the questions an auditor actually
 * asks could only be answered by pattern-matching strings.
 */
describe('loyalty ledger states', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let loyalty: LoyaltyService;
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
    loyalty = new LoyaltyService(
      prisma,
      auditService,
      new WalletService(prisma, auditService, new DomainEventBus()),
      new LoyaltySettingsService(prisma, auditService),
    );
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

  async function holder(): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `ledger-states-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Holder',
      },
    });
    createdUserIds.push(user.id);
    return user.id;
  }

  async function entriesFor(
    userId: string,
  ): Promise<{ type: LoyaltyLedgerEntryType; points: number }[]> {
    return await prisma.loyaltyLedgerEntry.findMany({
      where: { account: { userId } },
      orderBy: { createdAt: 'asc' },
      select: { type: true, points: true },
    });
  }

  it('records an award as EARNED and a cash-out as REDEEMED', async () => {
    if (!databaseAvailable) return;
    const userId = await holder();

    await loyalty.awardPoints({ userId, points: 1000, reason: 'Order paid' });
    await loyalty.redeemPoints(userId, 400);

    expect(await entriesFor(userId)).toEqual([
      { type: LoyaltyLedgerEntryType.EARNED, points: 1000 },
      { type: LoyaltyLedgerEntryType.REDEEMED, points: -400 },
    ]);
  });

  it('separates points given from points earned', async () => {
    if (!databaseAvailable) return;
    // The distinction is what lets Operations tell the cost of the programme
    // working from the cost of promoting it.
    const userId = await holder();

    await loyalty.awardPoints({ userId, points: 200, reason: 'Order paid' });
    await loyalty.awardPoints({
      userId,
      points: 500,
      reason: 'Welcome sweetener',
      type: LoyaltyLedgerEntryType.BONUS,
    });

    const byType = await prisma.loyaltyLedgerEntry.groupBy({
      by: ['type'],
      where: { account: { userId } },
      _sum: { points: true },
    });
    expect(byType.find((row) => row.type === LoyaltyLedgerEntryType.EARNED)?._sum.points).toBe(200);
    expect(byType.find((row) => row.type === LoyaltyLedgerEntryType.BONUS)?._sum.points).toBe(500);
  });

  describe('adjustments', () => {
    it('records an Operations adjustment as its own state', async () => {
      if (!databaseAvailable) return;
      const userId = await holder();
      const adminId = await holder();

      const result = await loyalty.adjustPoints({
        userId,
        points: 750,
        reason: 'Goodwill after a failed delivery',
        adminUserId: adminId,
      });

      expect(result.applied).toBe(750);
      expect(await entriesFor(userId)).toEqual([
        { type: LoyaltyLedgerEntryType.ADJUSTED, points: 750 },
      ]);
    });

    it('never hands somebody a tier they did not earn', async () => {
      if (!databaseAvailable) return;
      // Lifetime points drive the tier. An apology must not promote anybody.
      const userId = await holder();
      const adminId = await holder();

      await loyalty.adjustPoints({
        userId,
        points: 60_000,
        reason: 'Apology',
        adminUserId: adminId,
      });

      const account = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId } });
      expect(account.pointsBalance).toBe(60_000);
      expect(account.lifetimePoints).toBe(0);
      expect(account.tier).toBe('BRONZE');
    });

    it('floors a negative adjustment at the balance rather than going negative', async () => {
      if (!databaseAvailable) return;
      // A loyalty balance is not a debt anybody agreed to, and the expiry
      // allocator assumes lots that sum to the balance.
      const userId = await holder();
      const adminId = await holder();
      await loyalty.awardPoints({ userId, points: 300, reason: 'Order paid' });

      const result = await loyalty.adjustPoints({
        userId,
        points: -1000,
        reason: 'Duplicate award',
        adminUserId: adminId,
      });

      expect(result.applied).toBe(-300);
      expect(result.balance).toBe(0);
    });

    it('refuses an adjustment with no reason and one of zero', async () => {
      if (!databaseAvailable) return;
      const userId = await holder();
      const adminId = await holder();

      await expect(
        loyalty.adjustPoints({ userId, points: 100, reason: '  ', adminUserId: adminId }),
      ).rejects.toThrow(/reason/i);
      await expect(
        loyalty.adjustPoints({ userId, points: 0, reason: 'Nothing', adminUserId: adminId }),
      ).rejects.toThrow(/whole number/i);
    });
  });

  describe('reversal', () => {
    it('takes back the points an undone order earned, as REVERSED not REDEEMED', async () => {
      if (!databaseAvailable) return;
      // The holder did not spend these. A statement saying they did would be
      // wrong, and the two are counted separately.
      const userId = await holder();
      const orderId = randomUUID();
      await loyalty.awardPoints({
        userId,
        points: 50,
        reason: 'Order paid',
        referenceType: LOYALTY_REFERENCE_TYPES.ORDER,
        referenceId: orderId,
      });

      const result = await loyalty.reversePointsFor({
        userId,
        referenceType: LOYALTY_REFERENCE_TYPES.ORDER,
        referenceId: orderId,
        reason: 'Order refunded',
      });

      expect(result).toEqual({ reversed: 50, shortfall: 0 });
      expect(await entriesFor(userId)).toEqual([
        { type: LoyaltyLedgerEntryType.EARNED, points: 50 },
        { type: LoyaltyLedgerEntryType.REVERSED, points: -50 },
      ]);
    });

    it('reverses once however often the refund is replayed', async () => {
      if (!databaseAvailable) return;
      // The holder earns from something else between the two attempts, which is
      // the case that matters: with the balance back above zero, only the
      // already-reversed guard stops the replay taking another 50 points that
      // this order never awarded. An account sitting at zero would pass this
      // whether the guard existed or not.
      const userId = await holder();
      const orderId = randomUUID();
      await loyalty.awardPoints({
        userId,
        points: 50,
        reason: 'Order paid',
        referenceType: LOYALTY_REFERENCE_TYPES.ORDER,
        referenceId: orderId,
      });

      const first = await loyalty.reversePointsFor({
        userId,
        referenceType: LOYALTY_REFERENCE_TYPES.ORDER,
        referenceId: orderId,
        reason: 'Order refunded',
      });
      expect(first.reversed).toBe(50);

      await loyalty.awardPoints({
        userId,
        points: 1000,
        reason: 'A later, unrelated order',
        referenceType: LOYALTY_REFERENCE_TYPES.ORDER,
        referenceId: randomUUID(),
      });

      const second = await loyalty.reversePointsFor({
        userId,
        referenceType: LOYALTY_REFERENCE_TYPES.ORDER,
        referenceId: orderId,
        reason: 'Order refunded',
      });

      expect(second.reversed).toBe(0);
      const account = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId } });
      expect(account.pointsBalance).toBe(1000);
    });

    it('reports a shortfall rather than pushing a spent balance negative', async () => {
      if (!databaseAvailable) return;
      // The real limit of clawing anything back after it has moved. Said out
      // loud rather than papered over.
      const userId = await holder();
      const orderId = randomUUID();
      await loyalty.awardPoints({
        userId,
        points: 1000,
        reason: 'Order paid',
        referenceType: LOYALTY_REFERENCE_TYPES.ORDER,
        referenceId: orderId,
      });
      await loyalty.redeemPoints(userId, 800);

      const result = await loyalty.reversePointsFor({
        userId,
        referenceType: LOYALTY_REFERENCE_TYPES.ORDER,
        referenceId: orderId,
        reason: 'Order refunded',
      });

      expect(result).toEqual({ reversed: 200, shortfall: 800 });
      const account = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId } });
      expect(account.pointsBalance).toBe(0);
    });

    it('does nothing for an order that never earned anything', async () => {
      if (!databaseAvailable) return;
      const userId = await holder();

      const result = await loyalty.reversePointsFor({
        userId,
        referenceType: LOYALTY_REFERENCE_TYPES.ORDER,
        referenceId: randomUUID(),
        reason: 'Order refunded',
      });

      expect(result).toEqual({ reversed: 0, shortfall: 0 });
    });
  });
});
