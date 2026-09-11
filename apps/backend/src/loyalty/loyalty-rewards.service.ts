import { Injectable } from '@nestjs/common';
import { LoyaltyLedgerEntryType, LoyaltyRedemptionStatus, LoyaltyRewardType } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import { LOYALTY_AUDIT_ACTIONS, LOYALTY_REFERENCE_TYPES } from './loyalty.constants';

import type { PaginatedResult } from '@dripplex/types';
import type { LoyaltyReward, LoyaltyRewardRedemption } from '@prisma/client';

/** Rewards that are simply granted, versus ones somebody has to hand over. */
const NEEDS_FULFILMENT: LoyaltyRewardType[] = [LoyaltyRewardType.PHYSICAL_GIFT];

export interface LoyaltyRewardDto {
  id: string;
  name: string;
  description: string | null;
  type: LoyaltyRewardType;
  pointsCost: number;
  monetaryValue: number | null;
  discountPercentage: number | null;
  maxDiscount: number | null;
  stockQuantity: number | null;
  perUserLimit: number | null;
  entitlementDays: number | null;
  active: boolean;
  /** Filled in for a specific holder: whether they can take it right now, and why not. */
  affordable?: boolean;
  pointsToGo?: number;
  unavailableReason?: string | null;
}

export interface LoyaltyRewardRedemptionDto {
  id: string;
  rewardId: string;
  rewardName: string;
  type: LoyaltyRewardType;
  pointsSpent: number;
  monetaryValue: number | null;
  status: LoyaltyRedemptionStatus;
  expiresAt: string | null;
  fulfilledAt: string | null;
  fulfilmentNote: string | null;
  createdAt: string;
}

/**
 * DPX-LOYALTY-004 — the DX Points rewards catalogue, and taking things from it.
 *
 * Nora's specification, 2026-09-11, with one correction that shapes everything
 * here: **10,000 and 50,000 are points thresholds, not naira.** A reward is an
 * *entitlement* a holder earns by spending points — a coupon, a free delivery,
 * a gift — and never a cash payout. Points are a loyalty unit; they are not
 * wallet cash, not withdrawable, and not merchant settlement funds.
 *
 * The thresholds live in the catalogue table rather than in code, so Operations
 * can add 5,000 or 75,000 or 100,000 without a deployment. The seeded
 * 10k/25k/50k are opening rows, not fixed tiers.
 *
 * Redemption is the part that has to be exactly right:
 *
 * - **Atomic.** Balance check, stock, limits, the points debit and the
 *   entitlement all commit together. A failed redemption never leaves a holder
 *   short of points with nothing to show for it.
 * - **Idempotent.** Two taps on a slow connection are one redemption. The
 *   caller's key is unique per holder at the database level, so that is true
 *   rather than merely likely, and a replay returns the original rather than
 *   charging again.
 * - **Stock is decremented conditionally**, so a gift with three left cannot be
 *   promised to four people racing each other.
 *
 * A physical gift is not finished because the points came off. It enters
 * fulfilment and stays visible to Operations until somebody has actually
 * received it.
 */
@Injectable()
export class LoyaltyRewardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * The catalogue as one holder sees it: every live reward, with what they can
   * afford and what they are still short of.
   */
  public async catalogueFor(userId: string, now = new Date()): Promise<LoyaltyRewardDto[]> {
    const [rewards, account] = await Promise.all([
      this.prisma.loyaltyReward.findMany({
        where: {
          active: true,
          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
          AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
        },
        orderBy: { pointsCost: 'asc' },
      }),
      this.prisma.loyaltyAccount.findUnique({ where: { userId } }),
    ]);

    const balance = account?.pointsBalance ?? 0;
    const takenByReward = await this.countsByReward(
      userId,
      rewards.map((reward) => reward.id),
    );

    return rewards.map((reward) => {
      const taken = takenByReward.get(reward.id) ?? 0;
      const unavailable = this.unavailableReason(reward, taken);
      return {
        ...toRewardDto(reward),
        affordable: unavailable === null && balance >= reward.pointsCost,
        pointsToGo: Math.max(0, reward.pointsCost - balance),
        unavailableReason: unavailable,
      };
    });
  }

  /**
   * Spend points on a reward.
   *
   * `idempotencyKey` is the caller's own — a replay with the same key returns
   * the redemption that already happened rather than taking the points twice.
   */
  public async redeem(
    userId: string,
    rewardId: string,
    idempotencyKey: string,
    context: AuditContext = {},
  ): Promise<LoyaltyRewardRedemptionDto> {
    const key = idempotencyKey.trim();
    if (key === '') {
      throw new ValidationDomainException('An idempotency key is required to redeem a reward');
    }

    const existing = await this.prisma.loyaltyRewardRedemption.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
      include: { reward: { select: { name: true } } },
    });
    if (existing) {
      return toRedemptionDto(existing, existing.reward.name);
    }

    const now = new Date();
    const redemption = await this.prisma.$transaction(async (tx) => {
      const reward = await tx.loyaltyReward.findUnique({ where: { id: rewardId } });
      if (reward === null) {
        throw new NotFoundDomainException('Reward not found');
      }
      if (!reward.active) {
        throw new ValidationDomainException('That reward is no longer available');
      }
      if (reward.startsAt !== null && reward.startsAt > now) {
        throw new ValidationDomainException('That reward is not available yet');
      }
      if (reward.endsAt !== null && reward.endsAt <= now) {
        throw new ValidationDomainException('That reward has ended');
      }

      const takenByThisUser = await tx.loyaltyRewardRedemption.count({
        where: { userId, rewardId, status: { not: LoyaltyRedemptionStatus.CANCELLED } },
      });
      const unavailable = this.unavailableReason(reward, takenByThisUser);
      if (unavailable !== null) {
        throw new ValidationDomainException(unavailable);
      }

      const account = await tx.loyaltyAccount.upsert({
        where: { userId },
        update: { deletedAt: null },
        create: { userId },
      });
      if (account.pointsBalance < reward.pointsCost) {
        throw new ValidationDomainException(
          `That reward costs ${reward.pointsCost.toLocaleString('en-NG')} DX points and you have ${account.pointsBalance.toLocaleString('en-NG')}`,
        );
      }

      // Claim stock and the total limit in one conditional update. Two holders
      // racing for the last gift cannot both win here — the loser's update
      // matches no row and the whole redemption rolls back.
      const claimed = await tx.loyaltyReward.updateMany({
        where: {
          id: reward.id,
          ...(reward.stockQuantity === null ? {} : { stockQuantity: { gt: 0 } }),
          ...(reward.totalRedemptionLimit === null
            ? {}
            : { redeemedCount: { lt: reward.totalRedemptionLimit } }),
        },
        data: {
          redeemedCount: { increment: 1 },
          ...(reward.stockQuantity === null ? {} : { stockQuantity: { decrement: 1 } }),
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictDomainException('That reward has just run out');
      }

      await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: { pointsBalance: { decrement: reward.pointsCost } },
      });

      const entry = await tx.loyaltyLedgerEntry.create({
        data: {
          type: LoyaltyLedgerEntryType.REDEEMED,
          accountId: account.id,
          points: -reward.pointsCost,
          reason: `Redeemed for ${reward.name}`,
          referenceType: LOYALTY_REFERENCE_TYPES.REWARD,
          referenceId: reward.id,
          expiresAt: null,
        },
      });

      const needsFulfilment = NEEDS_FULFILMENT.includes(reward.type);
      return await tx.loyaltyRewardRedemption.create({
        data: {
          rewardId: reward.id,
          userId,
          pointsSpent: reward.pointsCost,
          rewardType: reward.type,
          monetaryValue: reward.monetaryValue,
          // A gift is not delivered because the points came off.
          status: needsFulfilment
            ? LoyaltyRedemptionStatus.FULFILMENT_PENDING
            : LoyaltyRedemptionStatus.FULFILLED,
          ledgerEntryId: entry.id,
          idempotencyKey: key,
          ...(needsFulfilment ? {} : { fulfilledAt: now }),
          ...(reward.entitlementDays === null
            ? {}
            : {
                expiresAt: new Date(now.getTime() + reward.entitlementDays * 24 * 60 * 60 * 1000),
              }),
        },
        include: { reward: { select: { name: true } } },
      });
    });

    await this.auditService.record(
      LOYALTY_AUDIT_ACTIONS.REWARD_REDEEMED,
      { ...context, userId },
      {
        resource: 'loyalty_reward_redemption',
        resourceId: redemption.id,
        metadata: {
          rewardId,
          pointsSpent: redemption.pointsSpent,
          type: redemption.rewardType,
          status: redemption.status,
        },
      },
    );

    return toRedemptionDto(redemption, redemption.reward.name);
  }

  public async listForUser(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<LoyaltyRewardRedemptionDto>> {
    const [items, total] = await Promise.all([
      this.prisma.loyaltyRewardRedemption.findMany({
        where: { userId },
        include: { reward: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.loyaltyRewardRedemption.count({ where: { userId } }),
    ]);

    return {
      items: items.map((item) => toRedemptionDto(item, item.reward.name)),
      meta: {
        page,
        limit: pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
      },
    };
  }

  /** What Operations still has to hand over. */
  public async listOutstandingFulfilment(
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<LoyaltyRewardRedemptionDto & { holderName: string }>> {
    const where = {
      status: {
        in: [
          LoyaltyRedemptionStatus.FULFILMENT_PENDING,
          LoyaltyRedemptionStatus.PROCESSING,
          LoyaltyRedemptionStatus.READY_FOR_COLLECTION,
          LoyaltyRedemptionStatus.SHIPPED,
        ],
      },
    };

    const [items, total] = await Promise.all([
      this.prisma.loyaltyRewardRedemption.findMany({
        where,
        include: {
          reward: { select: { name: true } },
          user: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.loyaltyRewardRedemption.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        ...toRedemptionDto(item, item.reward.name),
        holderName: `${item.user.firstName} ${item.user.lastName}`.trim(),
      })),
      meta: {
        page,
        limit: pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
      },
    };
  }

  /** Moves a physical gift along its fulfilment path. */
  public async advanceFulfilment(
    redemptionId: string,
    status: LoyaltyRedemptionStatus,
    note: string | undefined,
    adminUserId: string,
    context: AuditContext = {},
  ): Promise<LoyaltyRewardRedemptionDto> {
    const redemption = await this.prisma.loyaltyRewardRedemption.findUnique({
      where: { id: redemptionId },
      include: { reward: { select: { name: true } } },
    });
    if (redemption === null) {
      throw new NotFoundDomainException('Redemption not found');
    }
    if (status === LoyaltyRedemptionStatus.FULFILLED) {
      throw new ValidationDomainException(
        'FULFILLED is for rewards granted instantly. Use DELIVERED or READY_FOR_COLLECTION.',
      );
    }

    const updated = await this.prisma.loyaltyRewardRedemption.update({
      where: { id: redemptionId },
      data: {
        status,
        ...(note === undefined ? {} : { fulfilmentNote: note }),
        ...(status === LoyaltyRedemptionStatus.DELIVERED ? { fulfilledAt: new Date() } : {}),
      },
      include: { reward: { select: { name: true } } },
    });

    await this.auditService.record(
      LOYALTY_AUDIT_ACTIONS.REWARD_FULFILMENT_UPDATED,
      { ...context, userId: adminUserId },
      {
        resource: 'loyalty_reward_redemption',
        resourceId: redemptionId,
        metadata: { previousStatus: redemption.status, status },
      },
    );

    return toRedemptionDto(updated, updated.reward.name);
  }

  private unavailableReason(reward: LoyaltyReward, takenByThisUser: number): string | null {
    if (reward.stockQuantity !== null && reward.stockQuantity <= 0) {
      return 'That reward is out of stock';
    }
    if (
      reward.totalRedemptionLimit !== null &&
      reward.redeemedCount >= reward.totalRedemptionLimit
    ) {
      return 'That reward has reached its redemption limit';
    }
    if (reward.perUserLimit !== null && takenByThisUser >= reward.perUserLimit) {
      return 'You have already taken this reward as many times as it allows';
    }
    return null;
  }

  private async countsByReward(userId: string, rewardIds: string[]): Promise<Map<string, number>> {
    if (rewardIds.length === 0) {
      return new Map();
    }
    const grouped = await this.prisma.loyaltyRewardRedemption.groupBy({
      by: ['rewardId'],
      where: {
        userId,
        rewardId: { in: rewardIds },
        status: { not: LoyaltyRedemptionStatus.CANCELLED },
      },
      _count: { _all: true },
    });
    return new Map(grouped.map((row) => [row.rewardId, row._count._all]));
  }
}

function toRewardDto(reward: LoyaltyReward): LoyaltyRewardDto {
  return {
    id: reward.id,
    name: reward.name,
    description: reward.description,
    type: reward.type,
    pointsCost: reward.pointsCost,
    monetaryValue: reward.monetaryValue === null ? null : Number(reward.monetaryValue),
    discountPercentage:
      reward.discountPercentage === null ? null : Number(reward.discountPercentage),
    maxDiscount: reward.maxDiscount === null ? null : Number(reward.maxDiscount),
    stockQuantity: reward.stockQuantity,
    perUserLimit: reward.perUserLimit,
    entitlementDays: reward.entitlementDays,
    active: reward.active,
  };
}

function toRedemptionDto(
  redemption: LoyaltyRewardRedemption,
  rewardName: string,
): LoyaltyRewardRedemptionDto {
  return {
    id: redemption.id,
    rewardId: redemption.rewardId,
    rewardName,
    type: redemption.rewardType,
    pointsSpent: redemption.pointsSpent,
    monetaryValue: redemption.monetaryValue === null ? null : Number(redemption.monetaryValue),
    status: redemption.status,
    expiresAt: redemption.expiresAt?.toISOString() ?? null,
    fulfilledAt: redemption.fulfilledAt?.toISOString() ?? null,
    fulfilmentNote: redemption.fulfilmentNote,
    createdAt: redemption.createdAt.toISOString(),
  };
}
