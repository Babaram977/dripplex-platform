'use client';

import * as React from 'react';

import {
  BackArrow,
  MapCanvas,
  QuickActionButton,
  RideBottomSheet,
  RideStatusBar,
} from '../ride-ui';

import { useRide, useRideTracking } from '@/hooks/rides';
import { formatDistance, haversineMeters } from '@/lib/geo';

export function LiveTrackingScreen({
  rideId,
  onBack,
}: {
  rideId: string;
  onBack: () => void;
}): React.JSX.Element {
  const ride = useRide(rideId);
  const tracking = useRideTracking(rideId);

  let distanceRemainingLabel = '—';
  let progress = 0;
  if (ride.data) {
    const totalMeters = haversineMeters(
      ride.data.pickupLatitude,
      ride.data.pickupLongitude,
      ride.data.dropoffLatitude,
      ride.data.dropoffLongitude,
    );
    if (tracking.driverLocation) {
      const remainingMeters = haversineMeters(
        tracking.driverLocation.latitude,
        tracking.driverLocation.longitude,
        ride.data.dropoffLatitude,
        ride.data.dropoffLongitude,
      );
      distanceRemainingLabel = `${formatDistance(remainingMeters)} remaining`;
      progress = totalMeters > 0 ? Math.max(0, Math.min(1, 1 - remainingMeters / totalMeters)) : 0;
    }
  }

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <RideStatusBar />
      <div className="absolute inset-0 top-10" style={{ zIndex: 0 }}>
        <MapCanvas variant="inprogress" progress={progress} />
      </div>
      <div className="absolute inset-x-0 top-10 px-4 pt-3" style={{ zIndex: 10 }}>
        <div
          className="flex items-center gap-2 rounded-2xl px-3 py-2"
          style={{
            background: 'rgba(10,22,40,.85)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,.08)',
          }}
        >
          <BackArrow onClick={onBack} />
          <p
            className="flex-1 text-[13px]"
            style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.6)' }}
          >
            Live trip tracking
          </p>
          <div
            className="flex items-center gap-1.5 rounded-full px-2 py-0.5"
            style={{ background: 'rgba(34,197,94,.15)' }}
          >
            <div
              className="h-2 w-2 rounded-full"
              style={{ background: tracking.connected ? '#47CF72' : 'rgba(255,255,255,.3)' }}
            />
            <p
              className="text-[10px] font-bold"
              style={{
                fontFamily: "'Poppins',sans-serif",
                color: tracking.connected ? '#47CF72' : 'rgba(255,255,255,.5)',
              }}
            >
              {tracking.connected ? 'LIVE' : 'CONNECTING'}
            </p>
          </div>
        </div>
      </div>
      <RideBottomSheet peek anchored>
        <div className="px-5 pb-8 pt-5">
          <p
            className="mb-1 text-[16px] font-bold"
            style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
          >
            On the way to {ride.data?.dropoffAddress ?? 'destination'}
          </p>
          <p
            className="mb-3 text-[13px]"
            style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.6)' }}
          >
            {distanceRemainingLabel}
          </p>
          <div className="mb-4 h-2 rounded-full" style={{ background: '#112238' }}>
            <div
              className="h-2 rounded-full transition-all"
              style={{ background: '#47CF72', width: `${String(Math.round(progress * 100))}%` }}
            />
          </div>
          <div className="mb-2 flex gap-2">
            <QuickActionButton icon="📍" label="Share Trip" disabled />
            <QuickActionButton icon="🚨" label="SOS" disabled />
            <QuickActionButton icon="📞" label="Call" disabled />
          </div>
          <p
            className="text-center text-[11px]"
            style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.3)' }}
          >
            Share Trip, SOS, and Call aren&apos;t available yet — no trip-sharing, emergency, or
            telephony capability exists in the backend today.
          </p>
        </div>
      </RideBottomSheet>
    </div>
  );
}
