'use client';

import * as React from 'react';

import { DriverCard, MapCanvas, RideHeader, StatusBanner } from '../ride-ui';

import { useCancelRide, useRideStatusTransition } from '@/hooks/rides';

/**
 * Generated screen — a base "Driver Arrived" was never received (only
 * DriverArrivedExtendedScreen and PassengerWaitingScreen were, both built
 * around a passenger-facing verify code and a waiting-fee timer). Neither
 * exists in the real backend: RIDE-002.10 explicitly locked "no mandatory
 * passenger OTP/PIN" (see ride-trip.service.ts) in favor of a GPS-proximity
 * gate on the driver's own "Start Ride" action, and there's no waiting-fee
 * concept anywhere in the schema. Starting the trip is entirely
 * driver-initiated — the customer has no action to take here beyond
 * waiting and, if needed, cancelling. Same visual language (card/header/
 * spacing/color) as every other screen, adapted to what the backend
 * actually does rather than what the mock assumed. See
 * docs/RIDE-003-GENERATED-SCREENS.md.
 */
export function DriverArrivedScreen({
  rideId,
  onBack,
  onStarted,
}: {
  rideId: string;
  onBack: () => void;
  onStarted: () => void;
}): React.JSX.Element {
  const cancelRide = useCancelRide();
  useRideStatusTransition(rideId, ['IN_PROGRESS'], onStarted);

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
          background: 'linear-gradient(to bottom, transparent 30%, rgba(10,22,40,.95) 70%)',
          zIndex: 1,
        }}
      />
      <div style={{ zIndex: 10 }}>
        <RideHeader onBack={onBack} floating />
      </div>
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-3xl px-5 pb-8 pt-5"
        style={{ background: '#0D1B2E', zIndex: 10, border: '1px solid rgba(255,255,255,.08)' }}
      >
        <div
          className="mx-auto mb-4 h-1 w-10 rounded-full"
          style={{ background: 'rgba(255,255,255,.08)' }}
        />
        <div className="mb-4 flex justify-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: 'rgba(43,172,82,.12)' }}
          >
            <span style={{ fontSize: 28 }}>🚗</span>
          </div>
        </div>
        <StatusBanner
          tone="success"
          title="Your driver has arrived"
          subtitle="Head to the pickup point — your driver will start the trip once you're both there."
        />
        <div className="my-4">
          <DriverCard />
        </div>
        <button
          type="button"
          onClick={() => {
            cancelRide.mutate({ rideId });
          }}
          disabled={cancelRide.isPending}
          className="w-full text-center text-[14px] font-medium"
          style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.38)' }}
        >
          {cancelRide.isPending ? 'Cancelling…' : 'Cancel ride'}
        </button>
      </div>
    </div>
  );
}
