import type { ListRidesQuery } from '@dripplex/sdk';

/** Centralized so every ride hook invalidates/reads the same cache entries. */
export const rideQueryKeys = {
  all: ['rides'] as const,
  lists: () => [...rideQueryKeys.all, 'list'] as const,
  list: (query: ListRidesQuery) => [...rideQueryKeys.lists(), query] as const,
  details: () => [...rideQueryKeys.all, 'detail'] as const,
  detail: (rideId: string) => [...rideQueryKeys.details(), rideId] as const,
  receipt: (rideId: string) => [...rideQueryKeys.all, 'receipt', rideId] as const,
  wallet: ['wallet', 'customer'] as const,
  addresses: ['addresses', 'customer'] as const,
  types: ['rides', 'types'] as const,
};
