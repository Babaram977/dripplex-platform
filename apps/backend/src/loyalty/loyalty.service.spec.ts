import { LoyaltyTier } from '@prisma/client';

import { ValidationDomainException } from '../common/exceptions/domain.exception';

import { type LoyaltySettingsService } from './loyalty-settings.service';
import { LOYALTY_REFERENCE_TYPES } from './loyalty.constants';
import { LoyaltyService } from './loyalty.service';

import type { AuditService } from '../audit/audit.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { WalletService } from '../wallet/wallet.service';
import type { LoyaltyAccount } from '@prisma/client';

const now = new Date('2026-07-21T12:00:00.000Z');
const userId = '11111111-1111-4111-8111-111111111111';
const accountId = '22222222-2222-4222-8222-222222222222';
const walletId = '99999999-9999-4999-8999-999999999999';
const redemptionEntryId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

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
    aggregate: jest.Mock;
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
  let walletService: { creditWithin: jest.Mock; publishCredit: jest.Mock };
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
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { points: null } }),
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
    walletService = {
      creditWithin: jest.fn().mockResolvedValue({
        wallet: { id: walletId, availableBalance: 3, ownerId: userId },
        ledgerId: '88888888-8888-4888-8888-888888888888',
        applied: true,
      }),
      publishCredit: jest.fn().mockResolvedValue(undefined),
    };
    service = new LoyaltyService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
      walletService as unknown as WalletService,
      {
        // The seeded defaults, stated here because this suite has no database
        // to read the real row from. They are the figures that shipped.
        getEffective: jest.fn().mockResolvedValue({
          pointsPerNaira: 200,
          walletRedemptionEnabled: true,
          storeRedemptionEnabled: true,
          minRedemptionPoints: 200,
          dailyRedemptionPointsCap: null,
        }),
      } as unknown as LoyaltySettingsService,
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

  it('redeems points into the wallet at 200 points to the naira', async () => {
    const before = account({ pointsBalance: 500, lifetimePoints: 500 });
    const after = account({ pointsBalance: 100, lifetimePoints: 500 });
    prisma.loyaltyAccount.upsert.mockResolvedValueOnce(before).mockResolvedValueOnce(after);
    prisma.loyaltyAccount.update.mockResolvedValue(after);
    prisma.loyaltyLedgerEntry.create.mockResolvedValue({
      id: redemptionEntryId,
      accountId,
      points: -400,
      createdAt: now,
      expiresAt: null,
    });
    prisma.userAchievement.findMany.mockResolvedValue([]);

    const result = await service.redeemPoints(userId, 400);

    expect(prisma.loyaltyLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ points: -400, referenceType: 'REDEMPTION' }),
    });
    // 400 points is NGN 2 — the whole point of the change: redemption used to
    // burn the points and pay nothing at all.
    expect(walletService.creditWithin).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        ownerType: 'CUSTOMER',
        ownerId: userId,
        amount: 2,
        referenceType: 'LOYALTY_REDEMPTION',
        referenceId: redemptionEntryId,
      }),
    );
    expect(result.amountCredited).toBe(2);
    expect(result.pointsRedeemed).toBe(400);
    expect(result.overview.account.pointsBalance).toBe(100);
  });

  it('burns the points and pays in one transaction', async () => {
    const before = account({ pointsBalance: 500, lifetimePoints: 500 });
    prisma.loyaltyAccount.upsert.mockResolvedValue(before);
    prisma.loyaltyAccount.update.mockResolvedValue(account({ pointsBalance: 100 }));
    prisma.loyaltyLedgerEntry.create.mockResolvedValue({
      id: redemptionEntryId,
      accountId,
      points: -400,
      createdAt: now,
      expiresAt: null,
    });
    prisma.userAchievement.findMany.mockResolvedValue([]);
    // If the wallet refuses, the whole transaction must fail — points that are
    // taken without being paid for are the bug this replaced.
    walletService.creditWithin.mockRejectedValue(new Error('wallet unavailable'));

    await expect(service.redeemPoints(userId, 400)).rejects.toThrow('wallet unavailable');
    expect(walletService.publishCredit).not.toHaveBeenCalled();
  });

  it('announces the credit only after the transaction commits', async () => {
    const order: string[] = [];
    prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const value = await callback(prisma);
      order.push('commit');
      return value;
    });
    walletService.publishCredit.mockImplementation(() => {
      order.push('publish');
      return Promise.resolve();
    });
    prisma.loyaltyAccount.upsert.mockResolvedValue(account({ pointsBalance: 500 }));
    prisma.loyaltyAccount.update.mockResolvedValue(account({ pointsBalance: 300 }));
    prisma.loyaltyLedgerEntry.create.mockResolvedValue({
      id: redemptionEntryId,
      accountId,
      points: -200,
      createdAt: now,
      expiresAt: null,
    });
    prisma.userAchievement.findMany.mockResolvedValue([]);

    await service.redeemPoints(userId, 200);

    expect(order).toEqual(['commit', 'publish']);
  });

  it('rejects redemptions that are not whole naira', async () => {
    prisma.loyaltyAccount.upsert.mockResolvedValue(account({ pointsBalance: 5_000 }));

    // 250 points is NGN 1.25; paying NGN 1 would quietly keep 50 points.
    await expect(service.redeemPoints(userId, 250)).rejects.toBeInstanceOf(
      ValidationDomainException,
    );
    expect(walletService.creditWithin).not.toHaveBeenCalled();
  });

  it('rejects redemption when points are insufficient', async () => {
    prisma.loyaltyAccount.upsert.mockResolvedValue(account({ pointsBalance: 10 }));

    await expect(service.redeemPoints(userId, 200)).rejects.toBeInstanceOf(
      ValidationDomainException,
    );
    expect(walletService.creditWithin).not.toHaveBeenCalled();
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
      {
        id: '55555555-5555-4555-8555-555555555555',
        accountId,
        points: 100,
        createdAt: now,
        expiresAt: new Date('2026-07-20T00:00:00.000Z'),
        account: account(),
      },
    ]);
    prisma.loyaltyLedgerEntry.count.mockResolvedValue(1);

    await expect(service.expirePoints(now)).resolves.toEqual({ expiredPoints: 0 });
  });

  it('expires nothing from an award the customer already spent', async () => {
    // The regression this rewrite exists for. January's 100 points were spent
    // in full; the 100 the account still holds are June's and are not due for
    // another five months. The old code expired min(100, 100) and wiped them.
    const january = {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      accountId,
      points: 100,
      reason: 'Order paid',
      referenceType: null,
      referenceId: null,
      createdAt: new Date('2026-01-05T00:00:00.000Z'),
      expiresAt: new Date('2026-07-20T00:00:00.000Z'),
    };
    const june = {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      accountId,
      points: 100,
      reason: 'Order paid',
      referenceType: null,
      referenceId: null,
      createdAt: new Date('2026-06-05T00:00:00.000Z'),
      expiresAt: new Date('2027-06-05T00:00:00.000Z'),
    };
    const spent = {
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      accountId,
      points: -100,
      reason: 'Redeemed',
      referenceType: 'REDEMPTION',
      referenceId: null,
      createdAt: new Date('2026-06-20T00:00:00.000Z'),
      expiresAt: null,
    };
    prisma.loyaltyLedgerEntry.findMany
      .mockResolvedValueOnce([{ ...january, account: account({ pointsBalance: 100 }) }])
      .mockResolvedValueOnce([january, june, spent]);
    prisma.loyaltyLedgerEntry.count.mockResolvedValue(0);
    prisma.loyaltyAccount.findUnique.mockResolvedValue(account({ pointsBalance: 100 }));

    await expect(service.expirePoints(now)).resolves.toEqual({ expiredPoints: 0 });
    expect(prisma.loyaltyAccount.update).not.toHaveBeenCalled();
  });

  it('reports what a balance is worth and which benefit lines it meets', async () => {
    prisma.loyaltyAccount.upsert.mockResolvedValue(
      account({ pointsBalance: 10_450, lifetimePoints: 12_000 }),
    );
    prisma.userAchievement.findMany.mockResolvedValue([]);
    prisma.loyaltyLedgerEntry.findMany.mockResolvedValue([
      {
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        points: 10_450,
        createdAt: new Date('2026-07-02T00:00:00.000Z'),
        expiresAt: new Date('2027-07-02T00:00:00.000Z'),
      },
    ]);
    prisma.loyaltyLedgerEntry.aggregate.mockResolvedValue({ _sum: { points: 10_450 } });

    const { points } = await service.getCustomerOverview(userId);

    expect(points.pointsPerNaira).toBe(200);
    // 10,450 points is NGN 52.25 — NGN 52 payable, 50 points short of the next
    // whole naira, so 10,400 is what can actually be redeemed.
    expect(points.balanceValue).toBe(52);
    expect(points.redeemablePoints).toBe(10_400);
    expect(points.benefits.deliveryFeeDiscount).toEqual({
      threshold: 10_000,
      eligible: true,
      pointsToGo: 0,
    });
    expect(points.benefits.monthlyElite).toEqual({
      threshold: 50_000,
      eligible: false,
      pointsToGo: 39_550,
    });
    expect(points.nextExpiry).toEqual({
      at: '2027-07-02T00:00:00.000Z',
      points: 10_450,
    });
  });

  it('counts this month from midnight in Lagos, not UTC', async () => {
    prisma.loyaltyAccount.upsert.mockResolvedValue(account({ pointsBalance: 0 }));
    prisma.userAchievement.findMany.mockResolvedValue([]);

    // 2026-08-01T00:30Z is still 01:30 on 1 August in Lagos, so the month
    // starts at 23:00 UTC on 31 July — an hour earlier than the UTC boundary.
    await service.getPointsSummary(
      account() as unknown as LoyaltyAccount,
      new Date('2026-08-01T00:30:00.000Z'),
    );

    expect(prisma.loyaltyLedgerEntry.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gte: new Date('2026-07-31T23:00:00.000Z') },
        }),
      }),
    );
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
