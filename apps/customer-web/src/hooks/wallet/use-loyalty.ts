'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { sdk } from '../../lib/sdk';

import type {
  IssuedRedemptionCodeDto,
  LoyaltyAccountOverviewDto,
  LoyaltyRedemptionResultDto,
  ReferralDto,
  ReferralStatsDto,
} from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

export function useLoyaltyAccount(): UseQueryResult<LoyaltyAccountOverviewDto> {
  return useQuery({
    queryKey: ['loyalty', 'account'],
    queryFn: () => sdk.loyalty.account(),
  });
}

/**
 * Redeems DX points into the customer's wallet.
 *
 * Both the loyalty account and the wallet change, and both are cached — the
 * balance shown after a redemption has to be the one the backend just wrote,
 * not the one the screen was rendering a second ago, so every wallet query is
 * invalidated alongside the loyalty ones.
 */
export function useRedeemLoyaltyPoints(): UseMutationResult<
  LoyaltyRedemptionResultDto,
  Error,
  number
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (points: number) => sdk.loyalty.redeem({ points }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['loyalty'] }),
        queryClient.invalidateQueries({ queryKey: ['wallet'] }),
      ]);
    },
  });
}

/**
 * DPX-LOYALTY-002 — a one-time code authorising a merchant to take points at
 * their counter.
 *
 * The code comes back once and is never retrievable again: only its hash is
 * stored server-side. It is deliberately not cached in a query — a live
 * authorisation over somebody's balance should not be sitting in a cache that
 * outlives the screen showing it.
 */
export function useIssueRedemptionCode(): UseMutationResult<
  IssuedRedemptionCodeDto,
  Error,
  number
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (points: number) => sdk.loyalty.issueRedemptionCode({ points }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['loyalty'] });
    },
  });
}

export function useCancelRedemptionCode(): UseMutationResult<{ cancelled: number }, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => sdk.loyalty.cancelRedemptionCode(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['loyalty'] });
    },
  });
}

export function useReferralCode(): UseQueryResult<ReferralDto> {
  return useQuery({
    queryKey: ['referrals', 'me'],
    queryFn: () => sdk.referrals.me(),
  });
}

export function useReferralStats(): UseQueryResult<ReferralStatsDto> {
  return useQuery({
    queryKey: ['referrals', 'stats'],
    queryFn: () => sdk.referrals.stats(),
  });
}
