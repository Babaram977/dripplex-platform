import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/**
 * Driver avatar (gradient initial circle, or a car emoji when no name is
 * known yet) plus name, used on the post-ride Tip/Rate screens. Once a ride
 * is COMPLETED the receipt endpoint exposes a real driver name — unlike the
 * active-ride screens, which have no such endpoint and fall back to "Your
 * driver" honestly instead of fabricating one.
 */
export function SuperAppRideDriverIdentity({
  driverName,
  layout = 'row',
}: {
  driverName?: string | undefined;
  layout?: 'row' | 'column' | undefined;
}): React.JSX.Element {
  const { heading } = useSuperAppFonts();
  const initial = driverName ? driverName.slice(0, 1).toUpperCase() : '🚗';
  const displayName = driverName ?? 'Your driver';

  if (layout === 'column') {
    return (
      <div className="mb-6 flex flex-col items-center">
        <div
          className={`mb-3 flex h-20 w-20 items-center justify-center rounded-3xl text-2xl font-bold text-white ${heading}`}
          style={{ background: 'linear-gradient(135deg,#176B30,#2BAC52)' }}
        >
          {initial}
        </div>
        <p className={`text-[18px] font-bold text-white ${heading}`}>{displayName}</p>
      </div>
    );
  }

  return (
    <div
      className="mb-6 flex items-center gap-3 rounded-2xl p-4"
      style={{ background: '#0D1B2E', border: '1px solid rgba(255,255,255,.08)' }}
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full text-[16px] font-bold text-white ${heading}`}
        style={{ background: 'linear-gradient(135deg,#176B30,#2BAC52)' }}
      >
        {initial}
      </div>
      <p className={`text-[15px] font-semibold text-white ${heading}`}>{displayName}</p>
    </div>
  );
}
