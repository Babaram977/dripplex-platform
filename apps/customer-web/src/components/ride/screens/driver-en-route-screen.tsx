'use client';

import * as React from 'react';

import { DriverCard, MapCanvas, QuickActionButton, RideBottomSheet, RideHeader } from '../ride-ui';

import { useCancelRide, useRideStatusTransition, useRideTracking } from '@/hooks/rides';

export function DriverEnRouteScreen({
  rideId,
  onBack,
  onArrived,
  onStarted,
}: {
  rideId: string;
  onBack: () => void;
  onArrived: () => void;
  /** Safety net: if the driver starts the trip before this screen observes ARRIVED. */
  onStarted: () => void;
}): React.JSX.Element {
  const tracking = useRideTracking(rideId);
  const cancelRide = useCancelRide();
  useRideStatusTransition(rideId, ['ARRIVED', 'IN_PROGRESS'], (status) => {
    if (status === 'IN_PROGRESS') {
      onStarted();
    } else {
      onArrived();
    }
  });

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <div className="absolute inset-0 top-10" style={{ zIndex: 0 }}>
        <MapCanvas variant="assigned" />
      </div>
      <div
        className="absolute inset-0 top-10"
        style={{
          background: 'linear-gradient(to bottom, transparent 40%, rgba(10,22,40,.95) 100%)',
          zIndex: 1,
        }}
      />
      <div style={{ zIndex: 10 }}>
        <RideHeader onBack={onBack} floating />
      </div>
      <RideBottomSheet peek anchored>
        <div className="px-5 pb-8 pt-2">
          <div className="mb-3 flex items-center gap-2">
            <p
              className="text-[17px] font-bold"
              style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
            >
              Driver is on the way
            </p>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{
                background: tracking.connected ? 'rgba(43,172,82,.15)' : 'rgba(255,255,255,.06)',
                color: tracking.connected ? '#47CF72' : 'rgba(255,255,255,.5)',
                fontFamily: "'Inter',sans-serif",
              }}
            >
              {tracking.connected ? 'LIVE' : 'CONNECTING'}
            </span>
          </div>
          <div className="mb-4">
            <DriverCard />
          </div>
          <div className="mb-3 flex gap-3">
            <QuickActionButton icon="📞" label="Call" disabled />
            <QuickActionButton icon="💬" label="Chat" disabled />
            <QuickActionButton
              icon="❌"
              label="Cancel"
              tone="danger"
              disabled={cancelRide.isPending}
              onClick={() => {
                cancelRide.mutate({ rideId });
              }}
            />
          </div>
          <p
            className="text-center text-[11px]"
            style={{ fontFamily: "'Inter',sans-serif", color: '#F59E0B' }}
          >
            Free cancellation until the driver arrives
          </p>
        </div>
      </RideBottomSheet>
    </div>
  );
}
