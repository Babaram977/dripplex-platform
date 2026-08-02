'use client';

import * as React from 'react';

import { LiveMap } from '../live-map';
import {
  ActionButton,
  DriverCard,
  ETAChip,
  RideBottomSheet,
  SafetyChip,
  StatusBanner,
} from '../ride-ui';

import { useRide, useRideStatusTransition, useRideTracking } from '@/hooks/rides';
import { formatDistance, haversineMeters } from '@/lib/geo';

export function RideInProgressScreen({
  rideId,
  onViewLiveTracking,
  onCompleted,
}: {
  rideId: string;
  onViewLiveTracking: () => void;
  onCompleted: () => void;
}): React.JSX.Element {
  const ride = useRide(rideId);
  const tracking = useRideTracking(rideId);
  useRideStatusTransition(rideId, ['COMPLETED'], onCompleted);
  const [, forceTick] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      forceTick((n) => n + 1);
    }, 1000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  const startedAt = ride.data?.startedAt ? new Date(ride.data.startedAt).getTime() : null;
  const elapsedSeconds =
    startedAt !== null ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;
  const elapsedLabel =
    elapsedSeconds !== null
      ? `${String(Math.floor(elapsedSeconds / 60))}:${String(elapsedSeconds % 60).padStart(2, '0')}`
      : '—';

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
      distanceRemainingLabel = formatDistance(remainingMeters);
      progress = totalMeters > 0 ? Math.max(0, Math.min(1, 1 - remainingMeters / totalMeters)) : 0;
    }
  }

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#060E1C' }}
    >
      <div className="relative flex-shrink-0" style={{ height: 300 }}>
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
        <div className="absolute inset-x-0 top-14 flex justify-end px-5">
          <SafetyChip />
        </div>
        <div className="absolute inset-x-0 bottom-3 flex justify-center px-5">
          <button
            type="button"
            onClick={onViewLiveTracking}
            className="rounded-full px-4 py-2 text-[12px] font-semibold"
            style={{
              fontFamily: "'Inter',sans-serif",
              color: '#fff',
              background: 'rgba(6,14,28,.85)',
              border: '1px solid rgba(255,255,255,.12)',
              backdropFilter: 'blur(12px)',
            }}
          >
            View live tracking
          </button>
        </div>
      </div>
      <RideBottomSheet peek>
        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-2">
          {ride.isError ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <StatusBanner
                tone="error"
                title="Couldn't load this ride"
                subtitle="Check your connection and try again."
              />
              <div className="w-full max-w-[200px]">
                <ActionButton
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
              <div className="mb-4 flex gap-2">
                <ETAChip label="elapsed" value={elapsedLabel} />
                <ETAChip label="remaining" value={distanceRemainingLabel} />
                <ETAChip
                  label="fare"
                  value={ride.data ? `₦${ride.data.totalFare.toLocaleString()}` : '—'}
                />
              </div>
              <div className="mb-3">
                <DriverCard />
              </div>
              <div
                className="flex items-center gap-2 rounded-2xl p-3"
                style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
              >
                <div className="flex flex-col items-center gap-1">
                  <div className="h-2 w-2 rounded-full" style={{ background: '#2BAC52' }} />
                  <div className="h-8 w-px" style={{ background: 'rgba(255,255,255,.08)' }} />
                  <div className="h-2 w-2 rounded-full" style={{ background: '#EF4444' }} />
                </div>
                <div className="flex-1">
                  <p
                    className="mb-2 text-[12px]"
                    style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.6)' }}
                  >
                    {ride.data?.pickupAddress ?? 'Pickup'}
                  </p>
                  <p
                    className="text-[12px]"
                    style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.6)' }}
                  >
                    {ride.data?.dropoffAddress ?? 'Destination'}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </RideBottomSheet>
    </div>
  );
}
