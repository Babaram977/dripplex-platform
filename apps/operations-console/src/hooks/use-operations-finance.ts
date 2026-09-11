'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  OperationsPayoutQueueSummaryDto,
  OperationsPayoutRequestDto,
  OperationsReferralOverviewDto,
  PaginatedResult,
  PayoutRequestStatus,
  PayoutRequesterType,
  ReferralPerformerDto,
  ReferralPersona,
  ReferralProgrammeDto,
  ReferralRefereeType,
  ReferralRejectionReason,
  ReferralReviewItemDto,
  UpdateReferralProgrammeRequest,
} from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

const financeKeys = {
  payouts: (requesterType?: PayoutRequesterType, status?: PayoutRequestStatus) =>
    ['operations-payout-requests', requesterType ?? 'all', status ?? 'all'] as const,
  payoutSummary: ['operations-payout-summary'] as const,
  referrals: ['operations-referrals'] as const,
  performers: (persona: ReferralPersona) => ['operations-referral-performers', persona] as const,
  reviewQueue: ['operations-referral-review-queue'] as const,
  programmes: ['operations-referral-programmes'] as const,
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

/**
 * DPX-REFERRAL-003 — referrals that qualified but are waiting on a person.
 *
 * Refetched on the same 30s cadence as the payout queue, and for the same
 * reason: a referrer whose reward is held is waiting now. Performance figures
 * do not move minute to minute and are left alone.
 */
export function useReferralReviewQueue(): UseQueryResult<PaginatedResult<ReferralReviewItemDto>> {
  return useQuery({
    queryKey: financeKeys.reviewQueue,
    queryFn: () => sdk.operationsFinance.referralReviewQueue({ pageSize: 100 }),
    refetchInterval: 30_000,
  });
}

export function useReferralProgrammes(): UseQueryResult<ReferralProgrammeDto[]> {
  return useQuery({
    queryKey: financeKeys.programmes,
    queryFn: () => sdk.operationsFinance.referralProgrammes(),
  });
}

/**
 * The three decisions on a held referral.
 *
 * They go to `/admin/referrals/*` rather than the operations surface the queue
 * is read from, because that surface is read-only by design: an operator can
 * hold the queue without holding the grant to pay anybody. A console user
 * without `admin:referrals:manage` sees the queue and gets a refusal on the
 * button, which is the correct failure — the alternative is a screen that
 * quietly implies everyone can settle money.
 */
export function useReferralDecision(): UseMutationResult<
  { status: string },
  unknown,
  | { action: 'approve'; redemptionId: string; note?: string }
  | { action: 'reject'; redemptionId: string; reason: ReferralRejectionReason; note?: string }
  | { action: 'reverse'; redemptionId: string; reason: string }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input) => {
      if (input.action === 'approve') {
        return await sdk.adminReferrals.approve(input.redemptionId, input.note);
      }
      if (input.action === 'reject') {
        return await sdk.adminReferrals.reject(input.redemptionId, input.reason, input.note);
      }
      return await sdk.adminReferrals.reverse(input.redemptionId, input.reason);
    },
    onSuccess: () => {
      // The row leaves the queue and the persona figures move with it.
      void queryClient.invalidateQueries({ queryKey: financeKeys.reviewQueue });
      void queryClient.invalidateQueries({ queryKey: financeKeys.referrals });
    },
  });
}

export function useUpdateReferralProgramme(): UseMutationResult<
  ReferralProgrammeDto,
  unknown,
  { refereeType: ReferralRefereeType; body: UpdateReferralProgrammeRequest }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ refereeType, body }) => sdk.adminReferrals.updateProgramme(refereeType, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: financeKeys.programmes });
      // A changed hold changes when everything in the queue releases.
      void queryClient.invalidateQueries({ queryKey: financeKeys.reviewQueue });
    },
  });
}
