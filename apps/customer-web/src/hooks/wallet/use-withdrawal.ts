'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { sdk } from '../../lib/sdk';

import { walletQueryKeys } from './query-keys';

import type {
  CreateWithdrawalRequest,
  PaginatedResult,
  WithdrawalHistoryQuery,
  WithdrawalRequestDto,
} from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

export function useWithdrawals(
  query: WithdrawalHistoryQuery = {},
): UseQueryResult<PaginatedResult<WithdrawalRequestDto>> {
  return useQuery({
    queryKey: walletQueryKeys.withdrawals(query),
    queryFn: () => sdk.wallet.listWithdrawals(query),
  });
}

export function useCreateWithdrawal(): UseMutationResult<
  WithdrawalRequestDto,
  Error,
  CreateWithdrawalRequest
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateWithdrawalRequest) => sdk.wallet.createWithdrawal(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: walletQueryKeys.balance });
      void queryClient.invalidateQueries({ queryKey: ['wallet', 'withdrawals'] });
    },
  });
}
