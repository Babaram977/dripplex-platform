'use client';

import * as React from 'react';

import { useRide } from './use-ride';
import { useRideTracking } from './use-ride-tracking';

import type { RideStatus } from '@dripplex/types';

/**
 * Watches a ride's real status (WS push via useRideTracking, patched into
 * the same React Query cache useRide reads) and fires a callback the
 * moment it reaches one of `targets`. Used to drive screen transitions off
 * real backend state instead of local timers.
 */
export function useRideStatusTransition(
  rideId: string,
  targets: RideStatus[],
  onReached: (status: RideStatus) => void,
): RideStatus | undefined {
  const ride = useRide(rideId);
  useRideTracking(rideId);
  const status = ride.data?.status;

  React.useEffect(() => {
    if (status !== undefined && targets.includes(status)) {
      onReached(status);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the status itself changes
  }, [status]);

  return status;
}
