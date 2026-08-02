'use client';

import * as React from 'react';

import { MapCanvas, RideBottomSheet, RideHeader, StatusBanner } from '../ride-ui';

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
        <MapCanvas variant="finding" />
        <RideHeader onBack={onBack} floating />
      </div>
      <RideBottomSheet peek>
        <div className="flex flex-col items-center gap-5 px-5 pb-8 pt-2">
          {status === 'NO_DRIVERS_FOUND' ? (
            <StatusBanner
              title="No drivers available"
              subtitle="No nearby drivers accepted this ride. Please try again shortly."
            />
          ) : status === 'CANCELLED' ? (
            <StatusBanner title="Ride cancelled" />
          ) : (
            <StatusBanner
              title={`Finding your driver${'.'.repeat(dots)}`}
              subtitle="Matching you with the nearest available driver"
            />
          )}
          {status !== 'NO_DRIVERS_FOUND' &&
          status !== 'CANCELLED' &&
          status !== 'DRIVER_ASSIGNED' ? (
            <button
              type="button"
              onClick={() => {
                cancelRide.mutate({ rideId });
              }}
              disabled={cancelRide.isPending}
              className="text-[14px] font-medium"
              style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.5)' }}
            >
              {cancelRide.isPending ? 'Cancelling…' : 'Cancel ride'}
            </button>
          ) : status !== 'DRIVER_ASSIGNED' ? (
            <button
              type="button"
              onClick={onBack}
              className="text-[14px] font-medium"
              style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.5)' }}
            >
              Back to Home
            </button>
          ) : null}
        </div>
      </RideBottomSheet>
    </div>
  );
}
