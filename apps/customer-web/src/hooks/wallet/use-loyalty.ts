'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { sdk } from '../../lib/sdk';

import type {
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
