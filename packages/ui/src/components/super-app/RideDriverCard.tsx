import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/**
 * Driver identity card — deliberately honest about a real capability gap.
 * The real backend has no customer-facing driver-profile endpoint and no
 * vehicle make/model/color/plate/photo fields exposed to the customer (only
 * `admin` and the driver's own controller can read the full DriverProfileDto).
 * The only real data for an active ride is the driver's id and live
 * location over the socket. This card shows that honestly instead of
 * fabricating a name, photo, rating, or vehicle — every field activates
 * the moment the backend exposes it.
 */
export function SuperAppRideDriverCard({
  onViewProfile,
}: {
  onViewProfile?: (() => void) | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  const content = (
    <div className="flex items-center gap-4">
      <div
        className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-2xl"
        style={{ background: 'rgba(43,172,82,.12)' }}
      >
        🚗
      </div>
      <div className="flex-1">
        <p className={`text-[15px] font-bold text-white ${heading}`}>Your driver</p>
        <p className={`text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
          Name, photo, and vehicle details aren&apos;t available yet — pending a backend
          driver-profile endpoint
        </p>
      </div>
    </div>
  );
  if (!onViewProfile) {
    return (
      <div
        className="rounded-2xl p-4"
        style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
      >
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onViewProfile}
      className="w-full rounded-2xl p-4 text-left"
      style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
    >
      {content}
    </button>
  );
}
