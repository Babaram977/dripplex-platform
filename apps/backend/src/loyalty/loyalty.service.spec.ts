import { LoyaltyTier } from '@prisma/client';

import { ValidationDomainException } from '../common/exceptions/domain.exception';

import { LOYALTY_REFERENCE_TYPES } from './loyalty.constants';
import { LoyaltyService } from './loyalty.service';

import type { AuditService } from '../audit/audit.service';
import type { PrismaService } from '../prisma/prisma.service';

const now = new Date('2026-07-21T12:00:00.000Z');
const userId = '11111111-1111-4111-8111-111111111111';
const accountId = '22222222-2222-4222-8222-222222222222';

interface LoyaltyPrismaMock {
  loyaltyAccount: {
    upsert: jest.Mock;
    update: jest.Mock;
    findUnique: jest.Mock;
  };
  loyaltyLedgerEntry: {
    create: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
  };
  userAchievement: {
    findMany: jest.Mock;
    create: jest.Mock;
  };
  loyaltyAchievement: {
    findMany: jest.Mock;
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  $transaction: jest.Mock;
}

function account(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: accountId,
    userId,
    pointsBalance: 0,
    lifetimePoints: 0,
    tier: LoyaltyTier.BRONZE,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function achievement(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    code: 'POINTS_1000',
    name: '1k Club',
    description: null,
    pointsReward: 25,
    active: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

describe('LoyaltyService', () => {
  let prisma: LoyaltyPrismaMock;
  let auditService: { record: jest.Mock };
  let service: LoyaltyService;

  beforeEach(() => {
    prisma = {
      loyaltyAccount: {
        upsert: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      loyaltyLedgerEntry: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      userAchievement: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      loyaltyAchievement: {
        findMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(
        async (callback: (tx: LoyaltyPrismaMock) => Promise<unknown>) => await callback(prisma),
      ),
    };
    auditService = { record: jest.fn().mockResolvedValue(undefined) };
    service = new LoyaltyService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
    );
  });

  it.each([
    [0, LoyaltyTier.BRONZE],
    [999, LoyaltyTier.BRONZE],
    [1_000, LoyaltyTier.SILVER],
    [5_000, LoyaltyTier.GOLD],
    [15_000, LoyaltyTier.PLATINUM],
    [50_000, LoyaltyTier.VIP],
  ])('calculates tier for %i lifetime points', (points, tier) => {
    expect(service.calculateTier(points)).toBe(tier);
  });

  it('ensures an account on first use', async () => {
    prisma.loyaltyAccount.upsert.mockResolvedValue(account());

    await expect(service.ensureAccount(userId)).resolves.toEqual(account());

    expect(prisma.loyaltyAccount.upsert).toHaveBeenCalledWith({
      where: { userId },
      update: { deletedAt: null },
      create: { userId },
    });
  });

  it('awards points with a positive ledger entry and tier update', async () => {
    const before = account({ pointsBalance: 975, lifetimePoints: 975 });
    const after = account({
      pointsBalance: 1_025,
      lifetimePoints: 1_025,
      tier: LoyaltyTier.SILVER,
    });
    prisma.loyaltyAccount.upsert.mockResolvedValueOnce(before).mockResolvedValueOnce(after);
    prisma.loyaltyAccount.update.mockResolvedValue(after);
    prisma.loyaltyAccount.findUnique.mockResolvedValue(after);
    prisma.loyaltyAchievement.findMany.mockResolvedValue([]);
    prisma.userAchievement.findMany.mockResolvedValue([]);

    const result = await service.awardPoints({
      userId,
      points: 50,
      reason: 'Order paid',
      referenceType: LOYALTY_REFERENCE_TYPES.ORDER,
      referenceId: '44444444-4444-4444-8444-444444444444',
    });

    expect(prisma.loyaltyLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ accountId, points: 50, reason: 'Order paid' }),
    });
    expect(prisma.loyaltyAccount.update).toHaveBeenCalledWith({
      where: { id: accountId },
      data: expect.objectContaining({ tier: LoyaltyTier.SILVER }),
    });
    expect(result.account.pointsBalance).toBe(1_025);
  });

  it('rejects non-positive awards', async () => {
    await expect(service.awardPoints({ userId, points: 0, reason: 'bad' })).rejects.toBeInstanceOf(
      ValidationDomainException,
    );
  });

  it('redeems points with a negative ledger entry', async () => {
    const before = account({ pointsBalance: 500, lifetimePoints: 500 });
    const after = account({ pointsBalance: 300, lifetimePoints: 500 });
    prisma.loyaltyAccount.upsert.mockResolvedValueOnce(before).mockResolvedValueOnce(after);
    prisma.loyaltyAccount.update.mockResolvedValue(after);
    prisma.userAchievement.findMany.mockResolvedValue([]);

    const result = await service.redeemPoints(userId, 200);

    expect(prisma.loyaltyLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ points: -200, referenceType: 'REDEMPTION' }),
    });
    expect(result.account.pointsBalance).toBe(300);
  });

  it('rejects redemption when points are insufficient', async () => {
    prisma.loyaltyAccount.upsert.mockResolvedValue(account({ pointsBalance: 10 }));

    await expect(service.redeemPoints(userId, 25)).rejects.toBeInstanceOf(
      ValidationDomainException,
    );
  });

  it('expires due points once and caps at account balance', async () => {
    const expiredEntry = {
      id: '55555555-5555-4555-8555-555555555555',
      accountId,
      points: 100,
      reason: 'Old award',
      referenceType: null,
      referenceId: null,
      expiresAt: new Date('2026-07-20T00:00:00.000Z'),
      createdAt: now,
      account: account({ pointsBalance: 40 }),
    };
    prisma.loyaltyLedgerEntry.findMany.mockResolvedValue([expiredEntry]);
    prisma.loyaltyLedgerEntry.count.mockResolvedValue(0);
    prisma.loyaltyAccount.findUnique.mockResolvedValue(account({ pointsBalance: 40 }));

    const result = await service.expirePoints(now);

    expect(result.expiredPoints).toBe(40);
    expect(prisma.loyaltyAccount.update).toHaveBeenCalledWith({
      where: { id: accountId },
      data: { pointsBalance: { decrement: 40 } },
    });
  });

  it('skips entries that already have expiration ledgers', async () => {
    prisma.loyaltyLedgerEntry.findMany.mockResolvedValue([
      { id: '55555555-5555-4555-8555-555555555555', accountId, points: 100, account: account() },
    ]);
    prisma.loyaltyLedgerEntry.count.mockResolvedValue(1);

    await expect(service.expirePoints(now)).resolves.toEqual({ expiredPoints: 0 });
  });

  it('lists history with pagination metadata', async () => {
    prisma.loyaltyAccount.upsert.mockResolvedValue(account());
    prisma.loyaltyLedgerEntry.findMany.mockResolvedValue([
      {
        id: '66666666-6666-4666-8666-666666666666',
        points: 50,
        reason: 'Order paid',
        referenceType: 'ORDER',
        referenceId: null,
        expiresAt: null,
        createdAt: now,
      },
    ]);
    prisma.loyaltyLedgerEntry.count.mockResolvedValue(21);

    const result = await service.listHistory(userId, 2, 10);

    expect(result.items).toHaveLength(1);
    expect(result.meta).toEqual({ page: 2, limit: 10, total: 21, totalPages: 3 });
  });

  it('creates achievements', async () => {
    prisma.loyaltyAchievement.create.mockResolvedValue(achievement());

    const result = await service.createAchievement({
      code: 'points_1000',
      name: '1k Club',
      pointsReward: 25,
      active: true,
    });

    expect(result.code).toBe('POINTS_1000');
    expect(auditService.record).toHaveBeenCalled();
  });

  it('updates achievements', async () => {
    prisma.loyaltyAchievement.findUnique.mockResolvedValue(achievement());
    prisma.loyaltyAchievement.update.mockResolvedValue(achievement({ active: false }));

    const result = await service.updateAchievement('33333333-3333-4333-8333-333333333333', {
      active: false,
    });

    expect(result.active).toBe(false);
  });

  it('soft deletes achievements', async () => {
    prisma.loyaltyAchievement.findUnique.mockResolvedValue(achievement());
    prisma.loyaltyAchievement.update.mockResolvedValue(achievement({ active: false }));

    await expect(
      service.deleteAchievement('33333333-3333-4333-8333-333333333333'),
    ).resolves.toEqual({ deleted: true });
  });

  it('awards milestone achievements when configured', async () => {
    const after = account({
      pointsBalance: 1_000,
      lifetimePoints: 1_000,
      tier: LoyaltyTier.SILVER,
    });
    prisma.loyaltyAccount.upsert
      .mockResolvedValueOnce(account())
      .mockResolvedValueOnce(after)
      .mockResolvedValueOnce(after);
    prisma.loyaltyAccount.update.mockResolvedValue(after);
    prisma.loyaltyAccount.findUnique.mockResolvedValue(after);
    prisma.loyaltyAchievement.findMany.mockResolvedValue([achievement()]);
    prisma.userAchievement.create.mockResolvedValue({
      id: '77777777-7777-4777-8777-777777777777',
      userId,
      achievementId: '33333333-3333-4333-8333-333333333333',
      earnedAt: now,
    });
    prisma.loyaltyLedgerEntry.count.mockResolvedValue(0);
    prisma.userAchievement.findMany.mockResolvedValue([]);

    await service.awardPoints({ userId, points: 1_000, reason: 'Bulk award' });

    expect(prisma.userAchievement.create).toHaveBeenCalled();
    expect(prisma.loyaltyLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        points: 25,
        referenceType: LOYALTY_REFERENCE_TYPES.ACHIEVEMENT,
      }),
    });
  });
});
