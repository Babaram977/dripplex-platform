'use client';

import * as React from 'react';

import { ActionButton, FareBreakdown, RideHeader, StatusBanner } from '../ride-ui';

import { useRideReceipt } from '@/hooks/rides';

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

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <RideHeader onBack={onBack} title="Trip Receipt" />
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        {receipt.isLoading ? (
          <p
            className="py-4 text-[13px]"
            style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.5)' }}
          >
            Loading receipt…
          </p>
        ) : null}
        {receipt.isError ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <StatusBanner
              tone="error"
              title="Couldn't load this receipt"
              subtitle="Check your connection and try again."
            />
            <div className="w-full max-w-[200px]">
              <ActionButton
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
            <div
              className="mb-4 overflow-hidden rounded-2xl"
              style={{ background: '#0D1B2E', border: '1px solid rgba(255,255,255,.08)' }}
            >
              <div
                className="flex items-center justify-between border-b px-4 py-4"
                style={{ borderColor: 'rgba(255,255,255,.08)' }}
              >
                <div>
                  <p
                    className="text-[11px] font-semibold"
                    style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.5)' }}
                  >
                    RECEIPT
                  </p>
                  <p
                    className="text-[13px] font-medium"
                    style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
                  >
                    {receipt.data.rideId.slice(0, 8).toUpperCase()}
                  </p>
                </div>
                <span
                  className="rounded-full px-3 py-1 text-[11px] font-bold"
                  style={{
                    background: 'rgba(43,172,82,.12)',
                    color: '#47CF72',
                    fontFamily: "'Inter',sans-serif",
                  }}
                >
                  {receipt.data.status}
                </span>
              </div>
              <div className="p-4">
                {(
                  [
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
                  ] as const
                ).map(([labelText, value]) => (
                  <div key={labelText} className="mb-3 flex justify-between">
                    <p
                      className="text-[13px]"
                      style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.5)' }}
                    >
                      {labelText}
                    </p>
                    <p
                      className="text-[13px] font-medium"
                      style={{ fontFamily: "'Inter',sans-serif", color: '#fff' }}
                    >
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <FareBreakdown
              baseFare={receipt.data.fare.baseFare}
              distanceFare={receipt.data.fare.distanceFare}
              timeFare={receipt.data.fare.timeFare}
              totalFare={receipt.data.fare.totalFare}
            />
            {receipt.data.fare.tipAmount ? (
              <p
                className="mt-3 text-center text-[12px]"
                style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.5)' }}
              >
                Includes ₦{receipt.data.fare.tipAmount.toLocaleString()} tip
              </p>
            ) : null}
            <button
              type="button"
              onClick={onReport}
              className="mt-4 w-full text-center text-[13px]"
              style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.5)' }}
            >
              Report an issue with this trip
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
