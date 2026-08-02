'use client';

import * as React from 'react';

import { type LiveMapRouteInfo, LiveMap } from '../live-map';
import {
  ActionButton,
  DriverCard,
  ETAChip,
  QuickActionButton,
  RideBottomSheet,
  RideHeader,
  StatusBanner,
} from '../ride-ui';

import { useCancelRide, useRide, useRideStatusTransition, useRideTracking } from '@/hooks/rides';
import { formatDistance, haversineMeters } from '@/lib/geo';

export function DriverAssignedScreen({
  rideId,
  onBack,
  onViewProfile,
  onTrackDriver,
  onArrived,
}: {
  rideId: string;
  onBack: () => void;
  onViewProfile: () => void;
  onTrackDriver: () => void;
  onArrived: () => void;
}): React.JSX.Element {
  const ride = useRide(rideId);
  const tracking = useRideTracking(rideId);
  const cancelRide = useCancelRide();
  const [route, setRoute] = React.useState<LiveMapRouteInfo | null>(null);
  useRideStatusTransition(rideId, ['ARRIVED'], onArrived);

  const distanceLabel =
    route?.distanceText ??
    (tracking.driverLocation && ride.data
      ? formatDistance(
          haversineMeters(
            tracking.driverLocation.latitude,
            tracking.driverLocation.longitude,
            ride.data.pickupLatitude,
            ride.data.pickupLongitude,
          ),
        )
      : '—');

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#060E1C' }}
    >
      <div className="relative flex-shrink-0" style={{ height: 300 }}>
        <LiveMap
          pickup={
            ride.data
              ? { latitude: ride.data.pickupLatitude, longitude: ride.data.pickupLongitude }
              : undefined
          }
          driver={tracking.driverLocation ?? undefined}
          routeBetween="driverPickup"
          onRouteChange={setRoute}
          fallbackVariant="assigned"
        />
        <RideHeader onBack={onBack} floating />
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
              <div className="mb-4 flex items-center gap-3">
                <p
                  className="text-[15px] font-bold"
                  style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
                >
                  Driver on the way
                </p>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{
                    background: tracking.connected
                      ? 'rgba(43,172,82,.15)'
                      : 'rgba(255,255,255,.06)',
                    color: tracking.connected ? '#47CF72' : 'rgba(255,255,255,.5)',
                    fontFamily: "'Inter',sans-serif",
                  }}
                >
                  {tracking.connected ? 'LIVE' : 'CONNECTING'}
                </span>
              </div>
              <div className="mb-4 flex gap-2">
                <ETAChip label="from pickup" value={distanceLabel} />
              </div>
              <div className="mb-4">
                <DriverCard onViewProfile={onViewProfile} />
              </div>
              <div className="mb-4">
                <ActionButton
                  label="Track driver live"
                  variant="secondary"
                  onClick={onTrackDriver}
                />
              </div>
              <div className="mb-4 flex gap-3">
                <QuickActionButton icon="📞" label="Call Driver" disabled />
                <QuickActionButton icon="💬" label="Message" disabled />
              </div>
              <p
                className="mb-4 text-center text-[11px]"
                style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.3)' }}
              >
                Calling and messaging aren&apos;t available yet — no telephony/chat capability
                exists in the backend today.
              </p>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              cancelRide.mutate({ rideId });
            }}
            disabled={cancelRide.isPending}
            className="w-full text-center text-[14px] font-medium"
            style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.5)' }}
          >
            {cancelRide.isPending ? 'Cancelling…' : 'Cancel ride'}
          </button>
        </div>
      </RideBottomSheet>
    </div>
  );
}
