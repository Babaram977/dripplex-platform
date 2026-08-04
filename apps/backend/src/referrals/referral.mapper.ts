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
  rewardedAt: string | null;
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
    rewardedAt: redemption.rewardedAt?.toISOString() ?? null,
    createdAt: redemption.createdAt.toISOString(),
  };
}
