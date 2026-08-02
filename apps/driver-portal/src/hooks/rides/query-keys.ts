import type { RideStatus } from '@dripplex/types';

export interface DriverRideListQuery {
  page?: number;
  limit?: number;
  status?: RideStatus;
}

/** Centralized so every ride hook invalidates/reads the same cache entries. */
export const rideQueryKeys = {
  all: ['driver-rides'] as const,
  availability: () => [...rideQueryKeys.all, 'availability'] as const,
  active: () => [...rideQueryKeys.all, 'active'] as const,
  offers: () => [...rideQueryKeys.all, 'offers'] as const,
  offerPreview: (offerId: string) => [...rideQueryKeys.all, 'offer-preview', offerId] as const,
  lists: () => [...rideQueryKeys.all, 'list'] as const,
  list: (query: DriverRideListQuery) => [...rideQueryKeys.lists(), query] as const,
};
