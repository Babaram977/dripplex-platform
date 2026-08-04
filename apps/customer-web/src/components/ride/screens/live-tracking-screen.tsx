'use client';

import {
  SuperAppRideActionButton,
  SuperAppRideBackArrow,
  SuperAppRideBottomSheet,
  SuperAppRideProgressBar,
  SuperAppRideQuickActionButton,
  SuperAppRideStatusBanner,
  SuperAppRideStatusBar,
  useSuperAppFonts,
} from '@dripplex/ui';
import * as React from 'react';

import { LiveMap } from '../live-map';

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
  const { heading, body } = useSuperAppFonts();

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
      <SuperAppRideStatusBar />
      <div className="absolute inset-0 top-10" style={{ zIndex: 0 }}>
        <LiveMap
          driver={tracking.driverLocation ?? undefined}
          dropoff={
            ride.data
              ? { latitude: ride.data.dropoffLatitude, longitude: ride.data.dropoffLongitude }
              : undefined
          }
          routeBetween="driverDropoff"
          fallbackVariant="inprogress"
          fallbackProgress={progress}
        />
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
          <SuperAppRideBackArrow onClick={onBack} />
          <p className={`flex-1 text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.6)' }}>
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
              className={`text-[10px] font-bold ${heading}`}
              style={{ color: tracking.connected ? '#47CF72' : 'rgba(255,255,255,.5)' }}
            >
              {tracking.connected ? 'LIVE' : 'CONNECTING'}
            </p>
          </div>
        </div>
      </div>
      <SuperAppRideBottomSheet peek anchored>
        <div className="px-5 pb-8 pt-5">
          {ride.isError ? (
            <div className="flex flex-col items-center gap-4 py-2">
              <SuperAppRideStatusBanner
                tone="error"
                title="Couldn't load this ride"
                subtitle="Check your connection and try again."
              />
              <div className="w-full max-w-[200px]">
                <SuperAppRideActionButton
                  label="Retry"
                  variant="secondary"
                  onClick={() => {
                    void ride.refetch();
                  }}
                />
              </div>
            </div>
          ) : (
            <>
              <p className={`mb-1 text-[16px] font-bold text-white ${heading}`}>
                On the way to {ride.data?.dropoffAddress ?? 'destination'}
              </p>
              <p className={`mb-3 text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.6)' }}>
                {distanceRemainingLabel}
              </p>
              <div className="mb-4">
                <SuperAppRideProgressBar progress={progress} />
              </div>
              <div className="mb-2 flex gap-2">
                <SuperAppRideQuickActionButton icon="📍" label="Share Trip" disabled />
                <SuperAppRideQuickActionButton icon="🚨" label="SOS" disabled />
                <SuperAppRideQuickActionButton icon="📞" label="Call" disabled />
              </div>
              <p
                className={`text-center text-[11px] ${body}`}
                style={{ color: 'rgba(255,255,255,.3)' }}
              >
                Share Trip, SOS, and Call aren&apos;t available yet — no trip-sharing, emergency, or
                telephony capability exists in the backend today.
              </p>
            </>
          )}
        </div>
      </SuperAppRideBottomSheet>
    </div>
  );
}
