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
 *
 * Also polls every 4s while the status hasn't reached a target yet — the
 * same fallback FindingDriverScreen and CashPaymentScreen each built for
 * themselves (the WS gateway is documented best-effort, and the socket URL
 * derivation is unverified against the real deployment topology; see
 * docs/RIDE-003-PRODUCTION-AUDIT.md 1.1). Centralized here so every screen
 * built on this hook inherits it instead of needing its own copy.
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

  React.useEffect(() => {
    if (status !== undefined && targets.includes(status)) {
      return undefined;
    }
    const interval = setInterval(() => {
      void ride.refetch();
    }, 4000);
    return () => {
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-arm only when status itself changes
  }, [status]);

  return status;
}
