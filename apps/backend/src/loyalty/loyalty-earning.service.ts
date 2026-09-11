import { Injectable, Logger } from '@nestjs/common';
import { LoyaltyEarnerPersona, LoyaltyLedgerEntryType } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import { ValidationDomainException } from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import { LOYALTY_AUDIT_ACTIONS } from './loyalty.constants';
import { LoyaltyService } from './loyalty.service';

import type { LoyaltyEarningProgramme } from '@prisma/client';

export interface LoyaltyEarningProgrammeDto {
  persona: LoyaltyEarnerPersona;
  active: boolean;
  pointsPerCompletedJob: number;
  pointsPerQualifyingReview: number;
  minReviewRating: number;
  dailyPointsCap: number | null;
  updatedAt: string;
}

/**
 * DPX-LOYALTY-007 — whether a partner earns DX Points, and for what.
 *
 * Nora's policy, 2026-09-11: drivers and riders earn only under an approved
 * programme, merchants only where a campaign permits, fleets only via explicit
 * incentive programmes. All three say the same operational thing — a partner
 * earns nothing until somebody switches their programme on — so all three are
 * one table with one rule, rather than three mechanisms that would drift apart.
 *
 * Every programme is seeded inactive, which is not caution but the literal
 * truth of the platform before this: **no partner earned DX Points at all**. So
 * nothing here changes a balance until an operator decides it should.
 *
 * The founder's rule about reviews lives here too: *"review can boost driver dx
 * points but cannot affect the star rating."* Points are the reward; the rating
 * stays a measurement. Nothing in this service reads the rating engine and
 * nothing writes to it — a review arriving here only ever adds points.
 */
@Injectable()
export class LoyaltyEarningService {
  private readonly logger = new Logger(LoyaltyEarningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly loyalty: LoyaltyService,
  ) {}

  public async list(): Promise<LoyaltyEarningProgrammeDto[]> {
    const programmes = await this.prisma.loyaltyEarningProgramme.findMany({
      orderBy: { persona: 'asc' },
    });
    return programmes.map(toDto);
  }

  public async update(
    persona: LoyaltyEarnerPersona,
    input: {
      active?: boolean;
      pointsPerCompletedJob?: number;
      pointsPerQualifyingReview?: number;
      minReviewRating?: number;
      dailyPointsCap?: number | null;
    },
    adminUserId: string,
    context: AuditContext = {},
  ): Promise<LoyaltyEarningProgrammeDto> {
    assertWholePoints('pointsPerCompletedJob', input.pointsPerCompletedJob);
    assertWholePoints('pointsPerQualifyingReview', input.pointsPerQualifyingReview);
    if (input.minReviewRating !== undefined) {
      if (
        !Number.isInteger(input.minReviewRating) ||
        input.minReviewRating < 1 ||
        input.minReviewRating > 5
      ) {
        throw new ValidationDomainException('A review bar has to sit between 1 and 5 stars');
      }
    }
    if (
      input.dailyPointsCap !== undefined &&
      input.dailyPointsCap !== null &&
      (!Number.isInteger(input.dailyPointsCap) || input.dailyPointsCap < 1)
    ) {
      throw new ValidationDomainException(
        'A daily cap must be a whole number of at least 1 point, or null for no cap',
      );
    }

    const before = await this.prisma.loyaltyEarningProgramme.findUnique({ where: { persona } });
    if (before === null) {
      throw new ValidationDomainException(`There is no ${persona} earning programme`);
    }

    const updated = await this.prisma.loyaltyEarningProgramme.update({
      where: { persona },
      data: {
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.pointsPerCompletedJob !== undefined
          ? { pointsPerCompletedJob: input.pointsPerCompletedJob }
          : {}),
        ...(input.pointsPerQualifyingReview !== undefined
          ? { pointsPerQualifyingReview: input.pointsPerQualifyingReview }
          : {}),
        ...(input.minReviewRating !== undefined ? { minReviewRating: input.minReviewRating } : {}),
        ...(input.dailyPointsCap !== undefined ? { dailyPointsCap: input.dailyPointsCap } : {}),
        updatedBy: adminUserId,
      },
    });

    await this.auditService.record(
      LOYALTY_AUDIT_ACTIONS.EARNING_PROGRAMME_UPDATED,
      { ...context, userId: adminUserId },
      {
        resource: 'loyalty_earning_programme',
        resourceId: updated.id,
        metadata: {
          persona,
          previousActive: before.active,
          newActive: updated.active,
          previousPointsPerCompletedJob: before.pointsPerCompletedJob,
          newPointsPerCompletedJob: updated.pointsPerCompletedJob,
          previousPointsPerQualifyingReview: before.pointsPerQualifyingReview,
          newPointsPerQualifyingReview: updated.pointsPerQualifyingReview,
        },
      },
    );

    return toDto(updated);
  }

  /**
   * A partner finished a job.
   *
   * Never throws: loyalty is a reward on the side of the work, and a points
   * failure must not take a ride or an order down with it. The same reason the
   * customer-side subscriber has always swallowed its errors.
   */
  public async awardForCompletedJob(input: {
    persona: LoyaltyEarnerPersona;
    userId: string;
    referenceType: string;
    referenceId: string;
  }): Promise<void> {
    const programme = await this.programmeFor(input.persona);
    if (programme === null || programme.pointsPerCompletedJob <= 0) {
      return;
    }
    await this.award(programme, {
      userId: input.userId,
      points: programme.pointsPerCompletedJob,
      reason: `${labelFor(input.persona)} job completed`,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
    });
  }

  /**
   * A partner was reviewed well.
   *
   * Founder decision 2026-09-11: a review boosts DX Points and does not touch
   * the star rating. This method adds points and nothing else — it does not
   * read the rating average, cannot change it, and a review below the bar
   * simply earns nothing rather than deducting anything. A points system that
   * could subtract on a bad review would be a rating by another name.
   */
  public async awardForReview(input: {
    persona: LoyaltyEarnerPersona;
    userId: string;
    rating: number;
    referenceType: string;
    referenceId: string;
  }): Promise<void> {
    const programme = await this.programmeFor(input.persona);
    if (programme === null || programme.pointsPerQualifyingReview <= 0) {
      return;
    }
    if (input.rating < programme.minReviewRating) {
      return;
    }
    await this.award(programme, {
      userId: input.userId,
      points: programme.pointsPerQualifyingReview,
      reason: `${String(input.rating)}-star review`,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
    });
  }

  /** Null when the persona has no programme, or its programme is switched off. */
  private async programmeFor(
    persona: LoyaltyEarnerPersona,
  ): Promise<LoyaltyEarningProgramme | null> {
    const programme = await this.prisma.loyaltyEarningProgramme.findUnique({ where: { persona } });
    if (!programme?.active) {
      return null;
    }
    return programme;
  }

  private async award(
    programme: LoyaltyEarningProgramme,
    input: {
      userId: string;
      points: number;
      reason: string;
      referenceType: string;
      referenceId: string;
    },
  ): Promise<void> {
    try {
      // Exactly once per job or review. A replayed completion event must not
      // pay twice, and the reference pair is the only thing that can say so.
      const already = await this.prisma.loyaltyLedgerEntry.count({
        where: {
          account: { userId: input.userId },
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          points: { gt: 0 },
        },
      });
      if (already > 0) {
        return;
      }

      const allowed = await this.remainingUnderCap(programme, input.userId, input.points);
      if (allowed <= 0) {
        return;
      }

      await this.loyalty.awardPoints({
        userId: input.userId,
        points: allowed,
        reason: input.reason,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        // EARNED, not BONUS: this is points for doing the work the programme
        // rewards, which is the distinction DPX-LOYALTY-006 exists to keep.
        type: LoyaltyLedgerEntryType.EARNED,
        context: { userId: input.userId },
      });
    } catch (error) {
      // Loyalty is a reward beside the work, never a condition of it.
      this.logger.warn(
        `Partner loyalty award skipped for ${input.userId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  /**
   * How much of this award fits under the rolling daily cap.
   *
   * Partial rather than all-or-nothing: a driver who has 30 points of headroom
   * left should get 30, not zero. Rolling 24 hours rather than a calendar day,
   * for the same reason the cash-out cap is — a midnight boundary lets somebody
   * take two days' worth in a few minutes.
   */
  private async remainingUnderCap(
    programme: LoyaltyEarningProgramme,
    userId: string,
    points: number,
  ): Promise<number> {
    if (programme.dailyPointsCap === null) {
      return points;
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const earned = await this.prisma.loyaltyLedgerEntry.aggregate({
      where: {
        account: { userId },
        type: LoyaltyLedgerEntryType.EARNED,
        points: { gt: 0 },
        createdAt: { gte: since },
      },
      _sum: { points: true },
    });
    const alreadyEarned = earned._sum.points ?? 0;
    return Math.max(0, Math.min(points, programme.dailyPointsCap - alreadyEarned));
  }
}

function labelFor(persona: LoyaltyEarnerPersona): string {
  switch (persona) {
    case LoyaltyEarnerPersona.DRIVER:
      return 'Driver';
    case LoyaltyEarnerPersona.RIDER:
      return 'Rider';
    case LoyaltyEarnerPersona.MERCHANT:
      return 'Merchant';
    case LoyaltyEarnerPersona.FLEET_OWNER:
      return 'Fleet';
  }
}

function toDto(programme: LoyaltyEarningProgramme): LoyaltyEarningProgrammeDto {
  return {
    persona: programme.persona,
    active: programme.active,
    pointsPerCompletedJob: programme.pointsPerCompletedJob,
    pointsPerQualifyingReview: programme.pointsPerQualifyingReview,
    minReviewRating: programme.minReviewRating,
    dailyPointsCap: programme.dailyPointsCap,
    updatedAt: programme.updatedAt.toISOString(),
  };
}

function assertWholePoints(field: string, value: number | undefined): void {
  if (value === undefined) {
    return;
  }
  if (!Number.isInteger(value) || value < 0) {
    throw new ValidationDomainException(`${field} must be a whole number of points, zero or more`);
  }
}
