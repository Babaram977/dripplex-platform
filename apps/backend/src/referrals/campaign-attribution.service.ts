import { Injectable, Logger } from '@nestjs/common';
import {
  CampaignPromoterStatus,
  Prisma,
  PromotionStatus,
  ReferralRefereeType,
  type CampaignPromoter,
} from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

import { normalizeCampaignToken } from './campaign-promoter-token.util';
import { CAMPAIGN_ATTRIBUTION_AUDIT_ACTIONS } from './campaign-promoter.constants';
import { ReferralLifecycleService } from './referral-lifecycle.service';

/**
 * Why an attribution attempt ended the way it did.
 *
 * Named outcomes rather than thrown errors, because none of these is a fault:
 * a customer arriving with a stale poster's token, or with a second promoter's
 * token after somebody else already acquired them, is ordinary traffic. The
 * self-serve path swallows everything into a log warning, which is right for a
 * best-effort step at registration and wrong here — Operations has to be able
 * to answer "why did my promoter not get credited for that signup?".
 */
export const ATTRIBUTION_OUTCOME = {
  /** A new acquisition was recorded against this promoter. */
  ATTRIBUTED: 'ATTRIBUTED',
  /** This exact promoter already acquired this customer. A repeat request. */
  ALREADY_ATTRIBUTED: 'ALREADY_ATTRIBUTED',
  /** Somebody else acquired them first. First valid attribution wins. */
  ALREADY_ACQUIRED: 'ALREADY_ACQUIRED',
  /** No live campaign token matches. */
  TOKEN_UNKNOWN: 'TOKEN_UNKNOWN',
  /** The promoter was removed from the campaign. */
  PROMOTER_INACTIVE: 'PROMOTER_INACTIVE',
  /** The campaign is paused, ended, archived or cancelled. */
  CAMPAIGN_CLOSED: 'CAMPAIGN_CLOSED',
  /** Somebody used their own token. */
  SELF_REFERRAL: 'SELF_REFERRAL',
} as const;

export type AttributionOutcome = (typeof ATTRIBUTION_OUTCOME)[keyof typeof ATTRIBUTION_OUTCOME];

export interface AttributionResult {
  outcome: AttributionOutcome;
  /** The redemption that holds the acquisition, when one exists. */
  redemptionId?: string;
  /** The promoter who holds it — not necessarily the one whose token was used. */
  campaignPromoterId?: string;
}

/**
 * DPX-PROMO-REF-001 — turning a private campaign token into an acquisition.
 *
 * This service records *who brought whom*. It pays nothing and discounts
 * nothing: the promoter's reward is raised later by `ReferralLifecycleService`
 * once the acquisition qualifies and clears its hold, and the referred
 * customer's 20% is a separate platform-wide promotion that reads the
 * acquisition rather than being created by it. Attribution establishes
 * eligibility; it does not spend anything, which is why it can run at
 * registration before anybody has been screened.
 */
@Injectable()
export class CampaignAttributionService {
  private readonly logger = new Logger(CampaignAttributionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: ReferralLifecycleService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Attribute a new customer to whoever's campaign token they arrived with.
   *
   * The database decides the winner, not this method. `refereeUserId` is unique
   * platform-wide, so two promoters racing to acquire the same customer end
   * with exactly one row however the timing falls; the loser reads back what
   * the winner wrote and is told `ALREADY_ACQUIRED`. Checking first and then
   * inserting would be a read-then-write that both racers pass.
   */
  public async attribute(
    refereeUserId: string,
    rawToken: string,
    context: AuditContext,
    refereeType: ReferralRefereeType = ReferralRefereeType.CUSTOMER,
  ): Promise<AttributionResult> {
    const token = normalizeCampaignToken(rawToken);
    const promoter = await this.prisma.campaignPromoter.findUnique({
      where: { token },
      include: { promotion: { select: { status: true, deletedAt: true } } },
    });

    if (!promoter) {
      return { outcome: ATTRIBUTION_OUTCOME.TOKEN_UNKNOWN };
    }
    if (promoter.userId === refereeUserId) {
      return { outcome: ATTRIBUTION_OUTCOME.SELF_REFERRAL };
    }
    if (promoter.status !== CampaignPromoterStatus.ACTIVE) {
      return { outcome: ATTRIBUTION_OUTCOME.PROMOTER_INACTIVE };
    }
    if (!this.isAttributable(promoter.promotion)) {
      return { outcome: ATTRIBUTION_OUTCOME.CAMPAIGN_CLOSED };
    }

    return await this.record(promoter, refereeUserId, refereeType, context);
  }

  private async record(
    promoter: CampaignPromoter,
    refereeUserId: string,
    refereeType: ReferralRefereeType,
    context: AuditContext,
  ): Promise<AttributionResult> {
    // The promoter's own Referral row is guaranteed by enrolment
    // (CampaignPromoterService), because referralId is NOT NULL. If it is
    // missing the enrolment is broken, and failing here is better than writing
    // an acquisition nobody can be paid for.
    const referral = await this.prisma.referral.findUnique({
      where: { userId: promoter.userId },
      select: { id: true },
    });
    if (!referral) {
      this.logger.error(
        `Campaign promoter ${promoter.id} has no referral row; attribution refused for ${refereeUserId}`,
      );
      return { outcome: ATTRIBUTION_OUTCOME.PROMOTER_INACTIVE };
    }

    const programme = await this.lifecycle.programmeFor(refereeType);
    const expiresAt =
      programme === null
        ? null
        : new Date(Date.now() + programme.qualificationWindowDays * 24 * 60 * 60 * 1000);

    try {
      const created = await this.prisma.referralRedemption.create({
        data: {
          referralId: referral.id,
          refereeUserId,
          refereeType,
          campaignPromoterId: promoter.id,
          ...(programme === null ? {} : { programmeId: programme.id }),
          ...(expiresAt === null ? {} : { expiresAt }),
        },
      });
      await this.auditService.record(
        CAMPAIGN_ATTRIBUTION_AUDIT_ACTIONS.ATTRIBUTED,
        { ...context, userId: refereeUserId },
        {
          resource: 'referral_redemption',
          resourceId: created.id,
          // The token is deliberately absent. It is a bearer credential —
          // anyone holding it has acquisitions attributed to this promoter —
          // and the Ops UI masks it for that reason. Writing it here in
          // plaintext, once per acquisition, put it somewhere with a much
          // broader audience than the one screen that shows it. The promoter
          // id resolves to the token in one lookup for anyone who needs it.
          metadata: {
            campaignPromoterId: promoter.id,
            promotionId: promoter.promotionId,
            promoterUserId: promoter.userId,
          },
        },
      );
      return {
        outcome: ATTRIBUTION_OUTCOME.ATTRIBUTED,
        redemptionId: created.id,
        campaignPromoterId: promoter.id,
      };
    } catch (error) {
      if (this.isRefereeAlreadyAcquired(error)) {
        return await this.resolveExisting(promoter, refereeUserId);
      }
      throw error;
    }
  }

  /**
   * Somebody else got there first — or this is the same request arriving twice.
   *
   * Read back the row that won and say which it was. The distinction matters to
   * a caller: a repeat of their own request is not a problem to report, while a
   * genuinely lost race is the answer to "why was my promoter not credited?".
   * Either way no second acquisition exists and no second reward can be raised,
   * because the unique constraint is what made this branch run.
   */
  private async resolveExisting(
    promoter: CampaignPromoter,
    refereeUserId: string,
  ): Promise<AttributionResult> {
    const winner = await this.prisma.referralRedemption.findUnique({
      where: { refereeUserId },
      select: { id: true, campaignPromoterId: true },
    });
    if (!winner) {
      // The row that caused the conflict is gone again. Nothing was written by
      // us and nothing is claimed; a retry is the caller's to make.
      return { outcome: ATTRIBUTION_OUTCOME.ALREADY_ACQUIRED };
    }
    const sameParticipation = winner.campaignPromoterId === promoter.id;
    return {
      outcome: sameParticipation
        ? ATTRIBUTION_OUTCOME.ALREADY_ATTRIBUTED
        : ATTRIBUTION_OUTCOME.ALREADY_ACQUIRED,
      redemptionId: winner.id,
      ...(winner.campaignPromoterId === null
        ? {}
        : { campaignPromoterId: winner.campaignPromoterId }),
    };
  }

  /**
   * A campaign that can still acquire.
   *
   * PAUSED is refused alongside the terminal states. Pausing a campaign that
   * kept quietly acquiring would mean an operator who paused their spend still
   * owing rewards for everything that arrived afterwards — the pause has to
   * stop the thing that costs money, not just the thing that is visible.
   */
  private isAttributable(promotion: { status: PromotionStatus; deletedAt: Date | null }): boolean {
    if (promotion.deletedAt !== null) {
      return false;
    }
    return (
      promotion.status === PromotionStatus.ACTIVE || promotion.status === PromotionStatus.SCHEDULED
    );
  }

  private isRefereeAlreadyAcquired(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      return false;
    }
    const target: unknown = error.meta?.['target'];
    const fields = Array.isArray(target)
      ? target.filter((t): t is string => typeof t === 'string')
      : typeof target === 'string'
        ? [target]
        : [];
    return fields.some((f) => f.includes('referee_user_id') || f.includes('refereeUserId'));
  }
}
