'use client';

import * as React from 'react';

import { ActionButton, FareBreakdown, MapCanvas, RideBottomSheet, RideHeader } from '../ride-ui';

import type { CurrentLocationState } from '@/hooks/rides';
import type { RideType } from '@dripplex/types';

import { useEstimateFare } from '@/hooks/rides';

const RIDE_TYPE_LABELS: Record<RideType, { label: string; emoji: string; description: string }> = {
  ECONOMY: { label: 'Economy', emoji: '🚗', description: 'Affordable everyday rides' },
  TRICYCLE: { label: 'Tricycle', emoji: '🛺', description: 'Quick short trips' },
};

interface Destination {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
}

export function FareEstimateScreen({
  destination,
  location,
  onBack,
  onBook,
}: {
  destination: Destination;
  location: CurrentLocationState;
  onBack: () => void;
  onBook: (rideType: RideType, totalFare: number) => void;
}): React.JSX.Element {
  const [rideType, setRideType] = React.useState<RideType>('ECONOMY');
  const estimate = useEstimateFare();

  const canEstimate =
    location.status === 'ready' && location.latitude !== null && location.longitude !== null;
  const requestKey = canEstimate
    ? `${rideType}:${String(location.latitude)}:${String(location.longitude)}`
    : null;
  const lastRequestedKey = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (requestKey === null || requestKey === lastRequestedKey.current) {
      return;
    }
    if (location.latitude === null || location.longitude === null) {
      return;
    }
    lastRequestedKey.current = requestKey;
    estimate.mutate({
      rideType,
      pickupLatitude: location.latitude,
      pickupLongitude: location.longitude,
      dropoffLatitude: destination.latitude,
      dropoffLongitude: destination.longitude,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- estimate is a stable mutation handle, re-running on it would loop
  }, [requestKey]);

  const totalFare = estimate.data?.totalFare;

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#060E1C' }}
    >
      <div className="relative flex-shrink-0" style={{ height: 260 }}>
        <MapCanvas variant="default" />
        <RideHeader onBack={onBack} floating />
      </div>
      <RideBottomSheet peek title="Fare Estimate">
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {location.status === 'denied' || location.status === 'unavailable' ? (
            <p
              className="mb-4 rounded-2xl p-4 text-[13px]"
              style={{
                fontFamily: "'Inter',sans-serif",
                color: '#EF4444',
                background: 'rgba(239,68,68,.08)',
                border: '1px solid rgba(239,68,68,.2)',
              }}
            >
              Can&apos;t get your current location — location access is required to estimate a fare.
            </p>
          ) : null}
          <p
            className="mb-4 text-[13px]"
            style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.6)' }}
          >
            To {destination.label}
          </p>
          <div className="mb-4 flex gap-2">
            {(Object.keys(RIDE_TYPE_LABELS) as RideType[]).map((type) => {
              const meta = RIDE_TYPE_LABELS[type];
              const selected = rideType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setRideType(type);
                  }}
                  className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl px-2 py-3 transition-all"
                  style={{
                    background: selected ? 'rgba(43,172,82,.08)' : '#112238',
                    border: `1.5px solid ${selected ? 'rgba(43,172,82,.35)' : 'rgba(255,255,255,.08)'}`,
                  }}
                >
                  <span style={{ fontSize: 20 }}>{meta.emoji}</span>
                  <p
                    className="text-[12px] font-semibold"
                    style={{
                      fontFamily: "'Inter',sans-serif",
                      color: selected ? '#47CF72' : 'rgba(255,255,255,.6)',
                    }}
                  >
                    {meta.label}
                  </p>
                </button>
              );
            })}
          </div>
          <div className="mb-5">
            {estimate.isPending || location.status === 'locating' ? (
              <div
                className="rounded-2xl p-4 text-[13px]"
                style={{
                  fontFamily: "'Inter',sans-serif",
                  color: 'rgba(255,255,255,.6)',
                  background: '#112238',
                  border: '1px solid rgba(255,255,255,.08)',
                }}
              >
                {location.status === 'locating' ? 'Getting your location…' : 'Calculating fare…'}
              </div>
            ) : estimate.isError ? (
              <div
                className="rounded-2xl p-4 text-[13px]"
                style={{
                  fontFamily: "'Inter',sans-serif",
                  color: '#EF4444',
                  background: '#112238',
                  border: '1px solid rgba(255,255,255,.08)',
                }}
              >
                Couldn&apos;t calculate fare. Try again.
              </div>
            ) : estimate.data ? (
              <FareBreakdown
                baseFare={estimate.data.baseFare}
                distanceFare={estimate.data.distanceFare}
                timeFare={estimate.data.timeFare}
                totalFare={estimate.data.totalFare}
              />
            ) : (
              <div
                className="rounded-2xl p-4 text-[13px]"
                style={{
                  fontFamily: "'Inter',sans-serif",
                  color: 'rgba(255,255,255,.38)',
                  background: '#112238',
                  border: '1px solid rgba(255,255,255,.08)',
                }}
              >
                Waiting for location…
              </div>
            )}
          </div>
          <ActionButton
            label={
              totalFare !== undefined
                ? `Book ${RIDE_TYPE_LABELS[rideType].label} · ₦${totalFare.toLocaleString()}`
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
      </RideBottomSheet>
    </div>
  );
}
