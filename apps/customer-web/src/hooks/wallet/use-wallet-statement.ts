'use client';

import { useQuery } from '@tanstack/react-query';

import { sdk } from '../../lib/sdk';

import { walletQueryKeys } from './query-keys';

import type { WalletStatementDto } from '@dripplex/types';
import type { UseQueryResult } from '@tanstack/react-query';

export function useWalletStatement(
  month: number,
  year: number,
): UseQueryResult<WalletStatementDto> {
  return useQuery({
    queryKey: walletQueryKeys.statement(month, year),
    queryFn: () => sdk.wallet.statement(month, year),
  });
}

export async function downloadWalletStatement(month: number, year: number): Promise<void> {
  const blob = await sdk.wallet.exportStatement(month, year);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `wallet-statement-${String(year)}-${String(month).padStart(2, '0')}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
