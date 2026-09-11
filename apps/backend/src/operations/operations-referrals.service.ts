import { Injectable } from '@nestjs/common';
import {
  DriverReferralRewardStatus,
  ReferralOwnerType,
  ReferralRedemptionStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import type { PaginatedResult } from '@dripplex/types';

export type ReferralPersona = 'CUSTOMER' | 'DRIVER' | 'RIDER' | 'MERCHANT' | 'FLEET_OWNER';

/**
 * One persona's referral programme, as a whole.
 *
 * `rewarded` is the number that matters commercially: a referral that was
 * redeemed but never qualified has cost nothing and earned nothing, and
 * reporting redemptions alone would make a programme look like it is working
 * when nobody has been paid.
 */
export interface ReferralPersonaPerformanceDto {
  persona: ReferralPersona;
  /** People holding a code for this persona. */
  referrers: number;
  /** Referrers who have had at least one code redeemed. */
  activeReferrers: number;
  redemptions: number;
  pendingRedemptions: number;
  rewardedRedemptions: number;
  /** rewarded / redemptions, 0 when nothing has been redeemed. */
  conversionRate: number;
}

/** One referrer's standing, for the leaderboard behind a persona. */
export interface ReferralPerformerDto {
  userId: string;
  name: string;
  persona: ReferralPersona;
  code: string;
  redemptions: number;
  rewardedRedemptions: number;
  /** Driver Growth Campaign only — null for personas with no reward programme. */
  rewardAmountEarned: number | null;
  rewardAmountUnpaid: number | null;
}

/**
 * The driver-refers-passenger campaign, which is a different programme from the
 * generic code above and has its own money.
 */
export interface DriverCampaignPerformanceDto {
  campaignId: string;
  campaignName: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  participatingDrivers: number;
  registeredPassengers: number;
  qualifiedPassengers: number;
  rewardsPending: { count: number; amount: number };
  rewardsApproved: { count: number; amount: number };
  rewardsPaid: { count: number; amount: number };
}

export interface ReferralOverviewDto {
  personas: ReferralPersonaPerformanceDto[];
  driverCampaigns: DriverCampaignPerformanceDto[];
  /** Personas the founder named that have no referral programme at all yet. */
  personasWithoutProgramme: string[];
}

const PERSONA_BY_OWNER: Record<ReferralOwnerType, ReferralPersona> = {
  [ReferralOwnerType.CUSTOMER]: 'CUSTOMER',
  [ReferralOwnerType.DRIVER]: 'DRIVER',
  [ReferralOwnerType.RIDER]: 'RIDER',
  [ReferralOwnerType.MERCHANT]: 'MERCHANT',
  [ReferralOwnerType.FLEET_OWNER]: 'FLEET_OWNER',
};

/**
 * DPX-OPS — referral performance, read one persona at a time.
 *
 * DrippleX has two referral programmes that look like one. The generic
 * `Referral` code is held by customers, drivers and riders, and its
 * `ownerType` decides which wallet a reward is paid into — so reporting them
 * together hides the thing Operations most needs to know, which is whose
 * programme is actually converting. The Driver Growth Campaign is separate
 * again: monthly, tiered, with its own approval queue and its own money.
 *
 * Both are reported here, apart, because they are apart.
 *
 * Every earning persona now has a programme (DPX-REFERRAL-002 gave merchants
 * and fleet owners theirs), so `personasWithoutProgramme` is empty — kept in
 * the contract rather than removed, because it is what stops a future persona
 * without a code being reported as a row of zeroes. A row of zeroes reads as
 * "nobody is referring" when the truth is "nobody can".
 */
@Injectable()
export class OperationsReferralsService {
  constructor(private readonly prisma: PrismaService) {}

  public async overview(): Promise<ReferralOverviewDto> {
    const [personas, driverCampaigns] = await Promise.all([
      this.personaPerformance(),
      this.driverCampaignPerformance(),
    ]);

    return {
      personas,
      driverCampaigns,
      personasWithoutProgramme: [],
    };
  }

  private async personaPerformance(): Promise<ReferralPersonaPerformanceDto[]> {
    const [referrerCounts, redemptions] = await Promise.all([
      this.prisma.referral.groupBy({ by: ['ownerType'], _count: { _all: true } }),
      this.prisma.referralRedemption.findMany({
        select: { status: true, referral: { select: { ownerType: true, userId: true } } },
      }),
    ]);

    const byPersona = new Map<
      ReferralPersona,
      { redemptions: number; pending: number; rewarded: number; referrers: Set<string> }
    >();
    for (const persona of Object.values(PERSONA_BY_OWNER)) {
      byPersona.set(persona, { redemptions: 0, pending: 0, rewarded: 0, referrers: new Set() });
    }

    for (const redemption of redemptions) {
      const persona = PERSONA_BY_OWNER[redemption.referral.ownerType];
      const bucket = byPersona.get(persona);
      if (bucket === undefined) {
        continue;
      }
      bucket.redemptions += 1;
      bucket.referrers.add(redemption.referral.userId);
      if (redemption.status === ReferralRedemptionStatus.PENDING) {
        bucket.pending += 1;
      }
      if (redemption.status === ReferralRedemptionStatus.REWARDED) {
        bucket.rewarded += 1;
      }
    }

    const referrersByOwner = new Map(
      referrerCounts.map((row) => [PERSONA_BY_OWNER[row.ownerType], row._count._all]),
    );

    return [...byPersona.entries()].map(([persona, bucket]) => ({
      persona,
      referrers: referrersByOwner.get(persona) ?? 0,
      activeReferrers: bucket.referrers.size,
      redemptions: bucket.redemptions,
      pendingRedemptions: bucket.pending,
      rewardedRedemptions: bucket.rewarded,
      conversionRate:
        bucket.redemptions === 0
          ? 0
          : Math.round((bucket.rewarded / bucket.redemptions) * 10_000) / 10_000,
    }));
  }

  private async driverCampaignPerformance(): Promise<DriverCampaignPerformanceDto[]> {
    const campaigns = await this.prisma.referralCampaign.findMany({
      orderBy: { periodStart: 'desc' },
      take: 12,
      include: {
        driverReferrals: { select: { id: true, statistics: true } },
        rewards: { select: { status: true, amount: true } },
      },
    });

    return campaigns.map((campaign) => {
      const registered = campaign.driverReferrals.reduce(
        (total, referral) => total + (referral.statistics?.registeredCount ?? 0),
        0,
      );
      const qualified = campaign.driverReferrals.reduce(
        (total, referral) => total + (referral.statistics?.qualifiedCount ?? 0),
        0,
      );

      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        status: campaign.status,
        periodStart: campaign.periodStart.toISOString(),
        periodEnd: campaign.periodEnd.toISOString(),
        participatingDrivers: campaign.driverReferrals.length,
        registeredPassengers: registered,
        qualifiedPassengers: qualified,
        rewardsPending: sumRewards(campaign.rewards, DriverReferralRewardStatus.PENDING),
        rewardsApproved: sumRewards(campaign.rewards, DriverReferralRewardStatus.APPROVED),
        rewardsPaid: sumRewards(campaign.rewards, DriverReferralRewardStatus.PAID),
      };
    });
  }

  /**
   * Who is actually referring, for one persona.
   *
   * Ranked on rewarded redemptions rather than raw ones: the founder's ask was
   * to "generate payout based on the result", and the result is what qualified,
   * not what was clicked.
   */
  public async performers(
    persona: ReferralPersona,
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<ReferralPerformerDto>> {
    const ownerType = ownerTypeFor(persona);

    const [referrals, total] = await Promise.all([
      this.prisma.referral.findMany({
        where: { ownerType },
        include: {
          user: { select: { firstName: true, lastName: true } },
          redemptions: { select: { status: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.referral.count({ where: { ownerType } }),
    ]);

    // Driver reward money lives in a different programme entirely; look it up
    // only for the drivers on this page rather than joining it in.
    const rewardsByDriver =
      persona === 'DRIVER'
        ? await this.driverRewardTotals(referrals.map((referral) => referral.userId))
        : new Map<string, { earned: number; unpaid: number }>();

    return {
      items: referrals.map((referral) => {
        const rewards = rewardsByDriver.get(referral.userId);
        return {
          userId: referral.userId,
          name: `${referral.user.firstName} ${referral.user.lastName}`.trim(),
          persona,
          code: referral.code,
          redemptions: referral.redemptions.length,
          rewardedRedemptions: referral.redemptions.filter(
            (redemption) => redemption.status === ReferralRedemptionStatus.REWARDED,
          ).length,
          rewardAmountEarned: rewards?.earned ?? null,
          rewardAmountUnpaid: rewards?.unpaid ?? null,
        };
      }),
      meta: {
        page,
        limit: pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
      },
    };
  }

  private async driverRewardTotals(
    driverIds: string[],
  ): Promise<Map<string, { earned: number; unpaid: number }>> {
    if (driverIds.length === 0) {
      return new Map();
    }

    const rewards = await this.prisma.referralReward.findMany({
      where: { driverId: { in: driverIds } },
      select: { driverId: true, amount: true, status: true },
    });

    const totals = new Map<string, { earned: number; unpaid: number }>();
    for (const driverId of driverIds) {
      totals.set(driverId, { earned: 0, unpaid: 0 });
    }
    for (const reward of rewards) {
      const bucket = totals.get(reward.driverId);
      if (bucket === undefined) {
        continue;
      }
      const amount = Number(reward.amount);
      // A rejected reward was never earned, and a pending one is not yet owed —
      // only what has been approved or paid counts as earned.
      if (reward.status === DriverReferralRewardStatus.PAID) {
        bucket.earned += amount;
      }
      if (reward.status === DriverReferralRewardStatus.APPROVED) {
        bucket.earned += amount;
        bucket.unpaid += amount;
      }
    }

    for (const bucket of totals.values()) {
      bucket.earned = Math.round(bucket.earned * 100) / 100;
      bucket.unpaid = Math.round(bucket.unpaid * 100) / 100;
    }
    return totals;
  }
}

function sumRewards(
  rewards: { status: DriverReferralRewardStatus; amount: { toString: () => string } }[],
  status: DriverReferralRewardStatus,
): { count: number; amount: number } {
  const matching = rewards.filter((reward) => reward.status === status);
  return {
    count: matching.length,
    amount:
      Math.round(matching.reduce((total, reward) => total + Number(reward.amount), 0) * 100) / 100,
  };
}

function ownerTypeFor(persona: ReferralPersona): ReferralOwnerType {
  const entry = (Object.entries(PERSONA_BY_OWNER) as [ReferralOwnerType, ReferralPersona][]).find(
    ([, mapped]) => mapped === persona,
  );
  return entry?.[0] ?? ReferralOwnerType.CUSTOMER;
}
