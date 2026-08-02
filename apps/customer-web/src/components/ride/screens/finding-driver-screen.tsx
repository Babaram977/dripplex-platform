'use client';

import * as React from 'react';

import { BackArrow, BottomSheet, MapCanvas, RideStatusBar } from '../ride-ui';

import { useCancelRide, useRide, useRideTracking } from '@/hooks/rides';

export function FindingDriverScreen({
  rideId,
  onBack,
}: {
  rideId: string;
  onBack: () => void;
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

  const status = ride.data?.status;

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#060E1C' }}
    >
      <div className="relative flex-shrink-0" style={{ height: 280 }}>
        <MapCanvas variant="finding" />
        <div className="absolute inset-0">
          <RideStatusBar />
          <div className="mt-3 px-5">
            <BackArrow onClick={onBack} />
          </div>
        </div>
      </div>
      <BottomSheet peek>
        <div className="flex flex-col items-center gap-5 px-5 pb-8 pt-2">
          {status === 'DRIVER_ASSIGNED' ? (
            <div className="text-center">
              <p
                className="mb-1 text-[20px] font-bold"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#47CF72' }}
              >
                Driver found!
              </p>
              <p
                className="text-[14px]"
                style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
              >
                Full driver tracking arrives in RIDE-003 Slice 2 — this ride is now dispatched for
                real.
              </p>
            </div>
          ) : status === 'NO_DRIVERS_FOUND' ? (
            <div className="text-center">
              <p
                className="mb-1 text-[20px] font-bold"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
              >
                No drivers available
              </p>
              <p
                className="text-[14px]"
                style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
              >
                No nearby drivers accepted this ride. Please try again shortly.
              </p>
            </div>
          ) : status === 'CANCELLED' ? (
            <div className="text-center">
              <p
                className="mb-1 text-[20px] font-bold"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
              >
                Ride cancelled
              </p>
            </div>
          ) : (
            <div className="text-center">
              <p
                className="mb-1 text-[20px] font-bold"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
              >
                Finding your driver{'.'.repeat(dots)}
              </p>
              <p
                className="text-[14px]"
                style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
              >
                Matching you with the nearest available driver
              </p>
            </div>
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
              style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
            >
              {cancelRide.isPending ? 'Cancelling…' : 'Cancel ride'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onBack}
              className="text-[14px] font-medium"
              style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
            >
              Back to Home
            </button>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
