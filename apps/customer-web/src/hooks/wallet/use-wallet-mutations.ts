'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { sdk } from '../../lib/sdk';

import { walletQueryKeys } from './query-keys';

import type {
  FundWalletRequest,
  FundWalletResponse,
  SetWalletLimitsRequest,
  WalletDto,
  WalletRecipientDto,
  WalletTransferDto,
  WalletTransferRequest,
} from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

export function useTransferWallet(): UseMutationResult<
  WalletTransferDto,
  Error,
  WalletTransferRequest
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: WalletTransferRequest) => sdk.wallet.transfer(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: walletQueryKeys.balance });
    },
  });
}

export function useRecentTransferRecipients(): UseQueryResult<WalletRecipientDto[]> {
  return useQuery({
    queryKey: walletQueryKeys.recentRecipients,
    queryFn: () => sdk.wallet.recentTransferRecipients(),
  });
}

export function useLookupTransferRecipient(): UseMutationResult<
  WalletRecipientDto[],
  Error,
  string
> {
  return useMutation({
    mutationFn: (phone: string) => sdk.wallet.lookupTransferRecipient(phone),
  });
}

export function useFundWallet(): UseMutationResult<FundWalletResponse, Error, FundWalletRequest> {
  return useMutation({
    mutationFn: (body: FundWalletRequest) => sdk.wallet.fund(body),
  });
}

export function useVerifyWalletFunding(): UseMutationResult<WalletDto, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => sdk.wallet.verifyFunding(),
    onSuccess: (wallet) => {
      queryClient.setQueryData(walletQueryKeys.balance, wallet);
    },
  });
}

export function useSetWalletLimits(): UseMutationResult<WalletDto, Error, SetWalletLimitsRequest> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SetWalletLimitsRequest) => sdk.wallet.setLimits(body),
    onSuccess: (wallet) => {
      queryClient.setQueryData(walletQueryKeys.balance, wallet);
    },
  });
}
