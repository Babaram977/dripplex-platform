'use client';

import {
  SuperAppRideActionButton,
  SuperAppRideFareBreakdown,
  SuperAppRideHeader,
  SuperAppRideReceiptCard,
  SuperAppRideStatusBanner,
  useSuperAppFonts,
} from '@dripplex/ui';
import * as React from 'react';

import { LiveMap } from '../live-map';

import { useRide, useRideReceipt, useTrackingHistory } from '@/hooks/rides';

export function TripReceiptScreen({
  rideId,
  onBack,
  onReport,
}: {
  rideId: string;
  onBack: () => void;
  onReport: () => void;
}): React.JSX.Element {
  const receipt = useRideReceipt(rideId);
  const ride = useRide(rideId);
  const tracking = useTrackingHistory(rideId);
  const { body } = useSuperAppFonts();

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <SuperAppRideHeader onBack={onBack} title="Trip Receipt" />
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {receipt.isLoading ? (
          <p className={`py-4 text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
            Loading receipt…
          </p>
        ) : null}
        {receipt.isError ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <SuperAppRideStatusBanner
              tone="error"
              title="Couldn't load this receipt"
              subtitle="Check your connection and try again."
            />
            <div className="w-full max-w-[200px]">
              <SuperAppRideActionButton
                label="Retry"
                variant="secondary"
                onClick={() => {
                  void receipt.refetch();
                }}
              />
            </div>
          </div>
        ) : null}
        {receipt.data ? (
          <>
            {ride.data ? (
              <div
                className="mb-4 overflow-hidden rounded-2xl"
                style={{ height: 180, border: '1px solid rgba(255,255,255,.08)' }}
              >
                <LiveMap
                  pickup={{
                    latitude: ride.data.pickupLatitude,
                    longitude: ride.data.pickupLongitude,
                  }}
                  dropoff={{
                    latitude: ride.data.dropoffLatitude,
                    longitude: ride.data.dropoffLongitude,
                  }}
                  breadcrumbPath={tracking.data}
                  fallbackVariant="inprogress"
                  fallbackProgress={1}
                />
              </div>
            ) : null}
            <SuperAppRideReceiptCard
              receiptId={receipt.data.rideId.slice(0, 8).toUpperCase()}
              status={receipt.data.status}
              rows={[
                ['Date', new Date(receipt.data.requestedAt).toLocaleString()],
                ['From', receipt.data.pickupAddress ?? '—'],
                ['To', receipt.data.dropoffAddress ?? '—'],
                [
                  'Duration',
                  receipt.data.durationSeconds
                    ? `${String(Math.round(receipt.data.durationSeconds / 60))} min`
                    : '—',
                ],
                [
                  'Distance',
                  receipt.data.distanceMeters
                    ? `${(receipt.data.distanceMeters / 1000).toFixed(1)} km`
                    : '—',
                ],
                ['Driver', receipt.data.driver?.name ?? '—'],
                ['Payment method', receipt.data.paymentMethod ?? '—'],
              ]}
            />
            <SuperAppRideFareBreakdown
              baseFare={receipt.data.fare.baseFare}
              distanceFare={receipt.data.fare.distanceFare}
              timeFare={receipt.data.fare.timeFare}
              totalFare={receipt.data.fare.totalFare}
            />
            {receipt.data.fare.tipAmount ? (
              <p
                className={`mt-3 text-center text-[12px] ${body}`}
                style={{ color: 'rgba(255,255,255,.5)' }}
              >
                Includes ₦{receipt.data.fare.tipAmount.toLocaleString()} tip
              </p>
            ) : null}
            <button
              type="button"
              onClick={onReport}
              className={`mt-4 w-full text-center text-[13px] ${body}`}
              style={{ color: 'rgba(255,255,255,.5)' }}
            >
              Report an issue with this trip
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
