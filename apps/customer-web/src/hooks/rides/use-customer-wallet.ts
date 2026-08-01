'use client';

import { useQuery } from '@tanstack/react-query';

import { sdk } from '../../lib/sdk';

import { rideQueryKeys } from './query-keys';

import type { WalletDto } from '@dripplex/types';
import type { UseQueryResult } from '@tanstack/react-query';

/**
 * Not Ride-specific — reuses the existing customer wallet endpoint
 * (pre-dates Ride) for the Wallet payment option's balance display.
 */
export function useCustomerWallet(): UseQueryResult<WalletDto> {
  return useQuery({
    queryKey: rideQueryKeys.wallet,
    queryFn: () => sdk.wallet.customerWallet(),
  });
}
