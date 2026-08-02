'use client';

import { useQuery } from '@tanstack/react-query';

import type {
  PaginatedResult,
  WalletDto,
  WalletHistoryQuery,
  WalletLedgerEntryDto,
} from '@dripplex/types';
import type { UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

const walletKeys = {
  all: ['driver-wallet'] as const,
  balance: () => [...walletKeys.all, 'balance'] as const,
  transactions: (query: WalletHistoryQuery) => [...walletKeys.all, 'transactions', query] as const,
};

export function useDriverWallet(): UseQueryResult<WalletDto> {
  return useQuery({
    queryKey: walletKeys.balance(),
    queryFn: () => sdk.wallet.driverWallet(),
    refetchInterval: 60_000,
  });
}

export function useDriverWalletTransactions(
  query: WalletHistoryQuery = {},
): UseQueryResult<PaginatedResult<WalletLedgerEntryDto>> {
  return useQuery({
    queryKey: walletKeys.transactions(query),
    queryFn: () => sdk.wallet.driverTransactions(query),
  });
}
