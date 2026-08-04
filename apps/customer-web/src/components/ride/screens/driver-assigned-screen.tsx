'use client';

import {
  SuperAppRideActionButton,
  SuperAppRideBottomSheet,
  SuperAppRideDriverCard,
  SuperAppRideETAChip,
  SuperAppRideHeader,
  SuperAppRideLiveBadge,
  SuperAppRideQuickActionButton,
  SuperAppRideStatusBanner,
  SuperAppRideTextButton,
  useSuperAppFonts,
} from '@dripplex/ui';
import * as React from 'react';

import { type LiveMapRouteInfo, LiveMap } from '../live-map';

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

  const { heading, body } = useSuperAppFonts();

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
        <SuperAppRideHeader onBack={onBack} floating />
      </div>
      <SuperAppRideBottomSheet peek>
        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-2">
          {ride.isError ? (
            <div className="flex flex-col items-center gap-4 py-6">
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
              <div className="mb-4 flex items-center gap-3">
                <p className={`text-[15px] font-bold text-white ${heading}`}>Driver on the way</p>
                <SuperAppRideLiveBadge live={tracking.connected} />
              </div>
              <div className="mb-4 flex gap-2">
                <SuperAppRideETAChip label="from pickup" value={distanceLabel} />
              </div>
              <div className="mb-4">
                <SuperAppRideDriverCard onViewProfile={onViewProfile} />
              </div>
              <div className="mb-4">
                <SuperAppRideActionButton
                  label="Track driver live"
                  variant="secondary"
                  onClick={onTrackDriver}
                />
              </div>
              <div className="mb-4 flex gap-3">
                <SuperAppRideQuickActionButton icon="📞" label="Call Driver" disabled />
                <SuperAppRideQuickActionButton icon="💬" label="Message" disabled />
              </div>
              <p
                className={`mb-4 text-center text-[11px] ${body}`}
                style={{ color: 'rgba(255,255,255,.3)' }}
              >
                Calling and messaging aren&apos;t available yet — no telephony/chat capability
                exists in the backend today.
              </p>
            </>
          )}
          <SuperAppRideTextButton
            label={cancelRide.isPending ? 'Cancelling…' : 'Cancel ride'}
            disabled={cancelRide.isPending}
            onClick={() => {
              cancelRide.mutate({ rideId });
            }}
          />
        </div>
      </SuperAppRideBottomSheet>
    </div>
  );
}
