'use client';

import { useQuery } from '@tanstack/react-query';

import { sdk } from '../../lib/sdk';

import { walletQueryKeys } from './query-keys';

import type {
  PaginatedResult,
  WalletDto,
  WalletHistoryQuery,
  WalletLedgerEntryDto,
} from '@dripplex/types';
import type { UseQueryResult } from '@tanstack/react-query';

export function useWallet(): UseQueryResult<WalletDto> {
  return useQuery({
    queryKey: walletQueryKeys.balance,
    queryFn: () => sdk.wallet.customerWallet(),
  });
}

export function useWalletTransactions(
  query: WalletHistoryQuery = {},
): UseQueryResult<PaginatedResult<WalletLedgerEntryDto>> {
  return useQuery({
    queryKey: walletQueryKeys.transactions(query),
    queryFn: () => sdk.wallet.customerTransactions(query),
  });
}
