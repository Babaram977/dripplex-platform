import { randomInt } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import {
  LoyaltyLedgerEntryType,
  LoyaltyRedemptionStatus,
  LoyaltyRewardType,
  Prisma,
  PromotionStatus,
  PromotionType,
} from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import {
  LOYALTY_AUDIT_ACTIONS,
  LOYALTY_REDEMPTION_CODE_ALPHABET,
  LOYALTY_REFERENCE_TYPES,
} from './loyalty.constants';

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
  /** The coupon minted for this redemption, where the reward grants one. The
   *  code is the part the holder needs — an id they cannot type is no use. */
  promotionId: string | null;
  couponCode: string | null;
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
  private readonly logger = new Logger(LoyaltyRewardsService.name);

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
      include: { reward: { select: { name: true } }, promotion: { select: { code: true } } },
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
      const expiresAt =
        reward.entitlementDays === null
          ? null
          : new Date(now.getTime() + reward.entitlementDays * 24 * 60 * 60 * 1000);

      // DPX-LOYALTY-008 — mint the thing the holder actually paid for.
      //
      // In the same transaction as the points debit, deliberately: a coupon
      // created afterwards could fail and leave somebody who has paid 25,000
      // points holding nothing, which is exactly the state this fixes.
      const promotionId = await this.mintCoupon(tx, { reward, userId, expiresAt, now });

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
          ...(promotionId === null ? {} : { promotionId }),
          ...(needsFulfilment ? {} : { fulfilledAt: now }),
          ...(expiresAt === null ? {} : { expiresAt }),
        },
        include: {
          reward: { select: { name: true } },
          promotion: { select: { code: true } },
        },
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
        include: { reward: { select: { name: true } }, promotion: { select: { code: true } } },
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
      include: { reward: { select: { name: true } }, promotion: { select: { code: true } } },
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
      include: { reward: { select: { name: true } }, promotion: { select: { code: true } } },
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

  /**
   * DPX-LOYALTY-008 — turn a redeemed coupon reward into a coupon that works.
   *
   * `promotion_id` has been on the redemption row since the catalogue shipped
   * and nothing ever wrote it, so somebody who spent 25,000 DX Points on a
   * "₦500 coupon" received a record of the purchase and no way to spend it.
   *
   * Returns null — mints nothing — for every reward that is not a discount
   * coupon, and for one that names no domains. Both are correct silences: a
   * physical gift is posted rather than spent, and a reward whose scope nobody
   * has stated must not be given one by this code.
   *
   * The minted promotion is locked to the holder three ways over, because a
   * coupon bought with somebody's own points is not a campaign:
   *
   * - `rules.whitelistUserIds` is the holder alone, so no one else's basket
   *   can match it even with the code.
   * - `perUserLimit` and `usageLimit` are both 1, so it is spent once whatever
   *   happens.
   * - It carries no `merchantId`, because DrippleX funds it — the points were
   *   paid to DrippleX, not to the shop that happens to accept it.
   */
  private async mintCoupon(
    tx: Prisma.TransactionClient,
    input: { reward: LoyaltyReward; userId: string; expiresAt: Date | null; now: Date },
  ): Promise<string | null> {
    const { reward, userId, expiresAt, now } = input;
    if (reward.type !== LoyaltyRewardType.DISCOUNT_COUPON) {
      return null;
    }
    if (reward.domains.length === 0) {
      return null;
    }

    const percentOff = reward.discountPercentage;
    const amountOff = reward.monetaryValue;
    if (percentOff === null && amountOff === null) {
      // A coupon reward with neither a percentage nor an amount is a
      // misconfiguration, not a free coupon. Minting an empty promotion would
      // hand somebody a code that silently takes nothing off.
      this.logger.error(
        `Loyalty reward ${reward.id} is a DISCOUNT_COUPON with no value; no coupon was minted.`,
      );
      return null;
    }

    const promotion = await tx.promotion.create({
      data: {
        code: this.couponCode(),
        name: reward.name,
        type: percentOff === null ? PromotionType.FIXED : PromotionType.PERCENTAGE,
        status: PromotionStatus.ACTIVE,
        domains: reward.domains,
        ...(percentOff === null ? {} : { percentOff }),
        ...(amountOff === null || percentOff !== null ? {} : { amountOff }),
        ...(reward.maxDiscount === null ? {} : { maxDiscount: reward.maxDiscount }),
        perUserLimit: 1,
        usageLimit: 1,
        startsAt: now,
        ...(expiresAt === null ? {} : { endsAt: expiresAt }),
        rules: { whitelistUserIds: [userId] },
        metadata: {
          source: 'loyalty_reward',
          rewardId: reward.id,
          pointsSpent: reward.pointsCost,
        },
      },
      select: { id: true },
    });

    return promotion.id;
  }

  /**
   * A code for a minted coupon.
   *
   * The same alphabet the counter codes use — no O/0, I/1 or S/5 — because a
   * customer reads this one out too. Collision is handled by the unique index
   * rather than by checking first: at 10 characters from 31 symbols a clash is
   * vanishingly unlikely, and a failed insert rolls the whole redemption back
   * rather than issuing a duplicate.
   */
  private couponCode(): string {
    let code = 'DX';
    for (let index = 0; index < 8; index += 1) {
      code += LOYALTY_REDEMPTION_CODE_ALPHABET.charAt(
        randomInt(LOYALTY_REDEMPTION_CODE_ALPHABET.length),
      );
    }
    return code;
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
  redemption: LoyaltyRewardRedemption & { promotion?: { code: string | null } | null },
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
    promotionId: redemption.promotionId,
    couponCode: redemption.promotion?.code ?? null,
    expiresAt: redemption.expiresAt?.toISOString() ?? null,
    fulfilledAt: redemption.fulfilledAt?.toISOString() ?? null,
    fulfilmentNote: redemption.fulfilmentNote,
    createdAt: redemption.createdAt.toISOString(),
  };
}
