import type { Referral, ReferralRedemption } from '@prisma/client';

export interface ReferralDto {
  id: string;
  userId: string;
  code: string;
  createdAt: string;
}

export interface ReferralRedemptionDto {
  id: string;
  referralId: string;
  refereeUserId: string;
  status: string;
  /** What the referred party signed up as, which is what sets the milestone
   *  and the amount. */
  refereeType: string;
  /** Snapshotted when the referral qualified, so a later re-pricing of the
   *  programme never rewrites what this one was worth. Null until then. */
  referrerRewardAmount: number | null;
  refereeRewardAmount: number | null;
  qualifiedAt: string | null;
  approvedAt: string | null;
  /** Both wallets credited. Serialised as `rewardedAt` as well, because every
   *  existing client reads that name and a referral screen silently losing its
   *  paid date is worse than one redundant field. */
  paidAt: string | null;
  rewardedAt: string | null;
  rejectedAt: string | null;
  reversedAt: string | null;
  rejectionReason: string | null;
  /** An abuse signal that fired without refusing the referral — Operations
   *  looks at these during the hold. */
  flaggedReason: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface ReferralStatsDto {
  code: string;
  totalRedemptions: number;
  pendingRedemptions: number;
  rewardedRedemptions: number;
  /** What a referred friend earns for signing up with this code — read
   * from REFERRAL_REWARD_AMOUNTS so the frontend never hardcodes it. */
  refereeRewardAmount: number;
  /** What the sharer earns when that friend completes their first ride. The
   * referee amount was already served for exactly this reason; the screen
   * shows both numbers, so serving only one still left the other hardcoded
   * in the client — where it sat at the unapproved 500. */
  referrerRewardAmount: number;
}

export function toReferralDto(referral: Referral): ReferralDto {
  return {
    id: referral.id,
    userId: referral.userId,
    code: referral.code,
    createdAt: referral.createdAt.toISOString(),
  };
}

export function toReferralRedemptionDto(redemption: ReferralRedemption): ReferralRedemptionDto {
  return {
    id: redemption.id,
    referralId: redemption.referralId,
    refereeUserId: redemption.refereeUserId,
    status: redemption.status,
    refereeType: redemption.refereeType,
    referrerRewardAmount:
      redemption.referrerRewardAmount === null ? null : Number(redemption.referrerRewardAmount),
    refereeRewardAmount:
      redemption.refereeRewardAmount === null ? null : Number(redemption.refereeRewardAmount),
    qualifiedAt: redemption.qualifiedAt?.toISOString() ?? null,
    approvedAt: redemption.approvedAt?.toISOString() ?? null,
    paidAt: redemption.paidAt?.toISOString() ?? null,
    rewardedAt: redemption.paidAt?.toISOString() ?? null,
    rejectedAt: redemption.rejectedAt?.toISOString() ?? null,
    reversedAt: redemption.reversedAt?.toISOString() ?? null,
    rejectionReason: redemption.rejectionReason,
    flaggedReason: redemption.flaggedReason,
    expiresAt: redemption.expiresAt?.toISOString() ?? null,
    createdAt: redemption.createdAt.toISOString(),
  };
}
