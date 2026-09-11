'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  CommissionCampaignDto,
  CommissionCampaignStatus,
  CommissionScope,
  CreateCommissionCampaignRequest,
  PaginatedResult,
  UpdateCommissionCampaignRequest,
} from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

const campaignKeys = {
  all: ['admin-commission-campaigns'] as const,
  list: (scope?: CommissionScope, status?: CommissionCampaignStatus) =>
    ['admin-commission-campaigns', scope ?? 'all', status ?? 'all'] as const,
};

/**
 * DPX-COMMISSION-001 — the commission campaigns Ops is running.
 *
 * No refetch interval, for the same reason the fare table has none: one
 * operator editing a rate while another's screen rewrites the form under them
 * is worse than a figure a minute out of date. Mutations invalidate the list.
 */
export function useCommissionCampaigns(filters: {
  scope?: CommissionScope;
  status?: CommissionCampaignStatus;
}): UseQueryResult<PaginatedResult<CommissionCampaignDto>> {
  return useQuery({
    queryKey: campaignKeys.list(filters.scope, filters.status),
    queryFn: () =>
      sdk.adminCommissionCampaigns.list({
        pageSize: 100,
        ...(filters.scope === undefined ? {} : { scope: filters.scope }),
        ...(filters.status === undefined ? {} : { status: filters.status }),
      }),
  });
}

function useCampaignMutation<TArgs>(
  mutationFn: (args: TArgs) => Promise<CommissionCampaignDto>,
): UseMutationResult<CommissionCampaignDto, Error, TArgs> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: campaignKeys.all });
    },
  });
}

export function useCreateCommissionCampaign(): UseMutationResult<
  CommissionCampaignDto,
  Error,
  CreateCommissionCampaignRequest
> {
  return useCampaignMutation((body: CreateCommissionCampaignRequest) =>
    sdk.adminCommissionCampaigns.create(body),
  );
}

export function useUpdateCommissionCampaign(): UseMutationResult<
  CommissionCampaignDto,
  Error,
  { id: string; body: UpdateCommissionCampaignRequest }
> {
  return useCampaignMutation(
    ({ id, body }: { id: string; body: UpdateCommissionCampaignRequest }) =>
      sdk.adminCommissionCampaigns.update(id, body),
  );
}

export function usePauseCommissionCampaign(): UseMutationResult<
  CommissionCampaignDto,
  Error,
  string
> {
  return useCampaignMutation((id: string) => sdk.adminCommissionCampaigns.pause(id));
}

export function useResumeCommissionCampaign(): UseMutationResult<
  CommissionCampaignDto,
  Error,
  string
> {
  return useCampaignMutation((id: string) => sdk.adminCommissionCampaigns.resume(id));
}

export function useArchiveCommissionCampaign(): UseMutationResult<
  CommissionCampaignDto,
  Error,
  string
> {
  return useCampaignMutation((id: string) => sdk.adminCommissionCampaigns.archive(id));
}
