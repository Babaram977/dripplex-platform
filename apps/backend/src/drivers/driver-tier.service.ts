import { Injectable } from '@nestjs/common';
import { DriverTier, Prisma, RideCancelledBy, RideRatingRole, RideStatus } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import { ValidationDomainException } from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import type { DriverTierSetting } from '@prisma/client';

/** Best first — the highest tier a driver clears is the one they hold. */
const TIER_ORDER: DriverTier[] = [
  DriverTier.PLATINUM,
  DriverTier.GOLD,
  DriverTier.SILVER,
  DriverTier.STANDARD,
];

export interface DriverTierStanding {
  /**
   * Null when the driver has not reached the first tier yet.
   *
   * Founder decision 2026-09-11 raised STANDARD to 500 completed trips, so a
   * tier is something a driver *earns* rather than something they start with.
   * Reporting an unearned STANDARD would tell a brand-new driver they hold a
   * status they have not reached.
   */
  tier: DriverTier | null;
  /** Null alongside a null tier: the caller falls back to the platform rate. */
  commissionRate: number | null;
  completedTrips: number;
  ratedTrips: number;
  /** Null when nobody has rated this driver yet — not zero, which would read as "rated badly". */
  averageRating: number | null;
  cancellationRate: number;
  /** What the driver still needs for the next tier up, or null at the top. */
  nextTier: {
    tier: DriverTier;
    commissionRate: number;
    tripsToGo: number;
    ratedTripsToGo: number;
    ratingRequired: number;
  } | null;
}

export interface DriverTierSettingDto {
  tier: DriverTier;
  commissionRate: number;
  minCompletedTrips: number;
  minRatedTrips: number;
  minAverageRating: number;
  maxCancellationRate: number | null;
  active: boolean;
  updatedAt: string;
}

/**
 * DPX-TIER-001 — what a driver has earned, and therefore what DrippleX charges
 * them.
 *
 * Nora's specification, 2026-09-11: a tier is earned on **completed trips and
 * sustained customer rating together**, never on volume alone. A driver who has
 * done six hundred trips badly has not earned a discount.
 *
 * Two safeguards are the whole point of the design:
 *
 * - **A rated-trip floor separate from the trip count.** Three five-star trips
 *   make a 5.00 average and prove nothing. Silver needs 50 ratings behind its
 *   4.60, Gold 100 behind 4.70, Platinum 200 behind 4.80, so an average has to
 *   be sustained rather than lucky.
 * - **Every threshold is a database row.** Thresholds, ratings and the
 *   percentages themselves are Ops-configurable, because changing what DrippleX
 *   charges should never need a deployment.
 *
 * A tier is computed from the ledger of what actually happened rather than
 * stored on the driver. A cached tier is a number that drifts from the trips
 * and ratings it claims to summarise, and the rate it sets is money.
 *
 * Historical rides are untouched by any of this: `RidePaymentService` snapshots
 * the rate *and* the tier onto the ride when it settles, so a driver dropping
 * back to STANDARD never rewrites what a GOLD ride was charged.
 */
@Injectable()
export class DriverTierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /** The whole tier table, including retired tiers — Ops edits it here. */
  public async listSettings(): Promise<DriverTierSettingDto[]> {
    const settings = await this.prisma.driverTierSetting.findMany();
    return settings.sort(byTierOrder).map(toDto);
  }

  public async updateSetting(
    tier: DriverTier,
    input: {
      commissionRate?: number;
      minCompletedTrips?: number;
      minRatedTrips?: number;
      minAverageRating?: number;
      maxCancellationRate?: number | null;
      active?: boolean;
    },
    adminUserId: string,
    context: AuditContext = {},
  ): Promise<DriverTierSettingDto> {
    if (input.commissionRate !== undefined) {
      if (
        !Number.isFinite(input.commissionRate) ||
        input.commissionRate < 0 ||
        input.commissionRate >= 1
      ) {
        throw new ValidationDomainException(
          `Rate must be a fraction between 0 and 1 — 0.095 for 9.5%. Got ${String(input.commissionRate)}`,
        );
      }
    }
    if (input.minAverageRating !== undefined) {
      if (input.minAverageRating < 0 || input.minAverageRating > 5) {
        throw new ValidationDomainException('A rating bar has to sit between 0 and 5');
      }
    }

    const before = await this.prisma.driverTierSetting.findUnique({ where: { tier } });
    const updated = await this.prisma.driverTierSetting.update({
      where: { tier },
      data: {
        ...(input.commissionRate !== undefined
          ? { commissionRate: new Prisma.Decimal(input.commissionRate) }
          : {}),
        ...(input.minCompletedTrips !== undefined
          ? { minCompletedTrips: input.minCompletedTrips }
          : {}),
        ...(input.minRatedTrips !== undefined ? { minRatedTrips: input.minRatedTrips } : {}),
        ...(input.minAverageRating !== undefined
          ? { minAverageRating: new Prisma.Decimal(input.minAverageRating) }
          : {}),
        ...(input.maxCancellationRate !== undefined
          ? {
              maxCancellationRate:
                input.maxCancellationRate === null
                  ? null
                  : new Prisma.Decimal(input.maxCancellationRate),
            }
          : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
        updatedBy: adminUserId,
      },
    });

    await this.auditService.record(
      'driver_tier.updated',
      { ...context, userId: adminUserId },
      {
        resource: 'driver_tier_setting',
        resourceId: updated.id,
        metadata: {
          tier,
          previousRate: before === null ? null : Number(before.commissionRate),
          newRate: Number(updated.commissionRate),
        },
      },
    );

    return toDto(updated);
  }

  /**
   * The tier this driver holds right now, and what it takes to move up.
   *
   * Returns null when the tier table has not been seeded rather than throwing:
   * a missing configuration row must never stop a ride settling, and the caller
   * falls back to the platform rate.
   */
  public async standingFor(driverId: string): Promise<DriverTierStanding | null> {
    const settings = (await this.prisma.driverTierSetting.findMany({ where: { active: true } }))
      .slice()
      .sort(byTierOrder);
    if (settings.length === 0) {
      return null;
    }

    const [completedTrips, cancelledByDriver, ratings] = await Promise.all([
      this.prisma.ride.count({ where: { driverId, status: RideStatus.COMPLETED } }),
      this.prisma.ride.count({
        where: { driverId, status: RideStatus.CANCELLED, cancelledBy: RideCancelledBy.DRIVER },
      }),
      this.prisma.rideRating.aggregate({
        where: { rateeId: driverId, raterRole: RideRatingRole.CUSTOMER },
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ]);

    const ratedTrips = ratings._count._all;
    const averageRating = ratings._avg.rating;
    // Measured against everything the driver was assigned, not against
    // completed trips alone — otherwise cancelling more improves the ratio.
    const attempted = completedTrips + cancelledByDriver;
    const cancellationRate = attempted === 0 ? 0 : cancelledByDriver / attempted;

    // No fallback to the lowest tier. STANDARD now asks for 500 completed
    // trips, so a driver below that has earned nothing yet — handing them a
    // tier anyway would report a status they have not reached.
    const earned = settings.find((setting) =>
      this.qualifies(setting, { completedTrips, ratedTrips, averageRating, cancellationRate }),
    );

    return {
      tier: earned?.tier ?? null,
      commissionRate: earned === undefined ? null : Number(earned.commissionRate),
      completedTrips,
      ratedTrips,
      averageRating,
      cancellationRate: Math.round(cancellationRate * 10_000) / 10_000,
      nextTier: this.nextTier(settings, earned ?? null, completedTrips, ratedTrips),
    };
  }

  /**
   * The rate this driver's tier sets, or null when they have not earned one and
   * the caller should use the platform rate.
   */
  public async commissionRateFor(
    driverId: string,
  ): Promise<{ rate: number; tier: DriverTier } | null> {
    const standing = await this.standingFor(driverId);
    if (standing === null) {
      return null;
    }
    if (standing.tier === null || standing.commissionRate === null) {
      return null;
    }
    return { rate: standing.commissionRate, tier: standing.tier };
  }

  private qualifies(
    setting: DriverTierSetting,
    driver: {
      completedTrips: number;
      ratedTrips: number;
      averageRating: number | null;
      cancellationRate: number;
    },
  ): boolean {
    if (driver.completedTrips < setting.minCompletedTrips) {
      return false;
    }
    if (driver.ratedTrips < setting.minRatedTrips) {
      return false;
    }
    const bar = Number(setting.minAverageRating);
    if (bar > 0) {
      // An unrated driver has not met a rating bar — they have simply not been
      // measured, and that is not the same as clearing it.
      if (driver.averageRating === null || driver.averageRating < bar) {
        return false;
      }
    }
    if (setting.maxCancellationRate !== null) {
      if (driver.cancellationRate > Number(setting.maxCancellationRate)) {
        return false;
      }
    }
    return true;
  }

  private nextTier(
    settings: DriverTierSetting[],
    earned: DriverTierSetting | null,
    completedTrips: number,
    ratedTrips: number,
  ): DriverTierStanding['nextTier'] {
    const ascending = settings.slice().sort((a, b) => a.minCompletedTrips - b.minCompletedTrips);
    // A driver with no tier yet is working toward the first one, not the second.
    const next =
      earned === null
        ? ascending[0]
        : ascending.find((setting) => setting.minCompletedTrips > earned.minCompletedTrips);
    if (next === undefined) {
      return null;
    }

    return {
      tier: next.tier,
      commissionRate: Number(next.commissionRate),
      tripsToGo: Math.max(0, next.minCompletedTrips - completedTrips),
      ratedTripsToGo: Math.max(0, next.minRatedTrips - ratedTrips),
      ratingRequired: Number(next.minAverageRating),
    };
  }
}

/** Highest tier first, by the trip bar it asks for. */
function byTierOrder(a: DriverTierSetting, b: DriverTierSetting): number {
  const difference = b.minCompletedTrips - a.minCompletedTrips;
  return difference !== 0 ? difference : TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier);
}

function toDto(setting: DriverTierSetting): DriverTierSettingDto {
  return {
    tier: setting.tier,
    commissionRate: Number(setting.commissionRate),
    minCompletedTrips: setting.minCompletedTrips,
    minRatedTrips: setting.minRatedTrips,
    minAverageRating: Number(setting.minAverageRating),
    maxCancellationRate:
      setting.maxCancellationRate === null ? null : Number(setting.maxCancellationRate),
    active: setting.active,
    updatedAt: setting.updatedAt.toISOString(),
  };
}
