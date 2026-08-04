'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { sdk } from '../../lib/sdk';

import { walletQueryKeys } from './query-keys';

import type { AddBankAccountRequest, CustomerBankAccountDto } from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

export function useBankAccounts(): UseQueryResult<CustomerBankAccountDto[]> {
  return useQuery({
    queryKey: walletQueryKeys.bankAccounts,
    queryFn: () => sdk.wallet.listBankAccounts(),
  });
}

export function useAddBankAccount(): UseMutationResult<
  CustomerBankAccountDto,
  Error,
  AddBankAccountRequest
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AddBankAccountRequest) => sdk.wallet.addBankAccount(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: walletQueryKeys.bankAccounts });
    },
  });
}

export function useSetDefaultBankAccount(): UseMutationResult<
  CustomerBankAccountDto,
  Error,
  string
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sdk.wallet.setDefaultBankAccount(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: walletQueryKeys.bankAccounts });
    },
  });
}

export function useRemoveBankAccount(): UseMutationResult<{ removed: boolean }, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sdk.wallet.removeBankAccount(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: walletQueryKeys.bankAccounts });
    },
  });
}
