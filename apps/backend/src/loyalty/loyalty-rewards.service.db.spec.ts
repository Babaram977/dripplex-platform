import { randomUUID } from 'node:crypto';

import { LoyaltyRedemptionStatus, LoyaltyRewardType, PrismaClient } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { DomainEventBus } from '../events/domain-event-bus';
import { WalletService } from '../wallet/wallet.service';

import { LoyaltyRewardsService } from './loyalty-rewards.service';
import { LoyaltySettingsService } from './loyalty-settings.service';
import { LoyaltyService } from './loyalty.service';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * The DX Points rewards catalogue, against a real database.
 *
 * Redemption spends something the holder earned over months, so the cases that
 * matter are the ones where it could go wrong: a redemption that fails must not
 * quietly consume points, a retry must not charge twice, and a gift with one
 * left must not be promised to two people. None of those can be checked against
 * a mock.
 */
describe('LoyaltyRewardsService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let rewards: LoyaltyRewardsService;
  let loyalty: LoyaltyService;
  let userId: string;
  const createdUserIds: string[] = [];
  const createdRewardIds: string[] = [];

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
    rewards = new LoyaltyRewardsService(prisma, auditService);
    loyalty = new LoyaltyService(
      prisma,
      auditService,
      new WalletService(prisma, auditService, new DomainEventBus()),
      new LoyaltySettingsService(prisma, auditService),
    );

    const user = await prisma.user.create({
      data: {
        email: `loyalty-rewards-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Holder',
      },
    });
    userId = user.id;
    createdUserIds.push(userId);
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.loyaltyRewardRedemption.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
      await prisma.loyaltyReward.deleteMany({ where: { id: { in: createdRewardIds } } });
      await prisma.loyaltyLedgerEntry.deleteMany({
        where: { account: { userId: { in: createdUserIds } } },
      });
      await prisma.loyaltyAccount.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    if (!databaseAvailable) return;
    await prisma.loyaltyRewardRedemption.deleteMany({ where: { userId } });
    await prisma.loyaltyLedgerEntry.deleteMany({ where: { account: { userId } } });
    await prisma.loyaltyAccount.deleteMany({ where: { userId } });
    await loyalty.awardPoints({ userId, points: 60_000, reason: 'Seeded' });
  });

  async function createReward(
    overrides: {
      pointsCost?: number;
      type?: LoyaltyRewardType;
      stockQuantity?: number | null;
      perUserLimit?: number | null;
      totalRedemptionLimit?: number | null;
      active?: boolean;
      entitlementDays?: number | null;
    } = {},
  ): Promise<string> {
    const reward = await prisma.loyaltyReward.create({
      data: {
        name: `Test reward ${randomUUID().slice(0, 8)}`,
        type: overrides.type ?? LoyaltyRewardType.FREE_DELIVERY,
        pointsCost: overrides.pointsCost ?? 10_000,
        stockQuantity: overrides.stockQuantity ?? null,
        perUserLimit: overrides.perUserLimit ?? null,
        totalRedemptionLimit: overrides.totalRedemptionLimit ?? null,
        entitlementDays: overrides.entitlementDays ?? null,
        active: overrides.active ?? true,
      },
    });
    createdRewardIds.push(reward.id);
    return reward.id;
  }

  it('ships a catalogue whose thresholds are points, not naira', async () => {
    if (!databaseAvailable) return;

    // The seeded opening catalogue the founder named: 10k / 25k / 50k.
    const seeded = await prisma.loyaltyReward.findMany({
      where: { id: { notIn: createdRewardIds.length > 0 ? createdRewardIds : [randomUUID()] } },
      orderBy: { pointsCost: 'asc' },
    });

    expect(seeded.map((reward) => reward.pointsCost)).toEqual([10_000, 25_000, 50_000]);
    // The 25,000-point coupon is worth NGN 500, not NGN 25,000 — the threshold
    // and the value are different numbers and must never be conflated.
    const coupon = seeded.find((reward) => reward.pointsCost === 25_000);
    expect(Number(coupon?.monetaryValue)).toBe(500);
  });

  it('spends the points and grants the entitlement together', async () => {
    if (!databaseAvailable) return;

    const rewardId = await createReward({ pointsCost: 10_000, entitlementDays: 90 });

    const redemption = await rewards.redeem(userId, rewardId, randomUUID());

    expect(redemption.pointsSpent).toBe(10_000);
    // A free delivery is granted the moment it is taken; nothing to post.
    expect(redemption.status).toBe(LoyaltyRedemptionStatus.FULFILLED);
    expect(redemption.expiresAt).not.toBeNull();

    const account = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId } });
    expect(account.pointsBalance).toBe(50_000);

    // The points that left are linked to the entitlement they bought.
    const entry = await prisma.loyaltyLedgerEntry.findFirstOrThrow({
      where: { account: { userId }, points: -10_000 },
    });
    expect(entry.referenceType).toBe('REWARD');
  });

  it('charges once however many times the same request arrives', async () => {
    if (!databaseAvailable) return;

    const rewardId = await createReward({ pointsCost: 10_000 });
    const key = randomUUID();

    const first = await rewards.redeem(userId, rewardId, key);
    const second = await rewards.redeem(userId, rewardId, key);
    const third = await rewards.redeem(userId, rewardId, key);

    expect(second.id).toBe(first.id);
    expect(third.id).toBe(first.id);

    const account = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId } });
    expect(account.pointsBalance).toBe(50_000);
  });

  it('takes nothing when the balance cannot cover the reward', async () => {
    if (!databaseAvailable) return;

    const rewardId = await createReward({ pointsCost: 100_000 });

    await expect(rewards.redeem(userId, rewardId, randomUUID())).rejects.toThrow('DX points');

    // The whole point of doing this in one transaction: a failed redemption
    // leaves the holder exactly as they were.
    const account = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId } });
    expect(account.pointsBalance).toBe(60_000);
    await expect(prisma.loyaltyRewardRedemption.count({ where: { userId } })).resolves.toBe(0);
  });

  it('never promises more of a reward than exists', async () => {
    if (!databaseAvailable) return;

    const rewardId = await createReward({ pointsCost: 10_000, stockQuantity: 1 });

    await rewards.redeem(userId, rewardId, randomUUID());
    await expect(rewards.redeem(userId, rewardId, randomUUID())).rejects.toThrow(
      /out of stock|just run out/,
    );

    const reward = await prisma.loyaltyReward.findUniqueOrThrow({ where: { id: rewardId } });
    expect(reward.stockQuantity).toBe(0);
    // And the refused attempt took no points.
    const account = await prisma.loyaltyAccount.findUniqueOrThrow({ where: { userId } });
    expect(account.pointsBalance).toBe(50_000);
  });

  it('holds a holder to the per-user limit', async () => {
    if (!databaseAvailable) return;

    const rewardId = await createReward({ pointsCost: 10_000, perUserLimit: 1 });

    await rewards.redeem(userId, rewardId, randomUUID());
    await expect(rewards.redeem(userId, rewardId, randomUUID())).rejects.toThrow(
      'as many times as it allows',
    );
  });

  it('puts a physical gift into fulfilment rather than calling it done', async () => {
    if (!databaseAvailable) return;

    const rewardId = await createReward({
      pointsCost: 50_000,
      type: LoyaltyRewardType.PHYSICAL_GIFT,
    });

    const redemption = await rewards.redeem(userId, rewardId, randomUUID());

    // Deducting and forgetting is how somebody ends up having paid 50,000
    // points for something nobody ever posted.
    expect(redemption.status).toBe(LoyaltyRedemptionStatus.FULFILMENT_PENDING);
    expect(redemption.fulfilledAt).toBeNull();

    const outstanding = await rewards.listOutstandingFulfilment(1, 50);
    expect(outstanding.items.some((item) => item.id === redemption.id)).toBe(true);
  });

  it('closes a gift only when it has actually reached somebody', async () => {
    if (!databaseAvailable) return;

    const rewardId = await createReward({
      pointsCost: 50_000,
      type: LoyaltyRewardType.PHYSICAL_GIFT,
    });
    const redemption = await rewards.redeem(userId, rewardId, randomUUID());

    await rewards.advanceFulfilment(
      redemption.id,
      LoyaltyRedemptionStatus.SHIPPED,
      'Handed to courier',
      userId,
    );
    const delivered = await rewards.advanceFulfilment(
      redemption.id,
      LoyaltyRedemptionStatus.DELIVERED,
      undefined,
      userId,
    );

    expect(delivered.fulfilledAt).not.toBeNull();
    const outstanding = await rewards.listOutstandingFulfilment(1, 50);
    expect(outstanding.items.some((item) => item.id === redemption.id)).toBe(false);
  });

  it('refuses a reward that is switched off', async () => {
    if (!databaseAvailable) return;

    const rewardId = await createReward({ pointsCost: 10_000, active: false });

    await expect(rewards.redeem(userId, rewardId, randomUUID())).rejects.toThrow(
      'no longer available',
    );
  });

  it('tells a holder what they can afford and what they are short of', async () => {
    if (!databaseAvailable) return;

    const affordable = await createReward({ pointsCost: 10_000 });
    const outOfReach = await createReward({ pointsCost: 90_000 });

    const catalogue = await rewards.catalogueFor(userId);
    const cheap = catalogue.find((reward) => reward.id === affordable);
    const dear = catalogue.find((reward) => reward.id === outOfReach);

    expect(cheap?.affordable).toBe(true);
    expect(cheap?.pointsToGo).toBe(0);
    expect(dear?.affordable).toBe(false);
    expect(dear?.pointsToGo).toBe(30_000);
  });

  it('requires an idempotency key', async () => {
    if (!databaseAvailable) return;

    const rewardId = await createReward({ pointsCost: 10_000 });

    await expect(rewards.redeem(userId, rewardId, '   ')).rejects.toThrow('idempotency key');
  });
});
