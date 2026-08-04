import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/** Compact pickup → dropoff address pair with connecting dots, used on In-Progress. */
export function SuperAppRideRouteSummary({
  pickupAddress,
  dropoffAddress,
}: {
  pickupAddress: string;
  dropoffAddress: string;
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <div
      className="flex items-center gap-2 rounded-2xl p-3"
      style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
    >
      <div className="flex flex-col items-center gap-1">
        <div className="h-2 w-2 rounded-full" style={{ background: '#2BAC52' }} />
        <div className="h-8 w-px" style={{ background: 'rgba(255,255,255,.08)' }} />
        <div className="h-2 w-2 rounded-full" style={{ background: '#EF4444' }} />
      </div>
      <div className="flex-1">
        <p className={`mb-2 text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.6)' }}>
          {pickupAddress}
        </p>
        <p className={`text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.6)' }}>
          {dropoffAddress}
        </p>
      </div>
    </div>
  );
}
