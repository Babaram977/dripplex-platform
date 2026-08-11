'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  MerchantApprovalDto,
  MerchantDetailResponse,
  MerchantKycDto,
  MerchantStatus,
  PaginatedMerchantsResult,
} from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

const merchantKeys = {
  listPrefix: ['admin-merchants'] as const,
  list: (status: MerchantStatus | 'ALL') => ['admin-merchants', status] as const,
  detail: (id: string) => ['admin-merchant', id] as const,
};

/** DPX-MERCHANT-001 — merchant onboarding applications/roster for the Ops
 * Console review screen. Defaults to the full list; pass a status to scope to
 * a queue. */
export function useMerchantApplications(
  status?: MerchantStatus,
): UseQueryResult<PaginatedMerchantsResult> {
  return useQuery({
    queryKey: merchantKeys.list(status ?? 'ALL'),
    queryFn: () => sdk.adminMerchants.listMerchants(status !== undefined ? { status } : {}),
    refetchInterval: 15_000,
  });
}

/** The admin merchant endpoints key on the merchant's USER id (`merchantId`),
 * not the merchant-profile id — the list rows link with `merchantId`. */
export function useMerchantReview(merchantId: string): UseQueryResult<MerchantDetailResponse> {
  return useQuery({
    queryKey: merchantKeys.detail(merchantId),
    queryFn: () => sdk.adminMerchants.getMerchant(merchantId),
  });
}

function useMerchantMutation<TArgs, TResult>(
  merchantId: string,
  mutationFn: (args: TArgs) => Promise<TResult>,
): UseMutationResult<TResult, Error, TArgs> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: merchantKeys.detail(merchantId) });
      void queryClient.invalidateQueries({ queryKey: merchantKeys.listPrefix });
    },
  });
}

export function useVerifyMerchantKyc(
  merchantId: string,
): UseMutationResult<MerchantKycDto, Error, string | undefined> {
  return useMerchantMutation(merchantId, (remarks: string | undefined) =>
    sdk.adminMerchants.verifyKyc(merchantId, remarks),
  );
}

export function useRejectMerchantKyc(
  merchantId: string,
): UseMutationResult<MerchantKycDto, Error, string> {
  return useMerchantMutation(merchantId, (remarks: string) =>
    sdk.adminMerchants.rejectKyc(merchantId, remarks),
  );
}

export function useApproveMerchant(
  merchantId: string,
): UseMutationResult<MerchantApprovalDto, Error, void> {
  return useMerchantMutation(merchantId, () => sdk.adminMerchants.approve(merchantId));
}

export function useRejectMerchant(
  merchantId: string,
): UseMutationResult<MerchantApprovalDto, Error, string> {
  return useMerchantMutation(merchantId, (reason: string) =>
    sdk.adminMerchants.reject(merchantId, reason),
  );
}

export function useSuspendMerchant(
  merchantId: string,
): UseMutationResult<MerchantApprovalDto, Error, string> {
  return useMerchantMutation(merchantId, (reason: string) =>
    sdk.adminMerchants.suspend(merchantId, reason),
  );
}

export function useReactivateMerchant(
  merchantId: string,
): UseMutationResult<MerchantApprovalDto, Error, void> {
  return useMerchantMutation(merchantId, () => sdk.adminMerchants.reactivate(merchantId));
}
