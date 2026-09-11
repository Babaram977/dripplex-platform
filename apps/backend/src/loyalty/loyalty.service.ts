import { Injectable } from '@nestjs/common';
import { LoyaltyTier, Prisma, WalletOwnerType } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService, type WalletDto } from '../wallet/wallet.service';

import {
  LOYALTY_AUDIT_ACTIONS,
  LOYALTY_BENEFIT_THRESHOLDS,
  LOYALTY_MILESTONE_ACHIEVEMENTS,
  LOYALTY_POINT_EXPIRY_DAYS,
  LOYALTY_POINTS_PER_NAIRA,
  LOYALTY_REFERENCE_TYPES,
  LOYALTY_TIER_THRESHOLDS,
  LOYALTY_WALLET_REFERENCE_TYPE,
} from './loyalty.constants';
import { allocatePointsLots, nextExpiry, remainingForLot, type PointsLot } from './points-lots';

import type { PaginatedResult } from '@dripplex/types';
import type {
  LoyaltyAccount,
  LoyaltyAchievement,
  LoyaltyLedgerEntry,
  UserAchievement,
} from '@prisma/client';

export interface LoyaltyAccountOverview {
  account: LoyaltyAccountDto;
  nextTier: { tier: LoyaltyTier; pointsRequired: number } | null;
  achievements: UserAchievementDto[];
  /** What the balance is worth, and what it takes to use it. */
  points: LoyaltyPointsSummary;
}

/**
 * The answer to "what are my DX points actually worth, and when do they go
 * away" — every number a customer needs to make sense of their balance,
 * derived from the ledger rather than restated by hand in the app.
 */
export interface LoyaltyPointsSummary {
  balance: number;
  /** Founder decision: 200 points = ₦1. */
  pointsPerNaira: number;
  /** Naira the current balance is worth, rounded down to whole naira. */
  balanceValue: number;
  /** The largest multiple of `pointsPerNaira` that can be redeemed now. */
  redeemablePoints: number;
  /** Smallest redemption the platform accepts — one naira's worth. */
  minimumRedeemablePoints: number;
  /** Points earned so far this calendar month, in Lagos time. */
  earnedThisMonth: number;
  /** The next award to fall due, and how much goes with it. */
  nextExpiry: { at: string; points: number } | null;
  benefits: LoyaltyBenefitStatus;
}

/**
 * Which founder-decided benefit lines the customer is on the right side of.
 *
 * The thresholds are policy and live in code; the size of each benefit is set
 * per campaign, so nothing here claims a discount percentage. `eligible` means
 * "qualifies" — whether a campaign is currently offering anything against that
 * line is the campaign's business, not the loyalty account's.
 */
export interface LoyaltyBenefitStatus {
  deliveryFeeDiscount: { threshold: number; eligible: boolean; pointsToGo: number };
  monthlyElite: { threshold: number; eligible: boolean; pointsToGo: number };
}

export interface LoyaltyRedemptionResult {
  overview: LoyaltyAccountOverview;
  pointsRedeemed: number;
  /** Naira credited to the customer's wallet. */
  amountCredited: number;
  wallet: WalletDto;
}

export interface LoyaltyAccountDto {
  id: string;
  userId: string;
  pointsBalance: number;
  lifetimePoints: number;
  tier: LoyaltyTier;
  createdAt: string;
  updatedAt: string;
}

export interface LoyaltyLedgerEntryDto {
  id: string;
  points: number;
  reason: string;
  referenceType: string | null;
  referenceId: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface LoyaltyAchievementDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  pointsReward: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserAchievementDto {
  id: string;
  earnedAt: string;
  achievement: LoyaltyAchievementDto;
}

export interface AwardPointsInput {
  userId: string;
  points: number;
  reason: string;
  referenceType?: string;
  referenceId?: string;
  expiresAt?: Date | null;
  context?: AuditContext;
}

@Injectable()
export class LoyaltyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly walletService: WalletService,
  ) {}

  public calculateTier(lifetimePoints: number): LoyaltyTier {
    if (lifetimePoints >= LOYALTY_TIER_THRESHOLDS[LoyaltyTier.VIP]) {
      return LoyaltyTier.VIP;
    }
    if (lifetimePoints >= LOYALTY_TIER_THRESHOLDS[LoyaltyTier.PLATINUM]) {
      return LoyaltyTier.PLATINUM;
    }
    if (lifetimePoints >= LOYALTY_TIER_THRESHOLDS[LoyaltyTier.GOLD]) {
      return LoyaltyTier.GOLD;
    }
    if (lifetimePoints >= LOYALTY_TIER_THRESHOLDS[LoyaltyTier.SILVER]) {
      return LoyaltyTier.SILVER;
    }
    return LoyaltyTier.BRONZE;
  }

  public async ensureAccount(userId: string): Promise<LoyaltyAccount> {
    return await this.prisma.loyaltyAccount.upsert({
      where: { userId },
      update: { deletedAt: null },
      create: { userId },
    });
  }

  public async getCustomerOverview(userId: string): Promise<LoyaltyAccountOverview> {
    const account = await this.ensureAccount(userId);
    const achievements = await this.prisma.userAchievement.findMany({
      where: {
        userId,
        achievement: { deletedAt: null },
      },
      include: { achievement: true },
      orderBy: { earnedAt: 'desc' },
    });

    return {
      account: toLoyaltyAccountDto(account),
      nextTier: this.nextTier(account.lifetimePoints),
      achievements: achievements.map(toUserAchievementDto),
      points: await this.getPointsSummary(account),
    };
  }

  /**
   * Everything about the balance that is not just the number: what it is worth
   * in naira, how much of it can actually be redeemed, what was earned this
   * month, when the next award lapses, and which benefit lines are met.
   *
   * Computed from the ledger, never stored. A stored copy is a second source
   * of truth for money, and the ledger already has the answer.
   */
  public async getPointsSummary(
    account: LoyaltyAccount,
    now = new Date(),
  ): Promise<LoyaltyPointsSummary> {
    const [lots, earnedThisMonth] = await Promise.all([
      this.loadLots(account.id),
      this.getEarnedThisMonth(account.id, now),
    ]);

    const balance = account.pointsBalance;
    const redeemablePoints =
      Math.floor(balance / LOYALTY_POINTS_PER_NAIRA) * LOYALTY_POINTS_PER_NAIRA;
    const upcoming = nextExpiry(lots, now);

    return {
      balance,
      pointsPerNaira: LOYALTY_POINTS_PER_NAIRA,
      balanceValue: Math.floor(balance / LOYALTY_POINTS_PER_NAIRA),
      redeemablePoints,
      minimumRedeemablePoints: LOYALTY_POINTS_PER_NAIRA,
      earnedThisMonth,
      nextExpiry:
        upcoming === null ? null : { at: upcoming.at.toISOString(), points: upcoming.points },
      benefits: {
        deliveryFeeDiscount: benefitStatus(
          LOYALTY_BENEFIT_THRESHOLDS.DELIVERY_DISCOUNT_BALANCE,
          balance,
        ),
        monthlyElite: benefitStatus(
          LOYALTY_BENEFIT_THRESHOLDS.MONTHLY_ELITE_EARNED,
          earnedThisMonth,
        ),
      },
    };
  }

  /**
   * Points awarded since the start of the current calendar month in Lagos
   * time — the measure behind the 50,000-in-a-month benefit. Redemptions and
   * expiries do not count against it: the benefit is for earning, and spending
   * what you earned should not take it away.
   */
  public async getEarnedThisMonth(accountId: string, now = new Date()): Promise<number> {
    const aggregate = await this.prisma.loyaltyLedgerEntry.aggregate({
      where: {
        accountId,
        points: { gt: 0 },
        createdAt: { gte: lagosMonthStart(now) },
      },
      _sum: { points: true },
    });
    return aggregate._sum.points ?? 0;
  }

  public async listHistory(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<LoyaltyLedgerEntryDto>> {
    const account = await this.ensureAccount(userId);
    const [items, total] = await Promise.all([
      this.prisma.loyaltyLedgerEntry.findMany({
        where: { accountId: account.id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.loyaltyLedgerEntry.count({ where: { accountId: account.id } }),
    ]);

    return {
      items: items.map(toLedgerEntryDto),
      meta: {
        page,
        limit: pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
      },
    };
  }

  public async awardPoints(input: AwardPointsInput): Promise<LoyaltyAccountOverview> {
    this.assertPositivePoints(input.points);
    const expiresAt = input.expiresAt === undefined ? this.defaultExpiryDate() : input.expiresAt;

    const account = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.loyaltyAccount.upsert({
        where: { userId: input.userId },
        update: { deletedAt: null },
        create: { userId: input.userId },
      });

      const nextLifetimePoints = existing.lifetimePoints + input.points;
      const updated = await tx.loyaltyAccount.update({
        where: { id: existing.id },
        data: {
          pointsBalance: { increment: input.points },
          lifetimePoints: { increment: input.points },
          tier: this.calculateTier(nextLifetimePoints),
        },
      });

      await tx.loyaltyLedgerEntry.create({
        data: {
          accountId: existing.id,
          points: input.points,
          reason: input.reason,
          referenceType: input.referenceType ?? null,
          referenceId: input.referenceId ?? null,
          expiresAt,
        },
      });

      return updated;
    });

    await this.auditService.record(
      LOYALTY_AUDIT_ACTIONS.POINTS_AWARDED,
      { ...(input.context ?? {}), userId: input.userId },
      {
        resource: 'loyalty_account',
        resourceId: account.id,
        metadata: {
          points: input.points,
          reason: input.reason,
          referenceType: input.referenceType ?? null,
          referenceId: input.referenceId ?? null,
        },
      },
    );

    await this.evaluateMilestones(input.userId);
    return await this.getCustomerOverview(input.userId);
  }

  public async awardCashbackPoints(
    userId: string,
    points: number,
    referenceId?: string,
    context: AuditContext = {},
  ): Promise<LoyaltyAccountOverview> {
    return await this.awardPoints({
      userId,
      points,
      reason: 'Cashback reward',
      referenceType: LOYALTY_REFERENCE_TYPES.CASHBACK,
      ...(referenceId !== undefined ? { referenceId } : {}),
      context,
    });
  }

  /**
   * Turn points into money.
   *
   * Redemption used to burn the points and pay nothing — the ledger said
   * "Redeemed loyalty points for discount" and no discount existed anywhere in
   * the platform. Now it credits the customer's wallet at the founder-set rate
   * of 200 points to the naira, which makes a point worth something real in
   * every place the wallet already works: rides, deliveries, orders, transfers
   * and payouts.
   *
   * Two things make this safe to run against live balances:
   *
   * - The points debit and the wallet credit happen in *one* transaction. If
   *   either fails, neither happened. Crediting first would pay for points not
   *   taken; debiting first would destroy points and pay nothing, which is the
   *   bug this replaces.
   * - The credit is keyed on the loyalty ledger entry's id, and
   *   `wallet_ledger_entries` carries a unique index over (wallet, reference
   *   type, reference id). A retry that reaches the wallet twice pays once.
   *
   * Redemptions are whole naira only. Allowing 250 points would either round
   * ₦1.25 down and quietly keep 50 points, or introduce kobo the wallet does
   * not deal in; refusing it is the honest option and the app shows the
   * redeemable figure so nobody has to guess.
   */
  public async redeemPoints(
    userId: string,
    points: number,
    context: AuditContext = {},
  ): Promise<LoyaltyRedemptionResult> {
    this.assertPositivePoints(points);
    if (points % LOYALTY_POINTS_PER_NAIRA !== 0) {
      throw new ValidationDomainException(
        `Points must be redeemed in multiples of ${String(LOYALTY_POINTS_PER_NAIRA)} (${String(LOYALTY_POINTS_PER_NAIRA)} points = NGN 1)`,
      );
    }

    const amount = points / LOYALTY_POINTS_PER_NAIRA;
    const creditInput = {
      ownerType: WalletOwnerType.CUSTOMER,
      ownerId: userId,
      amount,
      description: `Redeemed ${String(points)} DX points`,
      referenceType: LOYALTY_WALLET_REFERENCE_TYPE,
      metadata: { points, pointsPerNaira: LOYALTY_POINTS_PER_NAIRA },
      context: { ...context, userId },
    };

    const { account, outcome, ledgerEntryId } = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.loyaltyAccount.upsert({
        where: { userId },
        update: { deletedAt: null },
        create: { userId },
      });

      if (existing.pointsBalance < points) {
        throw new ValidationDomainException('Insufficient loyalty points');
      }

      const updated = await tx.loyaltyAccount.update({
        where: { id: existing.id },
        data: { pointsBalance: { decrement: points } },
      });

      const entry = await tx.loyaltyLedgerEntry.create({
        data: {
          accountId: existing.id,
          points: -points,
          reason: `Redeemed for NGN ${String(amount)} wallet credit`,
          referenceType: LOYALTY_REFERENCE_TYPES.REDEMPTION,
          referenceId: null,
          expiresAt: null,
        },
      });

      const credited = await this.walletService.creditWithin(tx, {
        ...creditInput,
        referenceId: entry.id,
      });

      return { account: updated, outcome: credited, ledgerEntryId: entry.id };
    });

    // Announced only after the transaction has committed — the wallet event
    // tells the rest of the platform money moved, and it must not say so about
    // a transaction that could still roll back.
    await this.walletService.publishCredit({ ...creditInput, referenceId: ledgerEntryId }, outcome);

    await this.auditService.record(
      LOYALTY_AUDIT_ACTIONS.POINTS_REDEEMED,
      { ...context, userId },
      {
        resource: 'loyalty_account',
        resourceId: account.id,
        metadata: { points, amountCredited: amount, walletLedgerEntryId: outcome.ledgerId },
      },
    );

    return {
      overview: await this.getCustomerOverview(userId),
      pointsRedeemed: points,
      amountCredited: amount,
      wallet: outcome.wallet,
    };
  }

  /**
   * Retire awards that have reached their 365th day.
   *
   * Due awards are handled an account at a time because what expires depends
   * on the whole of that account's ledger, not on the row that fell due: an
   * award the customer already spent has nothing left to take, and taking it
   * anyway destroys points that belong to a *later* award. The old version did
   * exactly that — it expired `min(entry.points, account.pointsBalance)`, so
   * spending an old award made a newer one vanish with it.
   */
  public async expirePoints(now = new Date(), limit = 500): Promise<{ expiredPoints: number }> {
    const dueEntries = await this.prisma.loyaltyLedgerEntry.findMany({
      where: {
        points: { gt: 0 },
        expiresAt: { lte: now },
        account: { pointsBalance: { gt: 0 } },
      },
      include: { account: true },
      orderBy: { expiresAt: 'asc' },
      take: limit,
    });

    const byAccount = new Map<string, (LoyaltyLedgerEntry & { account: LoyaltyAccount })[]>();
    for (const entry of dueEntries) {
      const bucket = byAccount.get(entry.accountId) ?? [];
      bucket.push(entry);
      byAccount.set(entry.accountId, bucket);
    }

    let expiredPoints = 0;
    for (const [accountId, entries] of byAccount) {
      const lots = await this.loadLots(accountId);
      for (const entry of entries) {
        expiredPoints += await this.expireLedgerEntry(entry, lots);
      }
    }

    return { expiredPoints };
  }

  public async listAchievements(): Promise<LoyaltyAchievementDto[]> {
    const achievements = await this.prisma.loyaltyAchievement.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return achievements.map(toAchievementDto);
  }

  public async createAchievement(input: {
    code: string;
    name: string;
    description?: string;
    pointsReward: number;
    active: boolean;
    context?: AuditContext;
  }): Promise<LoyaltyAchievementDto> {
    const achievement = await this.prisma.loyaltyAchievement.create({
      data: {
        code: input.code.trim().toUpperCase(),
        name: input.name.trim(),
        description: input.description?.trim() ?? null,
        pointsReward: input.pointsReward,
        active: input.active,
      },
    });

    await this.auditService.record(LOYALTY_AUDIT_ACTIONS.ACHIEVEMENT_CREATED, input.context ?? {}, {
      resource: 'loyalty_achievement',
      resourceId: achievement.id,
      metadata: { code: achievement.code },
    });

    return toAchievementDto(achievement);
  }

  public async updateAchievement(
    id: string,
    input: {
      name?: string;
      description?: string;
      pointsReward?: number;
      active?: boolean;
      context?: AuditContext;
    },
  ): Promise<LoyaltyAchievementDto> {
    await this.requireAchievement(id);
    const data: Prisma.LoyaltyAchievementUpdateInput = {};
    if (input.name !== undefined) {
      data.name = input.name.trim();
    }
    if (input.description !== undefined) {
      data.description = input.description.trim();
    }
    if (input.pointsReward !== undefined) {
      data.pointsReward = input.pointsReward;
    }
    if (input.active !== undefined) {
      data.active = input.active;
    }

    const achievement = await this.prisma.loyaltyAchievement.update({
      where: { id },
      data,
    });

    await this.auditService.record(LOYALTY_AUDIT_ACTIONS.ACHIEVEMENT_UPDATED, input.context ?? {}, {
      resource: 'loyalty_achievement',
      resourceId: achievement.id,
      metadata: { code: achievement.code },
    });

    return toAchievementDto(achievement);
  }

  public async deleteAchievement(
    id: string,
    context: AuditContext = {},
  ): Promise<{ deleted: true }> {
    const achievement = await this.requireAchievement(id);
    await this.prisma.loyaltyAchievement.update({
      where: { id },
      data: { active: false, deletedAt: new Date() },
    });

    await this.auditService.record(LOYALTY_AUDIT_ACTIONS.ACHIEVEMENT_DELETED, context, {
      resource: 'loyalty_achievement',
      resourceId: id,
      metadata: { code: achievement.code },
    });

    return { deleted: true };
  }

  private async expireLedgerEntry(
    entry: LoyaltyLedgerEntry & { account: LoyaltyAccount },
    lots: PointsLot[],
  ): Promise<number> {
    const existingExpiration = await this.prisma.loyaltyLedgerEntry.count({
      where: {
        referenceType: LOYALTY_REFERENCE_TYPES.EXPIRATION,
        referenceId: entry.id,
      },
    });
    if (existingExpiration > 0) {
      return 0;
    }

    const account = await this.prisma.loyaltyAccount.findUnique({ where: { id: entry.accountId } });
    if (!account || account.pointsBalance <= 0) {
      return 0;
    }

    // Only what is genuinely left of *this* award. The balance cap stays as a
    // floor under the arithmetic: the ledger and the balance should agree, and
    // if they ever drift, expiry must not be what drives a balance negative.
    const pointsToExpire = Math.min(remainingForLot(lots, entry.id), account.pointsBalance);
    if (pointsToExpire <= 0) {
      return 0;
    }

    // The debit this is about to write consumes oldest-first, and this award is
    // the oldest thing with anything left — so record it against the in-memory
    // allocation rather than re-reading the ledger for every due award.
    const lot = lots.find((candidate) => candidate.id === entry.id);
    if (lot !== undefined) {
      lot.remaining -= pointsToExpire;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.loyaltyAccount.update({
        where: { id: entry.accountId },
        data: { pointsBalance: { decrement: pointsToExpire } },
      });
      await tx.loyaltyLedgerEntry.create({
        data: {
          accountId: entry.accountId,
          points: -pointsToExpire,
          reason: 'Expired loyalty points',
          referenceType: LOYALTY_REFERENCE_TYPES.EXPIRATION,
          referenceId: entry.id,
          expiresAt: null,
        },
      });
    });

    await this.auditService.record(
      LOYALTY_AUDIT_ACTIONS.POINTS_EXPIRED,
      {},
      {
        resource: 'loyalty_account',
        resourceId: entry.accountId,
        userId: account.userId,
        metadata: { points: pointsToExpire, sourceLedgerEntryId: entry.id },
      },
    );

    return pointsToExpire;
  }

  private async evaluateMilestones(userId: string): Promise<void> {
    const account = await this.prisma.loyaltyAccount.findUnique({ where: { userId } });
    if (!account) {
      return;
    }

    const earnedCodes = LOYALTY_MILESTONE_ACHIEVEMENTS.filter(
      (milestone) => account.lifetimePoints >= milestone.lifetimePoints,
    ).map((milestone) => milestone.code);
    if (earnedCodes.length === 0) {
      return;
    }

    const achievements = await this.prisma.loyaltyAchievement.findMany({
      where: {
        code: { in: earnedCodes },
        active: true,
        deletedAt: null,
      },
    });

    for (const achievement of achievements) {
      const created = await this.prisma.userAchievement
        .create({
          data: { userId, achievementId: achievement.id },
        })
        .catch((error: unknown) => {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return null;
          }
          throw error;
        });

      if (created && achievement.pointsReward > 0) {
        await this.awardAchievementReward(userId, achievement);
      }
    }
  }

  private async awardAchievementReward(
    userId: string,
    achievement: LoyaltyAchievement,
  ): Promise<void> {
    const existing = await this.prisma.loyaltyLedgerEntry.count({
      where: {
        referenceType: LOYALTY_REFERENCE_TYPES.ACHIEVEMENT,
        referenceId: achievement.id,
        account: { userId },
      },
    });
    if (existing > 0) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      const account = await tx.loyaltyAccount.upsert({
        where: { userId },
        update: { deletedAt: null },
        create: { userId },
      });
      const nextLifetimePoints = account.lifetimePoints + achievement.pointsReward;
      await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          pointsBalance: { increment: achievement.pointsReward },
          lifetimePoints: { increment: achievement.pointsReward },
          tier: this.calculateTier(nextLifetimePoints),
        },
      });
      await tx.loyaltyLedgerEntry.create({
        data: {
          accountId: account.id,
          points: achievement.pointsReward,
          reason: `Achievement reward: ${achievement.name}`,
          referenceType: LOYALTY_REFERENCE_TYPES.ACHIEVEMENT,
          referenceId: achievement.id,
          expiresAt: this.defaultExpiryDate(),
        },
      });
    });
  }

  private async requireAchievement(id: string): Promise<LoyaltyAchievement> {
    const achievement = await this.prisma.loyaltyAchievement.findUnique({ where: { id } });
    if (!achievement || achievement.deletedAt) {
      throw new NotFoundDomainException('Loyalty achievement not found');
    }
    return achievement;
  }

  private nextTier(lifetimePoints: number): { tier: LoyaltyTier; pointsRequired: number } | null {
    const ordered: LoyaltyTier[] = [
      LoyaltyTier.SILVER,
      LoyaltyTier.GOLD,
      LoyaltyTier.PLATINUM,
      LoyaltyTier.VIP,
    ];
    for (const tier of ordered) {
      const threshold = LOYALTY_TIER_THRESHOLDS[tier];
      if (lifetimePoints < threshold) {
        return { tier, pointsRequired: threshold - lifetimePoints };
      }
    }
    return null;
  }

  /** Every ledger row for one account, replayed into per-award remainders. */
  private async loadLots(accountId: string): Promise<PointsLot[]> {
    const lines = await this.prisma.loyaltyLedgerEntry.findMany({
      where: { accountId },
      select: { id: true, points: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return allocatePointsLots(lines);
  }

  private defaultExpiryDate(): Date {
    return new Date(Date.now() + LOYALTY_POINT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  }

  private assertPositivePoints(points: number): void {
    if (!Number.isInteger(points) || points <= 0) {
      throw new ValidationDomainException('Points must be a positive integer');
    }
  }
}

/**
 * Midnight on the first of the current month, Lagos time, expressed as the
 * instant it happened. Africa/Lagos is UTC+1 all year (no DST), so the month
 * boundary is simply 23:00 UTC on the last day of the previous month — a
 * customer's "this month" should not roll over an hour early because the
 * server keeps time in UTC.
 */
function lagosMonthStart(now: Date): Date {
  const lagos = new Date(now.getTime() + LAGOS_OFFSET_MS);
  return new Date(
    Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), 1, 0, 0, 0, 0) - LAGOS_OFFSET_MS,
  );
}

const LAGOS_OFFSET_MS = 60 * 60 * 1000;

function benefitStatus(
  threshold: number,
  achieved: number,
): { threshold: number; eligible: boolean; pointsToGo: number } {
  return {
    threshold,
    eligible: achieved >= threshold,
    pointsToGo: Math.max(0, threshold - achieved),
  };
}

function toLoyaltyAccountDto(account: LoyaltyAccount): LoyaltyAccountDto {
  return {
    id: account.id,
    userId: account.userId,
    pointsBalance: account.pointsBalance,
    lifetimePoints: account.lifetimePoints,
    tier: account.tier,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

function toLedgerEntryDto(entry: LoyaltyLedgerEntry): LoyaltyLedgerEntryDto {
  return {
    id: entry.id,
    points: entry.points,
    reason: entry.reason,
    referenceType: entry.referenceType,
    referenceId: entry.referenceId,
    expiresAt: entry.expiresAt?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
  };
}

function toAchievementDto(achievement: LoyaltyAchievement): LoyaltyAchievementDto {
  return {
    id: achievement.id,
    code: achievement.code,
    name: achievement.name,
    description: achievement.description,
    pointsReward: achievement.pointsReward,
    active: achievement.active,
    createdAt: achievement.createdAt.toISOString(),
    updatedAt: achievement.updatedAt.toISOString(),
  };
}

function toUserAchievementDto(
  userAchievement: UserAchievement & { achievement: LoyaltyAchievement },
): UserAchievementDto {
  return {
    id: userAchievement.id,
    earnedAt: userAchievement.earnedAt.toISOString(),
    achievement: toAchievementDto(userAchievement.achievement),
  };
}
