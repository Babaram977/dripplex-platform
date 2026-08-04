'use client';

import {
  SuperAppRideBottomSheet,
  SuperAppRideHeader,
  SuperAppRideStatusBanner,
  SuperAppRideTextButton,
} from '@dripplex/ui';
import * as React from 'react';

import { LiveMap } from '../live-map';

import { useCancelRide, useRide, useRideTracking } from '@/hooks/rides';

export function FindingDriverScreen({
  rideId,
  onBack,
  onDriverAssigned,
}: {
  rideId: string;
  onBack: () => void;
  onDriverAssigned: () => void;
}): React.JSX.Element {
  const ride = useRide(rideId);
  useRideTracking(rideId);
  const cancelRide = useCancelRide();
  const [dots, setDots] = React.useState(1);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setDots((previous) => (previous === 3 ? 1 : previous + 1));
    }, 500);
    return () => {
      clearInterval(interval);
    };
  }, []);

  // useRideTracking patches the cache on `ride:status` pushes, but the
  // gateway is documented best-effort — this short poll is the fallback so
  // dispatch outcomes still show up if the socket never connects.
  React.useEffect(() => {
    const status = ride.data?.status;
    if (status !== 'REQUESTED' && status !== 'SEARCHING') {
      return undefined;
    }
    const interval = setInterval(() => {
      void ride.refetch();
    }, 4000);
    return () => {
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-arm only when status category changes
  }, [ride.data?.status]);

  React.useEffect(() => {
    if (ride.data?.status === 'DRIVER_ASSIGNED') {
      onDriverAssigned();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the status itself changes
  }, [ride.data?.status]);

  const status = ride.data?.status;

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#060E1C' }}
    >
      <div className="relative flex-shrink-0" style={{ height: 280 }}>
        <LiveMap
          center={
            ride.data
              ? { latitude: ride.data.pickupLatitude, longitude: ride.data.pickupLongitude }
              : undefined
          }
          fallbackVariant="finding"
        />
        <SuperAppRideHeader onBack={onBack} floating />
      </div>
      <SuperAppRideBottomSheet peek>
        <div className="flex flex-col items-center gap-5 px-5 pb-8 pt-2">
          {status === 'NO_DRIVERS_FOUND' ? (
            <SuperAppRideStatusBanner
              title="No drivers available"
              subtitle="No nearby drivers accepted this ride. Please try again shortly."
            />
          ) : status === 'CANCELLED' ? (
            <SuperAppRideStatusBanner title="Ride cancelled" />
          ) : (
            <SuperAppRideStatusBanner
              title={`Finding your driver${'.'.repeat(dots)}`}
              subtitle="Matching you with the nearest available driver"
            />
          )}
          {status !== 'NO_DRIVERS_FOUND' &&
          status !== 'CANCELLED' &&
          status !== 'DRIVER_ASSIGNED' ? (
            <SuperAppRideTextButton
              label={cancelRide.isPending ? 'Cancelling…' : 'Cancel ride'}
              disabled={cancelRide.isPending}
              onClick={() => {
                cancelRide.mutate({ rideId });
              }}
            />
          ) : status !== 'DRIVER_ASSIGNED' ? (
            <SuperAppRideTextButton label="Back to Home" onClick={onBack} />
          ) : null}
        </div>
      </SuperAppRideBottomSheet>
    </div>
  );
}
