'use client';

import { SuperAppRideActionButton, useSuperAppFonts } from '@dripplex/ui';
import * as React from 'react';

import { useRide } from '@/hooks/rides';

/**
 * Real source, Part 3 version (SVG checkmark + payment method/time/txn ID
 * rows) — see docs/reference note on the duplicate-export chunking
 * artifact. Generic across payment methods (wallet, cash-confirmed, or
 * gateway-verified), not wallet-specific despite the name.
 */
export function WalletPaySuccessScreen({
  rideId,
  onDone,
  onReceipt,
}: {
  rideId: string;
  onDone: () => void;
  onReceipt: () => void;
}): React.JSX.Element {
  const ride = useRide(rideId);
  const { heading, body } = useSuperAppFonts();

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-5"
      style={{ background: '#0A1628' }}
    >
      <div style={{ width: 100, height: 100 }}>
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="#47CF72" strokeWidth="4" />
          <path
            d="M28 50 L44 66 L72 36"
            fill="none"
            stroke="#47CF72"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="text-center">
        <p className={`mb-1 text-[36px] font-black text-white ${heading}`}>
          {ride.data ? `₦${ride.data.totalFare.toLocaleString()} paid!` : 'Paid!'}
        </p>
        <p className={`mb-8 text-[16px] ${body}`} style={{ color: 'rgba(255,255,255,.6)' }}>
          Payment successful
        </p>
      </div>
      <div
        className="mb-4 w-full rounded-2xl p-4"
        style={{ background: '#0D1B2E', border: '1px solid rgba(255,255,255,.08)' }}
      >
        {(
          [
            ['Payment method', ride.data?.paymentMethod ?? '—'],
            [
              'Time',
              ride.data?.completedAt ? new Date(ride.data.completedAt).toLocaleString() : '—',
            ],
          ] as const
        ).map(([labelText, value]) => (
          <div key={labelText} className="mb-2 flex justify-between last:mb-0">
            <p className={`text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
              {labelText}
            </p>
            <p className={`text-[12px] text-white ${body}`}>{value}</p>
          </div>
        ))}
      </div>
      <div className="flex w-full flex-col gap-3">
        <SuperAppRideActionButton label="View Receipt" variant="secondary" onClick={onReceipt} />
        <SuperAppRideActionButton label="Rate Your Ride" onClick={onDone} />
      </div>
    </div>
  );
}
