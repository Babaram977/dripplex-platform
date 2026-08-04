'use client';

import {
  SuperAppRideActionButton,
  SuperAppRideBottomSheet,
  SuperAppRideFareBreakdown,
  SuperAppRideHeader,
  SuperAppRideInfoBox,
  SuperAppRideTypeSelector,
  useSuperAppFonts,
} from '@dripplex/ui';
import * as React from 'react';

import { type LiveMapPoint, type LiveMapRouteInfo, LiveMap } from '../live-map';

import type { CurrentLocationState } from '@/hooks/rides';
import type { RideType } from '@dripplex/types';

import { useEstimateFare, useRideTypeCatalog } from '@/hooks/rides';

interface Destination {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
}

export function FareEstimateScreen({
  destination,
  location,
  pickupOverride,
  onPickupChange,
  onBack,
  onBook,
}: {
  destination: Destination;
  location: CurrentLocationState;
  /** Set when the rider dragged the pickup pin — takes precedence over the device's raw location. */
  pickupOverride?: LiveMapPoint | null;
  onPickupChange?: (point: LiveMapPoint) => void;
  onBack: () => void;
  onBook: (rideType: RideType, totalFare: number) => void;
}): React.JSX.Element {
  const [rideType, setRideType] = React.useState<RideType>('ECONOMY');
  const [route, setRoute] = React.useState<LiveMapRouteInfo | null>(null);
  const estimate = useEstimateFare();
  const rideTypeCatalog = useRideTypeCatalog();
  const catalogEntries = rideTypeCatalog.data ?? [];
  const rideTypeOptions = catalogEntries.map((entry) => ({
    key: entry.type,
    label: entry.displayName,
    emoji: entry.emoji,
  }));
  const selectedRideTypeLabel =
    catalogEntries.find((entry) => entry.type === rideType)?.displayName ?? rideType;

  const pickup: LiveMapPoint | null =
    pickupOverride ??
    (location.status === 'ready' && location.latitude !== null && location.longitude !== null
      ? { latitude: location.latitude, longitude: location.longitude }
      : null);

  const requestKey = pickup
    ? `${rideType}:${String(pickup.latitude)}:${String(pickup.longitude)}`
    : null;
  const lastRequestedKey = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (requestKey === null || requestKey === lastRequestedKey.current || !pickup) {
      return;
    }
    lastRequestedKey.current = requestKey;
    estimate.mutate({
      rideType,
      pickupLatitude: pickup.latitude,
      pickupLongitude: pickup.longitude,
      dropoffLatitude: destination.latitude,
      dropoffLongitude: destination.longitude,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- estimate is a stable mutation handle, re-running on it would loop
  }, [requestKey]);

  const totalFare = estimate.data?.totalFare;
  const { body } = useSuperAppFonts();

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#060E1C' }}
    >
      <div className="relative flex-shrink-0" style={{ height: 260 }}>
        <LiveMap
          pickup={pickup ?? undefined}
          dropoff={{ latitude: destination.latitude, longitude: destination.longitude }}
          routeBetween="pickupDropoff"
          draggablePickup
          onPickupChange={onPickupChange}
          onRouteChange={setRoute}
          fallbackVariant="default"
        />
        <SuperAppRideHeader onBack={onBack} floating />
      </div>
      <SuperAppRideBottomSheet peek title="Fare Estimate">
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {location.status === 'denied' || location.status === 'unavailable' ? (
            <div className="mb-4">
              <SuperAppRideInfoBox tone="error">
                Can&apos;t get your current location — location access is required to estimate a
                fare.
              </SuperAppRideInfoBox>
            </div>
          ) : null}
          <p className={`mb-4 text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.6)' }}>
            To {destination.label}
            {route ? ` · ${route.distanceText} · ${route.durationText}` : ''}
          </p>
          {rideTypeOptions.length > 0 ? (
            <div className="mb-4">
              <SuperAppRideTypeSelector
                options={rideTypeOptions}
                selectedKey={rideType}
                onSelect={(key) => {
                  setRideType(key as RideType);
                }}
              />
            </div>
          ) : null}
          <div className="mb-5">
            {estimate.isPending || location.status === 'locating' ? (
              <SuperAppRideInfoBox>
                {location.status === 'locating' ? 'Getting your location…' : 'Calculating fare…'}
              </SuperAppRideInfoBox>
            ) : estimate.isError ? (
              <SuperAppRideInfoBox tone="error">
                Couldn&apos;t calculate fare. Try again.
              </SuperAppRideInfoBox>
            ) : estimate.data ? (
              <SuperAppRideFareBreakdown
                baseFare={estimate.data.baseFare}
                distanceFare={estimate.data.distanceFare}
                timeFare={estimate.data.timeFare}
                totalFare={estimate.data.totalFare}
              />
            ) : (
              <SuperAppRideInfoBox>Waiting for location…</SuperAppRideInfoBox>
            )}
          </div>
          <SuperAppRideActionButton
            label={
              totalFare !== undefined
                ? `Book ${selectedRideTypeLabel} · ₦${totalFare.toLocaleString()}`
                : 'Book ride'
            }
            disabled={totalFare === undefined}
            onClick={() => {
              if (totalFare !== undefined) {
                onBook(rideType, totalFare);
              }
            }}
          />
        </div>
      </SuperAppRideBottomSheet>
    </div>
  );
}
