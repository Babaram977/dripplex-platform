'use client';

import { useQuery } from '@tanstack/react-query';

import type {
  OperationsPayoutQueueSummaryDto,
  OperationsPayoutRequestDto,
  OperationsReferralOverviewDto,
  PaginatedResult,
  PayoutRequestStatus,
  PayoutRequesterType,
  ReferralPerformerDto,
  ReferralPersona,
} from '@dripplex/types';
import type { UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

const financeKeys = {
  payouts: (requesterType?: PayoutRequesterType, status?: PayoutRequestStatus) =>
    ['operations-payout-requests', requesterType ?? 'all', status ?? 'all'] as const,
  payoutSummary: ['operations-payout-summary'] as const,
  referrals: ['operations-referrals'] as const,
  performers: (persona: ReferralPersona) => ['operations-referral-performers', persona] as const,
};

/**
 * The payout queue is live work — a partner waiting to be paid is waiting now —
 * so this refetches on the same 30s cadence the other Operations queues use.
 * Referral performance does not move minute to minute and is left alone.
 */
export function useOperationsPayoutRequests(filters: {
  requesterType?: PayoutRequesterType;
  status?: PayoutRequestStatus;
}): UseQueryResult<PaginatedResult<OperationsPayoutRequestDto>> {
  return useQuery({
    queryKey: financeKeys.payouts(filters.requesterType, filters.status),
    queryFn: () =>
      sdk.operationsFinance.payoutRequests({
        pageSize: 100,
        ...(filters.requesterType === undefined ? {} : { requesterType: filters.requesterType }),
        ...(filters.status === undefined ? {} : { status: filters.status }),
      }),
    refetchInterval: 30_000,
  });
}

export function useOperationsPayoutSummary(): UseQueryResult<OperationsPayoutQueueSummaryDto> {
  return useQuery({
    queryKey: financeKeys.payoutSummary,
    queryFn: () => sdk.operationsFinance.payoutSummary(),
    refetchInterval: 30_000,
  });
}

export function useOperationsReferralOverview(): UseQueryResult<OperationsReferralOverviewDto> {
  return useQuery({
    queryKey: financeKeys.referrals,
    queryFn: () => sdk.operationsFinance.referralOverview(),
  });
}

export function useReferralPerformers(
  persona: ReferralPersona,
): UseQueryResult<PaginatedResult<ReferralPerformerDto>> {
  return useQuery({
    queryKey: financeKeys.performers(persona),
    queryFn: () => sdk.operationsFinance.referralPerformers(persona, { pageSize: 50 }),
  });
}
