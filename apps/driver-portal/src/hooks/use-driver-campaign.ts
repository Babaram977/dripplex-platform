'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  DriverCampaignDashboardDto,
  DriverCampaignLeaderboardEntryDto,
  DriverReferralDto,
  ReferralCampaignDto,
} from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

const campaignKeys = {
  all: ['driver-campaign'] as const,
  code: () => [...campaignKeys.all, 'code'] as const,
  dashboard: () => [...campaignKeys.all, 'dashboard'] as const,
  leaderboard: () => [...campaignKeys.all, 'leaderboard'] as const,
};

export function useDriverCode(): UseQueryResult<{
  campaign: ReferralCampaignDto;
  referral: DriverReferralDto;
}> {
  return useQuery({
    queryKey: campaignKeys.code(),
    queryFn: () => sdk.driverCampaign.getMyCode(),
    retry: false,
  });
}

export function useDriverDashboard(): UseQueryResult<DriverCampaignDashboardDto> {
  return useQuery({
    queryKey: campaignKeys.dashboard(),
    queryFn: () => sdk.driverCampaign.getDashboard(),
    refetchInterval: 60_000,
  });
}

export function useDriverLeaderboard(): UseQueryResult<DriverCampaignLeaderboardEntryDto[]> {
  return useQuery({
    queryKey: campaignKeys.leaderboard(),
    queryFn: () => sdk.driverCampaign.getLeaderboard(),
    retry: false,
  });
}

export function useRecordInvite(): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => sdk.driverCampaign.recordInvite(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: campaignKeys.dashboard() });
    },
  });
}
