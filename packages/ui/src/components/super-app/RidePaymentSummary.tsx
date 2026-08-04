import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/** Route label + large fare-amount hero block at the top of the Payment screen. */
export function SuperAppRidePaymentSummary({
  routeLabel,
  amount,
}: {
  routeLabel: string;
  amount: string;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div
      className="mb-4 rounded-2xl p-4"
      style={{ background: '#0D1B2E', border: '1px solid rgba(255,255,255,.08)' }}
    >
      <p className={`text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
        {routeLabel}
      </p>
      <p className={`my-1 text-[32px] font-extrabold ${heading}`} style={{ color: '#47CF72' }}>
        {amount}
      </p>
    </div>
  );
}
