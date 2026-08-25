import { Injectable, Logger } from '@nestjs/common';
import { Prisma, ReferralRedemptionStatus, RideStatus, WalletOwnerType } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import { ConflictDomainException } from '../common/exceptions/domain.exception';
import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../events/domain-events';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

import { generateReferralCode } from './referral-code.util';
import {
  REFERRAL_AUDIT_ACTIONS,
  REFERRAL_CODE_MAX_GENERATION_ATTEMPTS,
  REFERRAL_CODE_PATTERN,
  REFERRAL_REWARD_AMOUNTS,
  REFERRAL_WALLET_REFERENCE_TYPES,
} from './referral.constants';
import {
  toReferralDto,
  toReferralRedemptionDto,
  type ReferralDto,
  type ReferralRedemptionDto,
  type ReferralStatsDto,
} from './referral.mapper';

import type { PaginatedResult } from '@dripplex/types';

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventBus: DomainEventBus,
    private readonly walletService: WalletService,
  ) {}

  public async getOrCreateMyCode(userId: string, context?: AuditContext): Promise<ReferralDto> {
    const existing = await this.prisma.referral.findUnique({ where: { userId } });
    if (existing) {
      return toReferralDto(existing);
    }

    for (let attempt = 0; attempt < REFERRAL_CODE_MAX_GENERATION_ATTEMPTS; attempt += 1) {
      try {
        const created = await this.prisma.referral.create({
          data: { userId, code: generateReferralCode() },
        });
        await this.auditService.record(
          REFERRAL_AUDIT_ACTIONS.CODE_GENERATED,
          { ...context, userId },
          { resource: 'referral', resourceId: created.id },
        );
        return toReferralDto(created);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const raceWinner = await this.prisma.referral.findUnique({ where: { userId } });
          if (raceWinner) {
            return toReferralDto(raceWinner);
          }
          continue;
        }
        throw error;
      }
    }

    throw new ConflictDomainException('Could not generate a unique referral code, please retry');
  }

  public async getStats(userId: string): Promise<ReferralStatsDto> {
    const referral = await this.getOrCreateMyCode(userId);
    const [total, pending, rewarded] = await Promise.all([
      this.prisma.referralRedemption.count({ where: { referralId: referral.id } }),
      this.prisma.referralRedemption.count({
        where: { referralId: referral.id, status: ReferralRedemptionStatus.PENDING },
      }),
      this.prisma.referralRedemption.count({
        where: { referralId: referral.id, status: ReferralRedemptionStatus.REWARDED },
      }),
    ]);

    return {
      code: referral.code,
      totalRedemptions: total,
      pendingRedemptions: pending,
      rewardedRedemptions: rewarded,
      refereeRewardAmount: REFERRAL_REWARD_AMOUNTS.REFEREE,
      referrerRewardAmount: REFERRAL_REWARD_AMOUNTS.REFERRER,
    };
  }

  public async listRedemptions(
    status: ReferralRedemptionStatus | undefined,
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<ReferralRedemptionDto>> {
    const where = status !== undefined ? { status } : {};
    const [items, total] = await Promise.all([
      this.prisma.referralRedemption.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.referralRedemption.count({ where }),
    ]);

    return {
      items: items.map(toReferralRedemptionDto),
      meta: {
        page,
        limit: pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
      },
    };
  }

  /**
   * Called from RegistrationService right after a customer account is
   * created. Never throws — an invalid, unknown, or self-referral code must
   * not fail registration; it's simply ignored (audited as a skip via the
   * absence of a created redemption).
   */
  public async tryRedeemAtRegistration(
    refereeUserId: string,
    rawCode: string,
    context: AuditContext,
  ): Promise<void> {
    const code = rawCode.trim().toUpperCase();
    if (!REFERRAL_CODE_PATTERN.test(code)) {
      return;
    }

    try {
      const referral = await this.prisma.referral.findUnique({ where: { code } });
      if (!referral || referral.userId === refereeUserId) {
        return;
      }

      const redemption = await this.prisma.referralRedemption.create({
        data: { referralId: referral.id, refereeUserId },
      });

      await this.auditService.record(
        REFERRAL_AUDIT_ACTIONS.REDEEMED,
        { ...context, userId: refereeUserId },
        {
          resource: 'referral_redemption',
          resourceId: redemption.id,
          metadata: { referralId: referral.id, referrerId: referral.userId },
        },
      );
      await this.eventBus.emit(
        DOMAIN_EVENTS.REFERRAL_REDEEMED,
        { userId: referral.userId, refereeUserId, code },
        { actorUserId: refereeUserId },
      );
    } catch (error) {
      this.logger.warn(
        `Referral code redemption skipped for user ${refereeUserId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  /**
   * Reward trigger: the referee's first completed ride, not signup — a
   * signup-only trigger is a well-known free-money fraud vector (fake
   * accounts referring each other for the bonus with no real usage).
   * Called from ReferralRewardSubscriber on DOMAIN_EVENTS.RIDE_COMPLETED.
   */
  public async handleRefereeRideCompleted(customerId: string): Promise<void> {
    const redemption = await this.prisma.referralRedemption.findUnique({
      where: { refereeUserId: customerId },
      include: { referral: true },
    });
    if (redemption?.status !== ReferralRedemptionStatus.PENDING) {
      return;
    }

    const completedRideCount = await this.prisma.ride.count({
      where: { customerId, status: RideStatus.COMPLETED },
    });
    if (completedRideCount !== 1) {
      return;
    }

    const referrerId = redemption.referral.userId;

    await this.walletService.credit({
      ownerType: WalletOwnerType.CUSTOMER,
      ownerId: referrerId,
      amount: REFERRAL_REWARD_AMOUNTS.REFERRER,
      referenceType: REFERRAL_WALLET_REFERENCE_TYPES.REFERRER_REWARD,
      referenceId: redemption.id,
      description: 'Referral reward — a friend you referred completed their first ride',
    });
    await this.walletService.credit({
      ownerType: WalletOwnerType.CUSTOMER,
      ownerId: customerId,
      amount: REFERRAL_REWARD_AMOUNTS.REFEREE,
      referenceType: REFERRAL_WALLET_REFERENCE_TYPES.REFEREE_REWARD,
      referenceId: redemption.id,
      description: 'Referral reward — welcome bonus for using a referral code',
    });

    await this.prisma.referralRedemption.update({
      where: { id: redemption.id },
      data: { status: ReferralRedemptionStatus.REWARDED, rewardedAt: new Date() },
    });

    await this.auditService.record(
      REFERRAL_AUDIT_ACTIONS.REWARDED,
      { userId: customerId },
      {
        resource: 'referral_redemption',
        resourceId: redemption.id,
        metadata: { referrerId, refereeId: customerId },
      },
    );

    await this.eventBus.emit(
      DOMAIN_EVENTS.REFERRAL_REWARDED,
      { userId: referrerId, amount: String(REFERRAL_REWARD_AMOUNTS.REFERRER), role: 'referrer' },
      { actorUserId: customerId },
    );
    await this.eventBus.emit(
      DOMAIN_EVENTS.REFERRAL_REWARDED,
      { userId: customerId, amount: String(REFERRAL_REWARD_AMOUNTS.REFEREE), role: 'referee' },
      { actorUserId: customerId },
    );
  }
}
