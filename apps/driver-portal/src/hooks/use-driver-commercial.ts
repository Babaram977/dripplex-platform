'use client';

import { useQuery } from '@tanstack/react-query';

import type {
  CommissionAccountDto,
  CommissionLedgerEntryDto,
  PaginatedResult,
} from '@dripplex/types';
import type { UseQueryResult } from '@tanstack/react-query';

import { sdk } from '@/lib/sdk';

/**
 * DPX-COMMERCIAL-001 Slice 5 — the driver's own commission account/ledger
 * (Ride cash commission owed, Slice 4). Mirrors `use-driver-wallet.ts`
 * exactly, backed by `DriverCommercialClient` instead of `WalletClient`.
 */
const commercialKeys = {
  all: ['driver-commercial'] as const,
  account: () => [...commercialKeys.all, 'account'] as const,
  ledger: (page: number, pageSize: number) =>
    [...commercialKeys.all, 'ledger', page, pageSize] as const,
};

export function useDriverCommercialAccount(): UseQueryResult<CommissionAccountDto> {
  return useQuery({
    queryKey: commercialKeys.account(),
    queryFn: () => sdk.commercial.getAccount(),
    refetchInterval: 60_000,
  });
}

export function useDriverCommercialLedger(
  page = 1,
  pageSize = 20,
): UseQueryResult<PaginatedResult<CommissionLedgerEntryDto>> {
  return useQuery({
    queryKey: commercialKeys.ledger(page, pageSize),
    queryFn: () => sdk.commercial.listLedger({ page, pageSize }),
  });
}
