'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  AcquisitionIncentiveDto,
  AddCampaignPromoterRequest,
  CampaignDetailDto,
  CampaignPromoterDto,
  CampaignSummaryDto,
  LoyaltySettingDto,
  RemoveCampaignPromoterResultDto,
} from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

const promotionKeys = {
  campaigns: ['operations-promotions-campaigns'] as const,
  campaign: (id: string) => ['operations-promotions-campaign', id] as const,
  acquisitionIncentive: ['operations-promotions-acquisition-incentive'] as const,
  loyaltySettings: ['loyalty-settings'] as const,
};

export function useCampaigns(): UseQueryResult<CampaignSummaryDto[]> {
  return useQuery({
    queryKey: promotionKeys.campaigns,
    queryFn: () => sdk.operationsPromotions.campaigns(),
  });
}

export function useCampaign(promotionId: string | null): UseQueryResult<CampaignDetailDto> {
  return useQuery({
    queryKey: promotionKeys.campaign(promotionId ?? ''),
    queryFn: () => sdk.operationsPromotions.campaign(promotionId ?? ''),
    enabled: promotionId !== null,
  });
}

export function useAcquisitionIncentive(): UseQueryResult<AcquisitionIncentiveDto> {
  return useQuery({
    queryKey: promotionKeys.acquisitionIncentive,
    queryFn: () => sdk.operationsPromotions.acquisitionIncentive(),
  });
}

/**
 * The canonical DX Points rate, for display only.
 *
 * Fetched rather than known. The console must never carry its own number here:
 * the rate moved from 200 to 100 on 2026-09-12 and a hardcoded copy would have
 * gone on quoting the old valuation against real balances. When this query
 * fails the correct display is points with no naira equivalent — see
 * `PointsValue` — not a guess.
 */
export function useLoyaltySettings(): UseQueryResult<LoyaltySettingDto> {
  return useQuery({
    queryKey: promotionKeys.loyaltySettings,
    queryFn: () => sdk.adminLoyalty.settings(),
  });
}

export function useAddPromoter(
  promotionId: string,
): UseMutationResult<CampaignPromoterDto, unknown, AddCampaignPromoterRequest> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => sdk.operationsPromotions.addPromoter(promotionId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: promotionKeys.campaign(promotionId) });
      // The list carries promoter counts and campaign rollups, so it is stale
      // the moment this succeeds.
      void queryClient.invalidateQueries({ queryKey: promotionKeys.campaigns });
    },
  });
}

/**
 * Deactivate a promoter.
 *
 * Refetches rather than patching the row in place. A removed promoter keeps
 * their token and their entire history, and the server decides what that row
 * now looks like — a client that flipped the badge itself could show ACTIVE
 * against a removal that was actually refused.
 */
export function useRemovePromoter(
  promotionId: string,
): UseMutationResult<RemoveCampaignPromoterResultDto, unknown, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (promoterId) => sdk.operationsPromotions.removePromoter(promoterId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: promotionKeys.campaign(promotionId) });
      void queryClient.invalidateQueries({ queryKey: promotionKeys.campaigns });
    },
  });
}
