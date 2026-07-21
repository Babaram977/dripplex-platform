import { Injectable } from '@nestjs/common';
import { LoyaltyTier, Prisma } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import {
  LOYALTY_AUDIT_ACTIONS,
  LOYALTY_MILESTONE_ACHIEVEMENTS,
  LOYALTY_POINT_EXPIRY_DAYS,
  LOYALTY_REFERENCE_TYPES,
  LOYALTY_TIER_THRESHOLDS,
} from './loyalty.constants';

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
    };
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

  public async redeemPoints(
    userId: string,
    points: number,
    context: AuditContext = {},
  ): Promise<LoyaltyAccountOverview> {
    this.assertPositivePoints(points);

    const account = await this.prisma.$transaction(async (tx) => {
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

      await tx.loyaltyLedgerEntry.create({
        data: {
          accountId: existing.id,
          points: -points,
          reason: 'Redeemed loyalty points for discount',
          referenceType: LOYALTY_REFERENCE_TYPES.REDEMPTION,
          referenceId: null,
          expiresAt: null,
        },
      });

      return updated;
    });

    await this.auditService.record(
      LOYALTY_AUDIT_ACTIONS.POINTS_REDEEMED,
      { ...context, userId },
      {
        resource: 'loyalty_account',
        resourceId: account.id,
        metadata: { points },
      },
    );

    return await this.getCustomerOverview(userId);
  }

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

    let expiredPoints = 0;
    for (const entry of dueEntries) {
      const expired = await this.expireLedgerEntry(entry);
      expiredPoints += expired;
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

    const pointsToExpire = Math.min(entry.points, account.pointsBalance);
    if (pointsToExpire <= 0) {
      return 0;
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

  private defaultExpiryDate(): Date {
    return new Date(Date.now() + LOYALTY_POINT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  }

  private assertPositivePoints(points: number): void {
    if (!Number.isInteger(points) || points <= 0) {
      throw new ValidationDomainException('Points must be a positive integer');
    }
  }
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
