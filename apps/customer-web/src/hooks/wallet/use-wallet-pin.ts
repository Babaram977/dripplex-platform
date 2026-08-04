'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { sdk } from '../../lib/sdk';

import { walletQueryKeys } from './query-keys';

import type { ChangeWalletPinRequest, WalletPinStatusDto } from '@dripplex/types';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

export function useWalletPinStatus(): UseQueryResult<WalletPinStatusDto> {
  return useQuery({
    queryKey: walletQueryKeys.pinStatus,
    queryFn: () => sdk.wallet.pinStatus(),
  });
}

export function useSetWalletPin(): UseMutationResult<WalletPinStatusDto, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pin: string) => sdk.wallet.setPin(pin),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: walletQueryKeys.pinStatus });
    },
  });
}

export function useVerifyWalletPin(): UseMutationResult<{ valid: boolean }, Error, string> {
  return useMutation({
    mutationFn: (pin: string) => sdk.wallet.verifyPin(pin),
  });
}

export function useChangeWalletPin(): UseMutationResult<
  WalletPinStatusDto,
  Error,
  ChangeWalletPinRequest
> {
  return useMutation({
    mutationFn: (body: ChangeWalletPinRequest) => sdk.wallet.changePin(body),
  });
}
