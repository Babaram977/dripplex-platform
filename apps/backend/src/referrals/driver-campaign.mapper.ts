import type {
  DriverReferral,
  PassengerReferral,
  ReferralCampaign,
  ReferralFraudCheck,
  ReferralReward,
  ReferralStatistics,
} from '@prisma/client';

export interface ReferralCampaignDto {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  requiredTripsPerPassenger: number;
  silverThreshold: number;
  silverRewardAmount: number;
  goldThreshold: number;
  goldRewardAmount: number;
  goldQualificationRate: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReferralStatisticsDto {
  invitesSent: number;
  registeredCount: number;
  qualifiedCount: number;
  completedTrips: number;
  currentTier: string;
}

export interface DriverReferralDto {
  id: string;
  campaignId: string;
  driverId: string;
  code: string;
  createdAt: string;
}

export interface DriverCampaignDashboardDto {
  campaign: ReferralCampaignDto | null;
  referral: DriverReferralDto | null;
  statistics: ReferralStatisticsDto | null;
  progressToSilver: number;
  progressToGold: number;
  estimatedRewardAmount: number;
  estimatedTier: string;
  campaignCountdownSeconds: number | null;
  rewardHistory: ReferralRewardDto[];
}

export interface PassengerReferralDto {
  id: string;
  driverReferralId: string;
  refereeUserId: string;
  status: string;
  completedTrips: number;
  qualifiedAt: string | null;
  createdAt: string;
}

export interface ReferralRewardDto {
  id: string;
  campaignId: string;
  driverId: string;
  tier: string;
  amount: number;
  qualifiedPassengerCount: number;
  status: string;
  approvedAt: string | null;
  paidAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

export interface ReferralFraudCheckDto {
  id: string;
  passengerReferralId: string | null;
  driverReferralId: string | null;
  checkType: string;
  status: string;
  details: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface LeaderboardEntryDto {
  driverId: string;
  driverName: string;
  code: string;
  registeredCount: number;
  qualifiedCount: number;
  currentTier: string;
}

export function toReferralCampaignDto(campaign: ReferralCampaign): ReferralCampaignDto {
  return {
    id: campaign.id,
    name: campaign.name,
    periodStart: campaign.periodStart.toISOString(),
    periodEnd: campaign.periodEnd.toISOString(),
    status: campaign.status,
    requiredTripsPerPassenger: campaign.requiredTripsPerPassenger,
    silverThreshold: campaign.silverThreshold,
    silverRewardAmount: Number(campaign.silverRewardAmount),
    goldThreshold: campaign.goldThreshold,
    goldRewardAmount: Number(campaign.goldRewardAmount),
    goldQualificationRate: Number(campaign.goldQualificationRate),
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
  };
}

export function toReferralStatisticsDto(stats: ReferralStatistics): ReferralStatisticsDto {
  return {
    invitesSent: stats.invitesSent,
    registeredCount: stats.registeredCount,
    qualifiedCount: stats.qualifiedCount,
    completedTrips: stats.completedTrips,
    currentTier: stats.currentTier,
  };
}

export function toDriverReferralDto(referral: DriverReferral): DriverReferralDto {
  return {
    id: referral.id,
    campaignId: referral.campaignId,
    driverId: referral.driverId,
    code: referral.code,
    createdAt: referral.createdAt.toISOString(),
  };
}

export function toPassengerReferralDto(referral: PassengerReferral): PassengerReferralDto {
  return {
    id: referral.id,
    driverReferralId: referral.driverReferralId,
    refereeUserId: referral.refereeUserId,
    status: referral.status,
    completedTrips: referral.completedTrips,
    qualifiedAt: referral.qualifiedAt?.toISOString() ?? null,
    createdAt: referral.createdAt.toISOString(),
  };
}

export function toReferralRewardDto(reward: ReferralReward): ReferralRewardDto {
  return {
    id: reward.id,
    campaignId: reward.campaignId,
    driverId: reward.driverId,
    tier: reward.tier,
    amount: Number(reward.amount),
    qualifiedPassengerCount: reward.qualifiedPassengerCount,
    status: reward.status,
    approvedAt: reward.approvedAt?.toISOString() ?? null,
    paidAt: reward.paidAt?.toISOString() ?? null,
    rejectionReason: reward.rejectionReason,
    createdAt: reward.createdAt.toISOString(),
  };
}

export function toReferralFraudCheckDto(check: ReferralFraudCheck): ReferralFraudCheckDto {
  return {
    id: check.id,
    passengerReferralId: check.passengerReferralId,
    driverReferralId: check.driverReferralId,
    checkType: check.checkType,
    status: check.status,
    details: check.details,
    reviewedAt: check.reviewedAt?.toISOString() ?? null,
    createdAt: check.createdAt.toISOString(),
  };
}
