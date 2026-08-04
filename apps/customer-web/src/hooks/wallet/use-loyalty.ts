'use client';

import { useQuery } from '@tanstack/react-query';

import { sdk } from '../../lib/sdk';

import type { LoyaltyAccountOverviewDto, ReferralDto, ReferralStatsDto } from '@dripplex/types';
import type { UseQueryResult } from '@tanstack/react-query';

export function useLoyaltyAccount(): UseQueryResult<LoyaltyAccountOverviewDto> {
  return useQuery({
    queryKey: ['loyalty', 'account'],
    queryFn: () => sdk.loyalty.account(),
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
