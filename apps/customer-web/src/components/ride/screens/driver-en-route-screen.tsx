'use client';

import {
  SuperAppRideBottomSheet,
  SuperAppRideDriverCard,
  SuperAppRideHeader,
  SuperAppRideLiveBadge,
  SuperAppRideQuickActionButton,
  useSuperAppFonts,
} from '@dripplex/ui';
import * as React from 'react';

import { LiveMap } from '../live-map';

import { useCancelRide, useRide, useRideStatusTransition, useRideTracking } from '@/hooks/rides';

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
  const ride = useRide(rideId);
  const tracking = useRideTracking(rideId);
  const cancelRide = useCancelRide();
  useRideStatusTransition(rideId, ['ARRIVED', 'IN_PROGRESS'], (status) => {
    if (status === 'IN_PROGRESS') {
      onStarted();
    } else {
      onArrived();
    }
  });

  const { heading, body } = useSuperAppFonts();

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <div className="absolute inset-0 top-10" style={{ zIndex: 0 }}>
        <LiveMap
          pickup={
            ride.data
              ? { latitude: ride.data.pickupLatitude, longitude: ride.data.pickupLongitude }
              : undefined
          }
          driver={tracking.driverLocation ?? undefined}
          routeBetween="driverPickup"
          fallbackVariant="assigned"
        />
      </div>
      <div
        className="absolute inset-0 top-10"
        style={{
          background: 'linear-gradient(to bottom, transparent 40%, rgba(10,22,40,.95) 100%)',
          zIndex: 1,
        }}
      />
      <div style={{ zIndex: 10 }}>
        <SuperAppRideHeader onBack={onBack} floating />
      </div>
      <SuperAppRideBottomSheet peek anchored>
        <div className="px-5 pb-8 pt-2">
          <div className="mb-3 flex items-center gap-2">
            <p className={`text-[17px] font-bold text-white ${heading}`}>Driver is on the way</p>
            <SuperAppRideLiveBadge live={tracking.connected} />
          </div>
          <div className="mb-4">
            <SuperAppRideDriverCard />
          </div>
          <div className="mb-3 flex gap-3">
            <SuperAppRideQuickActionButton icon="📞" label="Call" disabled />
            <SuperAppRideQuickActionButton icon="💬" label="Chat" disabled />
            <SuperAppRideQuickActionButton
              icon="❌"
              label="Cancel"
              tone="danger"
              disabled={cancelRide.isPending}
              onClick={() => {
                cancelRide.mutate({ rideId });
              }}
            />
          </div>
          <p className={`text-center text-[11px] ${body}`} style={{ color: '#F59E0B' }}>
            Free cancellation until the driver arrives
          </p>
        </div>
      </SuperAppRideBottomSheet>
    </div>
  );
}
