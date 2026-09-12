import { Injectable } from '@nestjs/common';
import {
  CampaignParticipantType,
  CampaignPromoterStatus,
  Prisma,
  PromotionStatus,
  type CampaignPromoter,
} from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import { generateCampaignToken } from './campaign-promoter-token.util';
import {
  CAMPAIGN_PROMOTER_AUDIT_ACTIONS,
  CAMPAIGN_TOKEN_MAX_GENERATION_ATTEMPTS,
  PARTICIPANT_OWNER_TYPE,
} from './campaign-promoter.constants';
import { ReferralsService } from './referrals.service';

/** Exactly one of these is set; the database CHECK is the guarantee. */
export interface PromoterReward {
  amountNgn?: number | undefined;
  points?: number | undefined;
}

export interface AddPromoterInput {
  promotionId: string;
  userId: string;
  participantType: CampaignParticipantType;
  reward: PromoterReward;
}

/**
 * DPX-PROMO-REF-001 — who promotes which campaign, and under which private
 * token.
 *
 * This service owns participation only. It never pays anybody: a promoter's
 * reward is raised by `ReferralLifecycleService` when an acquisition qualifies,
 * through the hold and anti-abuse screening that already exist. Keeping the two
 * apart is deliberate — a service that could both enrol a promoter and pay them
 * would be one place to get both wrong.
 */
@Injectable()
export class CampaignPromoterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly referrals: ReferralsService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Enrol somebody in a campaign and issue their private token.
   *
   * The `Referral` row is ensured *before* the participation is created, and
   * that ordering is the point rather than an implementation detail.
   * `ReferralRedemption.referralId` is NOT NULL, so an acquisition attributed to
   * a promoter who has no referral row cannot be written at all. Discovering
   * that at qualification means discovering it at payout time, on live money,
   * for somebody who has already done the work. Doing it here means the failure
   * is enrolment failing, which nobody has been paid for yet.
   */
  public async addPromoter(
    input: AddPromoterInput,
    adminUserId: string,
    context?: AuditContext,
  ): Promise<CampaignPromoter> {
    const reward = this.validateReward(input.reward);
    const campaign = await this.requireOpenCampaign(input.promotionId);

    // The owner type is derived from the participant class, never passed in:
    // it decides which wallet the reward is paid into, and a caller that could
    // choose it could route an influencer's reward into a merchant wallet.
    const ownerType = PARTICIPANT_OWNER_TYPE[input.participantType];
    await this.referrals.getOrCreateMyCode(input.userId, ownerType, context);

    const existing = await this.prisma.campaignPromoter.findUnique({
      where: { promotionId_userId: { promotionId: campaign.id, userId: input.userId } },
    });
    if (existing) {
      return await this.reinstate(existing, input, reward, adminUserId, context);
    }

    for (let attempt = 0; attempt < CAMPAIGN_TOKEN_MAX_GENERATION_ATTEMPTS; attempt += 1) {
      try {
        const created = await this.prisma.campaignPromoter.create({
          data: {
            promotionId: campaign.id,
            userId: input.userId,
            participantType: input.participantType,
            token: generateCampaignToken(),
            rewardAmount: reward.amountNgn ?? null,
            rewardPoints: reward.points ?? null,
            addedBy: adminUserId,
          },
        });
        await this.auditService.record(
          CAMPAIGN_PROMOTER_AUDIT_ACTIONS.ADDED,
          { ...context, userId: adminUserId },
          {
            resource: 'campaign_promoter',
            resourceId: created.id,
            metadata: {
              promotionId: campaign.id,
              promoterUserId: input.userId,
              participantType: input.participantType,
              rewardAmount: reward.amountNgn ?? null,
              rewardPoints: reward.points ?? null,
            },
          },
        );
        return created;
      } catch (error) {
        // Two different unique constraints can raise P2002 on this table, and
        // they mean opposite things. A `token` collision is a retryable
        // accident; a `(promotion_id, user_id)` collision means somebody else
        // enrolled this person while we were generating, and retrying it ten
        // times would turn one lost race into ten pointless round trips and
        // then a misleading "could not generate a unique token".
        if (this.isUniqueViolationOn(error, 'token')) {
          continue;
        }
        if (this.isUniqueViolationOn(error, 'promotion_id')) {
          throw new ConflictDomainException('That user is already a promoter on this campaign');
        }
        throw error;
      }
    }

    throw new ConflictDomainException('Could not generate a unique campaign token, please retry');
  }

  /**
   * Stop a promoter attracting new acquisitions.
   *
   * A status change, never a delete. Founder ruling: removing somebody ends
   * their future participation and leaves every historical referral and reward
   * record readable — which is also why the foreign keys are RESTRICT, so a
   * later attempt to tidy the row away fails loudly instead of taking the
   * attribution with it. The token is kept rather than cleared: it is what
   * historical rows were attributed through, and a removed promoter's past
   * acquisitions still have to be explainable.
   */
  public async removePromoter(
    promoterId: string,
    adminUserId: string,
    context?: AuditContext,
  ): Promise<CampaignPromoter> {
    const promoter = await this.prisma.campaignPromoter.findUnique({ where: { id: promoterId } });
    if (!promoter) {
      throw new NotFoundDomainException('Campaign promoter not found');
    }
    if (promoter.status === CampaignPromoterStatus.REMOVED) {
      return promoter;
    }

    const removed = await this.prisma.campaignPromoter.update({
      where: { id: promoterId },
      data: {
        status: CampaignPromoterStatus.REMOVED,
        removedAt: new Date(),
        removedBy: adminUserId,
      },
    });
    await this.auditService.record(
      CAMPAIGN_PROMOTER_AUDIT_ACTIONS.REMOVED,
      { ...context, userId: adminUserId },
      {
        resource: 'campaign_promoter',
        resourceId: removed.id,
        metadata: { promotionId: removed.promotionId, promoterUserId: removed.userId },
      },
    );
    return removed;
  }

  /**
   * Put a previously removed promoter back on the campaign, keeping their token.
   *
   * Re-adding cannot create a second row — `@@unique([promotionId, userId])`
   * forbids it — so the choice is between refusing and reinstating. Reinstating
   * with the *same* token is what keeps their history one series rather than
   * two: every acquisition they ever made for this campaign stays attributed to
   * one participation, before and after the gap.
   */
  private async reinstate(
    existing: CampaignPromoter,
    input: AddPromoterInput,
    reward: PromoterReward,
    adminUserId: string,
    context?: AuditContext,
  ): Promise<CampaignPromoter> {
    if (existing.status === CampaignPromoterStatus.ACTIVE) {
      throw new ConflictDomainException('That user is already an active promoter on this campaign');
    }
    const reinstated = await this.prisma.campaignPromoter.update({
      where: { id: existing.id },
      data: {
        status: CampaignPromoterStatus.ACTIVE,
        participantType: input.participantType,
        rewardAmount: reward.amountNgn ?? null,
        rewardPoints: reward.points ?? null,
        removedAt: null,
        removedBy: null,
        addedBy: adminUserId,
      },
    });
    await this.auditService.record(
      CAMPAIGN_PROMOTER_AUDIT_ACTIONS.ADDED,
      { ...context, userId: adminUserId },
      {
        resource: 'campaign_promoter',
        resourceId: reinstated.id,
        metadata: { reinstated: true, promotionId: reinstated.promotionId },
      },
    );
    return reinstated;
  }

  /**
   * Naira or DX Points, never both and never neither.
   *
   * The database CHECK is the guarantee; this exists so an operator gets a
   * sentence rather than a constraint name, and so a request carrying both is
   * refused before a row is attempted.
   */
  private validateReward(reward: PromoterReward): PromoterReward {
    const { amountNgn, points } = reward;
    if ((amountNgn === undefined) === (points === undefined)) {
      throw new ValidationDomainException(
        'A promoter earns either a naira amount or DX Points — set exactly one',
      );
    }
    if (amountNgn !== undefined && amountNgn <= 0) {
      throw new ValidationDomainException('A naira reward must be greater than zero');
    }
    if (points !== undefined && !(Number.isInteger(points) && points > 0)) {
      throw new ValidationDomainException('A points reward must be a whole number above zero');
    }
    return reward;
  }

  /**
   * A campaign somebody can still be enrolled on.
   *
   * Ended and archived campaigns are refused: issuing a token against a
   * campaign that can never attribute anything hands a promoter a code that
   * silently earns nothing, which they find out about when they ask why they
   * have not been paid.
   */
  private async requireOpenCampaign(promotionId: string): Promise<{ id: string }> {
    const campaign = await this.prisma.promotion.findFirst({
      where: { id: promotionId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!campaign) {
      throw new NotFoundDomainException('Campaign not found');
    }
    if (
      campaign.status === PromotionStatus.EXPIRED ||
      campaign.status === PromotionStatus.ARCHIVED ||
      campaign.status === PromotionStatus.CANCELLED
    ) {
      throw new ValidationDomainException(
        `Campaign is ${campaign.status} and cannot take new promoters`,
      );
    }
    return { id: campaign.id };
  }

  /**
   * Which unique constraint a P2002 came from.
   *
   * `meta.target` is Postgres's constraint description and Prisma types it as
   * `unknown`: it arrives as an array of column names in the common case, and
   * as a constraint-name string in others. Both shapes are handled, and
   * anything else returns false rather than being coerced — a wrong answer here
   * either retries a lost race ten times or reports a race as a token fault.
   */
  private isUniqueViolationOn(error: unknown, field: string): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      return false;
    }
    const target: unknown = error.meta?.['target'];
    const fields = Array.isArray(target)
      ? target.filter((t): t is string => typeof t === 'string')
      : typeof target === 'string'
        ? [target]
        : [];
    return fields.some((f) => f.includes(field));
  }
}
