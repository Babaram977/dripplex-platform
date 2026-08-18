'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AdminUtilityPurchaseQuery } from '@dripplex/sdk';
import type {
  AdminUtilityPurchaseDto,
  PaginatedResult,
  ResolveUtilityPurchaseRequest,
  UtilityFloatStatusDto,
} from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

const utilitiesKeys = {
  float: ['admin-utilities-float'] as const,
  purchases: (query: AdminUtilityPurchaseQuery) => ['admin-utilities-purchases', query] as const,
};

/**
 * The provider float.
 *
 * Polled, unlike the pricing table, because this one genuinely is a live
 * figure: the float is shared by every utility purchase on the platform, and
 * it running dry fails all four services at once. A stale number here is the
 * difference between topping up before customers notice and finding out from
 * the support queue.
 */
export function useUtilityFloat(): UseQueryResult<UtilityFloatStatusDto> {
  return useQuery({
    queryKey: utilitiesKeys.float,
    queryFn: () => sdk.adminUtilities.getFloat(),
    refetchInterval: 60_000,
  });
}

export function useUtilityPurchases(
  query: AdminUtilityPurchaseQuery = {},
): UseQueryResult<PaginatedResult<AdminUtilityPurchaseDto>> {
  return useQuery({
    queryKey: utilitiesKeys.purchases(query),
    queryFn: () => sdk.adminUtilities.listPurchases(query),
  });
}

/** An operator's verdict on a purchase the provider never answered for. */
export function useResolveUtilityPurchase(): UseMutationResult<
  AdminUtilityPurchaseDto,
  Error,
  { id: string; body: ResolveUtilityPurchaseRequest }
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ResolveUtilityPurchaseRequest }) =>
      sdk.adminUtilities.resolvePurchase(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-utilities-purchases'] });
    },
  });
}
