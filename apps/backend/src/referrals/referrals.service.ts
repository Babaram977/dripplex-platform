import { Injectable, Logger } from '@nestjs/common';
import {
  CampaignPromoterStatus,
  Prisma,
  ReferralOwnerType,
  ReferralRedemptionStatus,
  ReferralRefereeType,
} from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import { ConflictDomainException } from '../common/exceptions/domain.exception';
import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../events/domain-events';
import { PrismaService } from '../prisma/prisma.service';

import { isCampaignAttributable } from './campaign-promoter.constants';
import { generateReferralCode } from './referral-code.util';
import { ReferralLifecycleService } from './referral-lifecycle.service';
import {
  REFERRAL_AUDIT_ACTIONS,
  REFERRAL_CODE_MAX_GENERATION_ATTEMPTS,
  REFERRAL_CODE_PATTERN,
  REFERRAL_REWARD_AMOUNTS,
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
    private readonly lifecycle: ReferralLifecycleService,
  ) {}

  /**
   * The caller's referral code, created on first read.
   *
   * `ownerType` decides which wallet their reward is eventually paid into and
   * is fixed at creation. A user who already holds a code keeps the one they
   * have: `Referral.userId` is unique, so there is one code per person, and
   * silently re-pointing an existing code's payout because it was fetched
   * from a different app would move money a referrer already earned.
   */
  public async getOrCreateMyCode(
    userId: string,
    ownerType: ReferralOwnerType = ReferralOwnerType.CUSTOMER,
    context?: AuditContext,
  ): Promise<ReferralDto> {
    const existing = await this.prisma.referral.findUnique({ where: { userId } });
    if (existing) {
      return toReferralDto(existing);
    }

    for (let attempt = 0; attempt < REFERRAL_CODE_MAX_GENERATION_ATTEMPTS; attempt += 1) {
      try {
        const created = await this.prisma.referral.create({
          data: { userId, ownerType, code: generateReferralCode() },
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
    const [total, pending, rewarded, programme] = await Promise.all([
      this.prisma.referralRedemption.count({ where: { referralId: referral.id } }),
      // Everything still working toward its reward, which from the sharer's
      // side is one thing: a referral that has neither paid nor been refused.
      // Splitting "waiting on your friend" from "waiting on the hold" on a
      // sharer's screen would only invite them to chase the difference.
      this.prisma.referralRedemption.count({
        where: {
          referralId: referral.id,
          status: {
            in: [
              ReferralRedemptionStatus.PENDING,
              ReferralRedemptionStatus.QUALIFIED,
              ReferralRedemptionStatus.APPROVED,
            ],
          },
        },
      }),
      this.prisma.referralRedemption.count({
        where: { referralId: referral.id, status: ReferralRedemptionStatus.PAID },
      }),
      // Quoted from the customer programme, because that is what a shared code
      // pays: every referral code on the platform is redeemed at a customer's
      // registration. A merchant's or a fleet's reward is priced by its own
      // programme when that referee type becomes redeemable.
      this.lifecycle.programmeFor(ReferralRefereeType.CUSTOMER),
    ]);

    // What this person's code actually pays, which is not always the
    // programme's rate. A promoter enrolled on a live campaign earns their
    // campaign amount — that is the whole point of the 2026-09-13 ruling — and
    // quoting ₦150 on the screen of somebody who earns ₦350 would be the
    // screen lying about their own money.
    const participation = await this.activeCampaignRate(referral.userId);
    const programmeReferrer =
      programme === null
        ? REFERRAL_REWARD_AMOUNTS.REFERRER
        : Number(programme.referrerRewardAmount);

    return {
      code: referral.code,
      totalRedemptions: total,
      pendingRedemptions: pending,
      rewardedRedemptions: rewarded,
      // The referee's side never varies: the founder fixed it platform-wide so
      // no campaign can outbid another for the same acquisition.
      refereeRewardAmount:
        programme === null
          ? REFERRAL_REWARD_AMOUNTS.REFEREE
          : Number(programme.refereeRewardAmount),
      referrerRewardAmount: participation?.rewardAmountNgn ?? programmeReferrer,
      // Stated rather than inferred from the amount, so a campaign that happens
      // to pay the programme rate still reads as a campaign, and so the card
      // can say which one without a second call.
      campaignName: participation?.campaignName ?? null,
      // A points campaign pays in DX Points, and naira is the wrong unit to
      // print for it. Null here means "the naira figure above is the whole
      // story".
      campaignRewardPoints: participation?.rewardPoints ?? null,
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
   * Called from RegistrationService right after an account is created. Never
   * throws — an invalid, unknown, or self-referral code must not fail
   * registration; it's simply ignored (audited as a skip via the absence of a
   * created redemption).
   *
   * `refereeType` says what the new account is, and therefore which milestone
   * has to be met and what the referral is worth. It is recorded on the row
   * rather than derived later, because a customer who opens a shop next year
   * was still referred as a customer.
   */
  public async tryRedeemAtRegistration(
    refereeUserId: string,
    rawCode: string,
    context: AuditContext,
    refereeType: ReferralRefereeType = ReferralRefereeType.CUSTOMER,
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

      // A referral with no programme is still recorded. It cannot qualify —
      // nothing has agreed what it is worth — but throwing away the fact that
      // one person brought another to DrippleX because a configuration row is
      // missing loses something that cannot be reconstructed later.
      const programme = await this.lifecycle.programmeFor(refereeType);
      const expiresAt =
        programme === null
          ? null
          : new Date(Date.now() + programme.qualificationWindowDays * 24 * 60 * 60 * 1000);

      // Founder ruling, 2026-09-13: a promoter does not get a second code.
      // Their own referral code is the only thing they ever share, and being
      // enrolled on a campaign raises what that one code pays — ₦350 instead of
      // ₦150, never both. Take them off the campaign and it drops back.
      //
      // So the campaign participation is attached here, at registration, from
      // the code's owner. `advance()` then reads `campaignPromoterId` and pays
      // the promoter's configured amount in place of the programme rate; with
      // no participation it is null and the programme rate applies, exactly as
      // before. Nothing about the ₦150 path changes.
      const participation = await this.activeCampaignParticipation(referral.userId);

      const redemption = await this.prisma.referralRedemption.create({
        data: {
          referralId: referral.id,
          refereeUserId,
          refereeType,
          ...(participation === null ? {} : { campaignPromoterId: participation.id }),
          ...(expiresAt === null ? {} : { expiresAt }),
        },
      });

      await this.auditService.record(
        REFERRAL_AUDIT_ACTIONS.REDEEMED,
        { ...context, userId: refereeUserId },
        {
          resource: 'referral_redemption',
          resourceId: redemption.id,
          metadata: {
            referralId: referral.id,
            referrerId: referral.userId,
            refereeType,
            // Null for an ordinary referral. Present means this acquisition
            // will pay the campaign's rate, which is the thing an audit of a
            // ₦350 payment needs to be able to explain.
            campaignPromoterId: participation?.id ?? null,
          },
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
   * What a live campaign is paying this person, for display on their own card.
   *
   * Separate from `activeCampaignParticipation` because that one answers "which
   * participation attaches to a new acquisition" and needs only an id, while
   * this one is quoting money back to the person earning it and needs the
   * amount and the campaign's name.
   */
  private async activeCampaignRate(userId: string): Promise<{
    campaignName: string;
    rewardAmountNgn: number | null;
    rewardPoints: number | null;
  } | null> {
    const promoters = await this.prisma.campaignPromoter.findMany({
      where: { userId, status: CampaignPromoterStatus.ACTIVE },
      select: {
        rewardAmount: true,
        rewardPoints: true,
        promotion: { select: { name: true, status: true, deletedAt: true } },
      },
      orderBy: { addedAt: 'desc' },
    });
    const live = promoters.find((p) => isCampaignAttributable(p.promotion));
    if (live === undefined) {
      return null;
    }
    return {
      campaignName: live.promotion.name,
      rewardAmountNgn: live.rewardAmount === null ? null : Number(live.rewardAmount),
      rewardPoints: live.rewardPoints,
    };
  }

  /**
   * The campaign participation a referral code currently carries, or null.
   *
   * One campaign at a time is enforced at enrolment, so at most one row can
   * come back; `findFirst` rather than `findUnique` because the uniqueness is a
   * rule about live participations, not a database constraint the schema can
   * express (a promoter may hold many REMOVED rows from past campaigns).
   *
   * "Live" is `isCampaignAttributable`, shared with the token path, so a
   * campaign that has closed cannot keep paying its rate through one route
   * while refusing it through the other.
   */
  private async activeCampaignParticipation(
    referrerUserId: string,
  ): Promise<{ id: string } | null> {
    const promoters = await this.prisma.campaignPromoter.findMany({
      where: { userId: referrerUserId, status: CampaignPromoterStatus.ACTIVE },
      select: { id: true, promotion: { select: { status: true, deletedAt: true } } },
      orderBy: { addedAt: 'desc' },
    });
    const live = promoters.find((p) => isCampaignAttributable(p.promotion));
    return live === undefined ? null : { id: live.id };
  }

  /**
   * The referee just completed a ride, which is one of the things that can
   * qualify a customer referral.
   *
   * Called from ReferralRewardSubscriber on DOMAIN_EVENTS.RIDE_COMPLETED. It is
   * a prompt to look, not the rule itself — what qualifies a referral lives in
   * ReferralQualificationService, and the sweep asks the same question on its
   * own schedule. So a ride event lost to a restart costs nothing beyond the
   * delay until the next sweep.
   */
  public async handleRefereeRideCompleted(customerId: string): Promise<void> {
    const redemption = await this.prisma.referralRedemption.findUnique({
      where: { refereeUserId: customerId },
      select: { id: true, status: true },
    });
    if (redemption?.status !== ReferralRedemptionStatus.PENDING) {
      return;
    }
    await this.lifecycle.advance(redemption.id);
  }
}
