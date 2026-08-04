'use client';

import { SuperAppRideHeader, useSuperAppFonts } from '@dripplex/ui';
import * as React from 'react';

/**
 * Generated screen — no real DriverProfileSheet was received. Extends the
 * locked Ride design language (same header/card/typography treatment as
 * DriverAssignedScreen) rather than inventing a new visual style. See
 * docs/RIDE-003-GENERATED-SCREENS.md for the full record.
 *
 * Content is deliberately honest, not a redesign-with-placeholders: the
 * real backend has no customer-facing driver-profile endpoint and no
 * vehicle make/model/color/plate/photo fields anywhere in its schema, so
 * there is nothing real to show beyond what DriverAssignedScreen's
 * DriverCard already surfaces. This sheet exists as the documented
 * integration point — every field below activates the moment the backend
 * exposes it, without any further redesign.
 */
export function DriverProfileSheet({ onBack }: { onBack: () => void }): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <SuperAppRideHeader onBack={onBack} title="Driver Profile" />
      <div className="flex-1 overflow-y-auto px-5 pb-6 pt-4">
        <div className="mb-4 flex flex-col items-center gap-3">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-3xl text-3xl"
            style={{ background: 'rgba(43,172,82,.12)' }}
          >
            🚗
          </div>
          <p className={`text-[18px] font-bold text-white ${heading}`}>Your driver</p>
        </div>
        <div
          className="rounded-2xl p-4"
          style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
        >
          <p
            className={`mb-3 text-[11px] font-semibold uppercase tracking-wide ${heading}`}
            style={{ color: 'rgba(255,255,255,.5)' }}
          >
            Integration status
          </p>
          {(
            [
              ['Name', 'Not exposed to customers yet'],
              ['Photo', 'Not exposed to customers yet'],
              ['Rating & trip count', 'Not exposed to customers yet'],
              ['Vehicle make/model/color', 'No field in the backend schema yet'],
              ['License plate', 'No field in the backend schema yet'],
            ] as const
          ).map(([field, status]) => (
            <div key={field} className="mb-2.5 flex items-start justify-between gap-3">
              <p className={`text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.6)' }}>
                {field}
              </p>
              <p
                className={`text-right text-[12px] ${body}`}
                style={{ color: 'rgba(255,255,255,.5)' }}
              >
                {status}
              </p>
            </div>
          ))}
        </div>
        <p
          className={`mt-4 text-center text-[12px] ${body}`}
          style={{ color: 'rgba(255,255,255,.3)' }}
        >
          See docs/RIDE-003-SLICE-2.md for the proposed backend addition that would fill this in.
        </p>
      </div>
    </div>
  );
}
