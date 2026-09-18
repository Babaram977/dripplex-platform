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
  isCampaignAttributable,
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

/**
 * What is left to say about a promoter once the row is gone.
 *
 * Deliberately not a `CampaignPromoter`: removal deletes the row, so returning
 * one would hand callers an object that no longer exists and invite a console
 * to render it as if it did. `detachedRedemptions` is what the removal cost —
 * how many historical attributions lost their link to this participation.
 */
export interface RemovedPromoter {
  id: string;
  promotionId: string;
  detachedRedemptions: number;
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

    // Since removal became a delete (founder ruling, 2026-09-18) an existing row
    // can only be a LIVE participation — there is no removed state to reinstate
    // from. Somebody taken off a campaign and added back gets a NEW row and a
    // NEW token; their old links stop working. That is a real consequence of
    // total removal rather than an oversight, and it is why this refuses by
    // name instead of quietly resurrecting anything.
    const existing = await this.prisma.campaignPromoter.findUnique({
      where: { promotionId_userId: { promotionId: campaign.id, userId: input.userId } },
    });
    if (existing) {
      throw new ConflictDomainException('That user is already an active promoter on this campaign');
    }

    // Founder ruling, 2026-09-13: one campaign at a time.
    //
    // A promoter shares their own referral code and nothing else, so that one
    // code has to mean exactly one rate. Two live participations would make
    // "what does this code pay?" unanswerable — the code belongs to the person,
    // not to a campaign, and nothing in the string says which one was intended.
    //
    // Refused by name rather than silently, because an operator who sees
    // "already on Pioneer Drivers" can go and remove them; one that just fails
    // tells them nothing about what to do next.
    await this.refuseIfAlreadyOnALiveCampaign(input.userId, campaign.id);

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
   * Take a promoter off a campaign. A DELETE, not a status change.
   *
   * FOUNDER RULING, 2026-09-18, reversing the earlier soft-removal decision:
   * "No soft removal in any campaign, removal should be completely, ops have
   * total control. If it has been trigger by ops there is a reason for that."
   *
   * The ruling came from what soft removal actually looked like on the desk:
   * promoters sitting in the campaign list as REMOVED with `0/0` and `₦0`,
   * justified by copy about attributions and earnings standing when there were
   * no attributions and no earnings to stand. Rows kept for a reason that did
   * not apply to them.
   *
   * WHAT IS DELETED AND WHAT SURVIVES. The participation row goes: the token,
   * the rate, the class. `ReferralRedemption` is the only table that points
   * here, its `campaignPromoterId` is nullable by design, and those rows record
   * money that actually moved into people's wallets — the wallet ledger holds
   * the matching entries. So they are DETACHED, not deleted: who referred whom,
   * what was paid, when it qualified and when it was paid all survive on the
   * redemption and its referral, which names the referrer independently of this
   * table. What is lost is the campaign → participation → token link on those
   * historical rows, and that is the price of the ruling rather than an
   * oversight.
   *
   * Detaching first is also what makes the delete possible at all: the FK is
   * `onDelete: Restrict`, so a bare delete of a promoter carrying attributions
   * would fail. One transaction, so a promoter is never left detached-but-alive.
   *
   * No guard on attributions or earnings. The ruling is explicit that an
   * operator who triggered this had a reason; the console states the
   * consequence before the click rather than refusing after it.
   */
  public async removePromoter(
    promoterId: string,
    adminUserId: string,
    context?: AuditContext,
  ): Promise<RemovedPromoter> {
    const promoter = await this.prisma.campaignPromoter.findUnique({ where: { id: promoterId } });
    if (!promoter) {
      throw new NotFoundDomainException('Campaign promoter not found');
    }

    const detached = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.referralRedemption.updateMany({
        where: { campaignPromoterId: promoterId },
        data: { campaignPromoterId: null },
      });
      await tx.campaignPromoter.delete({ where: { id: promoterId } });
      return count;
    });

    await this.auditService.record(
      CAMPAIGN_PROMOTER_AUDIT_ACTIONS.REMOVED,
      { ...context, userId: adminUserId },
      {
        resource: 'campaign_promoter',
        resourceId: promoter.id,
        metadata: {
          promotionId: promoter.promotionId,
          promoterUserId: promoter.userId,
          // The row is gone, so the audit entry is the only remaining record of
          // what it was and what removing it cost. `detachedRedemptions` is how
          // many historical attributions lost their link to this participation.
          token: promoter.token,
          participantType: promoter.participantType,
          detachedRedemptions: detached,
          deleted: true,
        },
      },
    );
    return { id: promoter.id, promotionId: promoter.promotionId, detachedRedemptions: detached };
  }

  /**
   * Naira or DX Points, never both and never neither.
   *
   * The database CHECK is the guarantee; this exists so an operator gets a
   * sentence rather than a constraint name, and so a request carrying both is
   * refused before a row is attempted.
   */
  /**
   * Refuse an enrolment for somebody already promoting a live campaign.
   *
   * "Live" is `isCampaignAttributable`, the same predicate attribution uses, so
   * a campaign that can no longer take acquisitions also no longer blocks a new
   * enrolment. A REMOVED participation never blocks: removing somebody is how
   * an operator frees them to be enrolled elsewhere.
   */
  private async refuseIfAlreadyOnALiveCampaign(
    userId: string,
    excludingPromotionId: string,
  ): Promise<void> {
    // The campaign being enrolled onto is excluded, and that exclusion is not
    // padding — it is the concurrent case. Two simultaneous enrolments of the
    // same person onto the *same* campaign both pass the `findUnique` above
    // seeing no row; the winner writes one; the loser then reaches this guard
    // and finds it. Without the exclusion the loser is told "already promoting
    // X — remove them from that campaign first" about the very campaign it was
    // enrolling onto, which reads as an instruction to undo the enrolment that
    // just succeeded. Excluded, the loser falls through to the unique
    // constraint on (promotion_id, user_id) and gets "already a promoter on
    // this campaign", which is what happened.
    //
    // A single-threaded call never reaches here with a row on this campaign —
    // `reinstate` returns first — which is why deleting this exclusion leaves
    // every deterministic test green. The race is 1 run in 8.
    const held = await this.prisma.campaignPromoter.findMany({
      where: {
        userId,
        status: CampaignPromoterStatus.ACTIVE,
        promotionId: { not: excludingPromotionId },
      },
      select: {
        promotion: { select: { name: true, status: true, deletedAt: true } },
      },
    });
    const live = held.find((row) => isCampaignAttributable(row.promotion));
    if (live !== undefined) {
      throw new ConflictDomainException(
        `Already promoting "${live.promotion.name}". A promoter shares one referral code, so it can only carry one campaign's rate — remove them from that campaign first.`,
      );
    }
  }

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
