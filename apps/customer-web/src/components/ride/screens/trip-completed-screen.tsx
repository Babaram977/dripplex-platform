'use client';

import {
  SuperAppRideActionButton,
  SuperAppRideDetailCard,
  SuperAppRideStatusBar,
  useSuperAppFonts,
} from '@dripplex/ui';
import * as React from 'react';

import { useRide } from '@/hooks/rides';
import { haversineMeters } from '@/lib/geo';

const RIDE_TYPE_LABEL: Record<string, string> = { ECONOMY: 'Economy', TRICYCLE: 'Tricycle' };

/**
 * Real source (`TripCompletedScreen`) only had onRate/onHome — it implicitly
 * assumed payment already happened. The real backend requires an explicit
 * customer-initiated payment step (no auto-charge on completion), so this
 * screen's primary CTA leads to Payment first, not straight to Rating —
 * adapting the flow to the backend rather than skipping a step it requires.
 */
export function TripCompletedScreen({
  rideId,
  onPay,
  onHome,
}: {
  rideId: string;
  onPay: () => void;
  onHome: () => void;
}): React.JSX.Element {
  const ride = useRide(rideId);
  const { heading, body } = useSuperAppFonts();

  const durationLabel = React.useMemo(() => {
    if (!ride.data?.startedAt || !ride.data.completedAt) return '—';
    const seconds = Math.max(
      0,
      Math.round(
        (new Date(ride.data.completedAt).getTime() - new Date(ride.data.startedAt).getTime()) /
          1000,
      ),
    );
    return `${String(Math.round(seconds / 60))} min`;
  }, [ride.data?.startedAt, ride.data?.completedAt]);

  const distanceLabel = React.useMemo(() => {
    if (!ride.data) return '—';
    const meters = haversineMeters(
      ride.data.pickupLatitude,
      ride.data.pickupLongitude,
      ride.data.dropoffLatitude,
      ride.data.dropoffLongitude,
    );
    return `${(meters / 1000).toFixed(1)} km`;
  }, [ride.data]);

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#060E1C' }}
    >
      <SuperAppRideStatusBar />
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-5">
        <div
          className="flex h-24 w-24 items-center justify-center rounded-full text-5xl"
          style={{
            background: 'linear-gradient(135deg,#176B30,#2BAC52)',
            boxShadow: '0 0 60px rgba(43,172,82,.35)',
          }}
        >
          🏁
        </div>
        <div className="text-center">
          <p
            className={`mb-1 text-[10px] font-bold tracking-widest ${body}`}
            style={{ color: '#47CF72' }}
          >
            TRIP COMPLETED
          </p>
          <p className={`mb-2 text-[26px] font-bold text-white ${heading}`}>You have arrived!</p>
          <p className={`text-[14px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
            {ride.data?.dropoffAddress ?? 'Destination'}
          </p>
        </div>
        <SuperAppRideDetailCard
          rows={[
            ['Duration', durationLabel],
            ['Distance', distanceLabel],
            [
              'Ride type',
              ride.data ? (RIDE_TYPE_LABEL[ride.data.rideType] ?? ride.data.rideType) : '—',
            ],
          ]}
          footerLabel="Total fare"
          footerValue={ride.data ? `₦${ride.data.totalFare.toLocaleString()}` : '—'}
        />
        <div className="flex w-full flex-col gap-3">
          <SuperAppRideActionButton label="Continue to Payment" onClick={onPay} />
          <SuperAppRideActionButton label="Back to Home" variant="secondary" onClick={onHome} />
        </div>
      </div>
    </div>
  );
}
