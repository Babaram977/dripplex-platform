'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  LoyaltyEarnerPersona,
  LoyaltyEarningImpactDto,
  LoyaltyEarningProgrammeDto,
  UpdateLoyaltyEarningProgrammeRequest,
} from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

const loyaltyKeys = {
  earningProgrammes: ['loyalty-earning-programmes'] as const,
  earningImpact: ['loyalty-earning-impact'] as const,
};

export function useLoyaltyEarningProgrammes(): UseQueryResult<LoyaltyEarningProgrammeDto[]> {
  return useQuery({
    queryKey: loyaltyKeys.earningProgrammes,
    queryFn: () => sdk.adminLoyalty.earningProgrammes(),
  });
}

/**
 * What switching each programme on would commit DrippleX to.
 *
 * Fetched alongside the programmes rather than on demand, because the number
 * has to be on screen *before* somebody reaches for the switch. A blast radius
 * revealed after the click is not a warning.
 */
export function useLoyaltyEarningImpact(): UseQueryResult<LoyaltyEarningImpactDto[]> {
  return useQuery({
    queryKey: loyaltyKeys.earningImpact,
    queryFn: () => sdk.adminLoyalty.earningProgrammeImpact(),
  });
}

export function useUpdateLoyaltyEarningProgramme(): UseMutationResult<
  LoyaltyEarningProgrammeDto,
  unknown,
  { persona: LoyaltyEarnerPersona; body: UpdateLoyaltyEarningProgrammeRequest }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ persona, body }) => sdk.adminLoyalty.updateEarningProgramme(persona, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: loyaltyKeys.earningProgrammes });
      // A changed cap changes the worst case, so the warning has to follow.
      void queryClient.invalidateQueries({ queryKey: loyaltyKeys.earningImpact });
    },
  });
}
