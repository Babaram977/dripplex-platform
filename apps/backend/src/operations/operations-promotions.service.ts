import { Injectable } from '@nestjs/common';
import {
  CampaignPromoterStatus,
  PromotionStatus,
  ReferralRedemptionStatus,
  ReferralRefereeType,
  RideStatus,
  type CampaignParticipantType,
} from '@prisma/client';

import { NotFoundDomainException } from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignPromoterService } from '../referrals/campaign-promoter.service';
import {
  UNIVERSAL_ACQUISITION_INCENTIVE_ID,
  UNIVERSAL_ACQUISITION_INCENTIVE_MAX_RIDES,
} from '../rides/acquisition-incentive.constants';

import type { AuditContext } from '../audit/audit.service';

export interface CampaignPerformance {
  totalReferrals: number;
  qualifiedReferrals: number;
  firstCompletedRides: number;
  /** Qualified over total, 0-1. Null when nothing has been referred yet. */
  conversionRate: number | null;
  rewardsEarnedNgn: number;
  rewardsPendingNgn: number;
  rewardsPaidNgn: number;
  rewardsEarnedPoints: number;
}

export interface PromoterRow {
  id: string;
  userId: string;
  name: string;
  participantType: CampaignParticipantType;
  token: string;
  status: CampaignPromoterStatus;
  addedAt: Date;
  removedAt: Date | null;
  rewardAmountNgn: number | null;
  rewardPoints: number | null;
  performance: CampaignPerformance;
}

/**
 * DPX-PROMO-REF-001 — what the Ops Promotions tab reads and writes.
 *
 * Deliberately thin. Every number here is an aggregate of rows the referral
 * and promotion services already own, and every mutation delegates to
 * `CampaignPromoterService`. No money is decided here: a reward is whatever the
 * campaign row says and whatever the redemption snapshotted, and a second
 * opinion in the Ops layer would be a second source of truth for what somebody
 * earned.
 */
@Injectable()
export class OperationsPromotionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promoters: CampaignPromoterService,
  ) {}

  /** Campaigns that carry promoters, newest first, each with its rollup. */
  public async listCampaigns(): Promise<
    {
      id: string;
      name: string;
      status: PromotionStatus;
      startsAt: Date | null;
      endsAt: Date | null;
      promoterCount: number;
      performance: CampaignPerformance;
    }[]
  > {
    const campaigns = await this.prisma.promotion.findMany({
      where: { deletedAt: null, campaignPromoters: { some: {} } },
      select: { id: true, name: true, status: true, startsAt: true, endsAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return await Promise.all(
      campaigns.map(async (c) => ({
        ...c,
        promoterCount: await this.prisma.campaignPromoter.count({ where: { promotionId: c.id } }),
        performance: await this.performanceFor({ promotionId: c.id }),
      })),
    );
  }

  public async getCampaign(promotionId: string): Promise<{
    id: string;
    name: string;
    status: PromotionStatus;
    startsAt: Date | null;
    endsAt: Date | null;
    performance: CampaignPerformance;
    promoters: PromoterRow[];
  }> {
    const campaign = await this.prisma.promotion.findFirst({
      where: { id: promotionId, deletedAt: null },
      select: { id: true, name: true, status: true, startsAt: true, endsAt: true },
    });
    if (!campaign) {
      throw new NotFoundDomainException('Campaign not found');
    }
    const rows = await this.prisma.campaignPromoter.findMany({
      where: { promotionId },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { addedAt: 'desc' },
    });
    const promoters = await Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        userId: r.userId,
        name: `${r.user.firstName} ${r.user.lastName}`.trim(),
        participantType: r.participantType,
        // The private token is shown here and nowhere else. This endpoint is
        // behind PROMOTIONS_READ; no promoter-facing route returns another
        // promoter's token, because a token is what earns the money.
        token: r.token,
        status: r.status,
        addedAt: r.addedAt,
        removedAt: r.removedAt,
        rewardAmountNgn: r.rewardAmount === null ? null : Number(r.rewardAmount),
        rewardPoints: r.rewardPoints,
        performance: await this.performanceFor({ campaignPromoterId: r.id }),
      })),
    );
    return { ...campaign, performance: await this.performanceFor({ promotionId }), promoters };
  }

  public async addPromoter(
    promotionId: string,
    input: {
      userId: string;
      participantType: CampaignParticipantType;
      rewardAmountNgn?: number | undefined;
      rewardPoints?: number | undefined;
    },
    adminUserId: string,
    context: AuditContext,
  ): Promise<PromoterRow> {
    const created = await this.promoters.addPromoter(
      {
        promotionId,
        userId: input.userId,
        participantType: input.participantType,
        reward: { amountNgn: input.rewardAmountNgn, points: input.rewardPoints },
      },
      adminUserId,
      context,
    );
    const detail = await this.getCampaign(promotionId);
    const row = detail.promoters.find((p) => p.id === created.id);
    if (!row) {
      throw new NotFoundDomainException('Promoter not found after creation');
    }
    return row;
  }

  public async removePromoter(
    promoterId: string,
    adminUserId: string,
    context: AuditContext,
  ): Promise<{ id: string; status: CampaignPromoterStatus; removedAt: Date | null }> {
    const removed = await this.promoters.removePromoter(promoterId, adminUserId, context);
    return { id: removed.id, status: removed.status, removedAt: removed.removedAt };
  }

  /**
   * How much the universal acquisition incentive has been used.
   *
   * Read-only and separate from campaign configuration on purpose: it is one
   * platform-wide promotion, and the Promotions tab must be able to show what
   * it costs without offering a way to create a second one per campaign.
   */
  public async acquisitionIncentiveUsage(): Promise<{
    promotionId: string;
    status: PromotionStatus | null;
    percentOff: number | null;
    maxDiscountedRides: number;
    refereeRewardNgn: number | null;
    discountedRides: number;
    customersBenefiting: number;
    totalDiscountNgn: number;
  }> {
    const promotion = await this.prisma.promotion.findUnique({
      where: { id: UNIVERSAL_ACQUISITION_INCENTIVE_ID },
      select: { status: true, percentOff: true },
    });
    // The referee's signup reward is the *other* thing a new customer gets, and
    // the one most often confused with this discount. Read from the programme
    // row so the two amounts cannot drift apart in a display.
    const programme = await this.prisma.referralProgramme.findUnique({
      where: { refereeType: ReferralRefereeType.CUSTOMER },
      select: { refereeRewardAmount: true },
    });
    const rides = await this.prisma.ride.findMany({
      where: {
        promotionId: UNIVERSAL_ACQUISITION_INCENTIVE_ID,
        status: { notIn: [RideStatus.CANCELLED, RideStatus.NO_DRIVERS_FOUND] },
      },
      select: { customerId: true, promoDiscount: true },
    });
    const percentOff = promotion?.percentOff ?? null;
    const refereeReward = programme?.refereeRewardAmount ?? null;
    return {
      promotionId: UNIVERSAL_ACQUISITION_INCENTIVE_ID,
      status: promotion?.status ?? null,
      percentOff: percentOff === null ? null : Number(percentOff),
      maxDiscountedRides: UNIVERSAL_ACQUISITION_INCENTIVE_MAX_RIDES,
      refereeRewardNgn: refereeReward === null ? null : Number(refereeReward),
      discountedRides: rides.length,
      customersBenefiting: new Set(rides.map((r) => r.customerId)).size,
      totalDiscountNgn: rides.reduce((sum, r) => sum + Number(r.promoDiscount), 0),
    };
  }

  /**
   * One rollup, for a whole campaign or for one promoter.
   *
   * `firstCompletedRides` is counted from the rides table rather than inferred
   * from the redemption's status: qualification also accepts a completed
   * marketplace order, so "qualified" and "took their first ride" are different
   * questions and Operations asked for both.
   */
  private async performanceFor(
    scope: { promotionId: string } | { campaignPromoterId: string },
  ): Promise<CampaignPerformance> {
    const where =
      'promotionId' in scope
        ? { campaignPromoter: { promotionId: scope.promotionId } }
        : { campaignPromoterId: scope.campaignPromoterId };

    const redemptions = await this.prisma.referralRedemption.findMany({
      where,
      select: {
        refereeUserId: true,
        status: true,
        referrerRewardAmount: true,
        referrerRewardPoints: true,
      },
    });
    const qualifiedStates: ReferralRedemptionStatus[] = [
      ReferralRedemptionStatus.QUALIFIED,
      ReferralRedemptionStatus.APPROVED,
      ReferralRedemptionStatus.PAID,
    ];
    const qualified = redemptions.filter((r) => qualifiedStates.includes(r.status));
    const referees = redemptions.map((r) => r.refereeUserId);
    const firstCompletedRides =
      referees.length === 0
        ? 0
        : (
            await this.prisma.ride.groupBy({
              by: ['customerId'],
              where: { customerId: { in: referees }, status: RideStatus.COMPLETED },
            })
          ).length;

    const ngn = (rows: typeof redemptions): number =>
      rows.reduce((sum, r) => sum + Number(r.referrerRewardAmount ?? 0), 0);

    return {
      totalReferrals: redemptions.length,
      qualifiedReferrals: qualified.length,
      firstCompletedRides,
      conversionRate: redemptions.length === 0 ? null : qualified.length / redemptions.length,
      rewardsEarnedNgn: ngn(qualified),
      rewardsPendingNgn: ngn(
        redemptions.filter(
          (r) =>
            r.status === ReferralRedemptionStatus.QUALIFIED ||
            r.status === ReferralRedemptionStatus.APPROVED,
        ),
      ),
      rewardsPaidNgn: ngn(redemptions.filter((r) => r.status === ReferralRedemptionStatus.PAID)),
      rewardsEarnedPoints: qualified.reduce((sum, r) => sum + (r.referrerRewardPoints ?? 0), 0),
    };
  }
}
