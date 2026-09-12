import { ValidationDomainException } from '../common/exceptions/domain.exception';

/**
 * DPX-PROMO-REF-001 — what a referral is worth, resolved once at qualification.
 *
 * Pure functions on purpose. What a referral pays is the most financially
 * sensitive arithmetic in this feature, and it should be assertable without a
 * database, a wallet or a clock. The *writing* of it is the lifecycle's job;
 * deciding it is this file's.
 */

export interface PromoterRewardConfig {
  /** Naira, when the campaign pays cash. Exactly one of these two is set. */
  rewardAmount: { toString: () => string } | number | null;
  /** DX Points, when the campaign pays points. */
  rewardPoints: number | null;
}

export interface ResolvedReward {
  /** Snapshotted into `referrerRewardAmount`. Null for a points reward. */
  referrerRewardAmount: number | null;
  /** Snapshotted into `referrerRewardPoints`. Null for a cash reward. */
  referrerRewardPoints: number | null;
  /**
   * The rate in force when this was resolved.
   *
   * Recorded for a points reward and only for a points reward, because it is
   * the only case where the naira figure has to be reconstructed later. DX
   * Points moved from 200 to 100 per naira on 2026-09-12; without the rate at
   * grant, a paid points reward would afterwards report a naira cost it never
   * had.
   */
  pointsPerNairaAtGrant: number | null;
}

/**
 * Naira to DX Points at the platform's canonical rate.
 *
 * `pointsPerNaira` is `loyalty_settings.points_per_naira`, read live and never
 * hardcoded here — increment 1 exists so there is exactly one place that number
 * lives. At the ruled 100:1 this gives ₦150 → 15,000, ₦200 → 20,000 and
 * ₦350 → 35,000.
 */
export function nairaToPoints(amountNgn: number, pointsPerNaira: number): number {
  if (!Number.isInteger(pointsPerNaira) || pointsPerNaira < 1) {
    throw new ValidationDomainException('The DX Points rate must be a whole number above zero');
  }
  const points = amountNgn * pointsPerNaira;
  if (!Number.isInteger(points)) {
    // A fractional point cannot be awarded and rounding one away is somebody's
    // money. Refusing is the honest failure.
    throw new ValidationDomainException(
      `₦${String(amountNgn)} is not a whole number of DX Points at ${String(pointsPerNaira)} per naira`,
    );
  }
  return points;
}

/**
 * What the promoter earns for one qualified acquisition.
 *
 * A campaign participation overrides the platform programme, which is the
 * founder's precedence: the campaign is what somebody was recruited under, and
 * a promoter told they would earn ₦350 must earn ₦350 even if the standing
 * programme says ₦150.
 *
 * An acquisition with no campaign behind it — the ordinary self-serve referral
 * — falls back to the programme, unchanged from before this feature existed.
 */
export function resolvePromoterReward(
  promoter: PromoterRewardConfig | null,
  programmeReferrerRewardNgn: number,
  pointsPerNaira: number,
): ResolvedReward {
  if (promoter === null) {
    return {
      referrerRewardAmount: programmeReferrerRewardNgn,
      referrerRewardPoints: null,
      pointsPerNairaAtGrant: null,
    };
  }

  const hasPoints = promoter.rewardPoints !== null;
  const hasAmount = promoter.rewardAmount !== null;
  if (hasPoints === hasAmount) {
    // The database CHECK makes this unreachable for a stored row. It is still
    // asserted rather than assumed, because reading a reward wrongly is money
    // and a silent `?? 0` here would pay nothing without saying so.
    throw new ValidationDomainException(
      'A campaign promoter must carry exactly one of a naira reward or a points reward',
    );
  }

  if (hasPoints) {
    if (!Number.isInteger(pointsPerNaira) || pointsPerNaira < 1) {
      throw new ValidationDomainException('The DX Points rate must be a whole number above zero');
    }
    return {
      referrerRewardAmount: null,
      referrerRewardPoints: promoter.rewardPoints,
      // Snapshotted only here. A cash reward has no conversion to preserve,
      // while a points reward's naira cost cannot be reconstructed later
      // without the rate that was in force — and that rate has already moved
      // once, from 200 to 100, on 2026-09-12.
      pointsPerNairaAtGrant: pointsPerNaira,
    };
  }
  return {
    referrerRewardAmount: toNumber(promoter.rewardAmount),
    referrerRewardPoints: null,
    pointsPerNairaAtGrant: null,
  };
}

/** Prisma hands back Decimal; tests and callers hand back number. */
function toNumber(value: { toString: () => string } | number | null): number {
  if (value === null) {
    throw new ValidationDomainException('A naira reward cannot be null here');
  }
  return typeof value === 'number' ? value : Number(value.toString());
}
