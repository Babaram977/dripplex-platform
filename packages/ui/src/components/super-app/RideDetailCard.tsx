import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/** Label/value row list with a bold highlighted footer row (fare total), used on Trip Completed. */
export function SuperAppRideDetailCard({
  rows,
  footerLabel,
  footerValue,
}: {
  rows: [string, string][];
  footerLabel: string;
  footerValue: string;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div
      className="w-full overflow-hidden rounded-3xl"
      style={{ background: '#0D1B2E', border: '1px solid rgba(255,255,255,.08)' }}
    >
      <div className="border-b px-5 py-4" style={{ borderColor: 'rgba(255,255,255,.08)' }}>
        {rows.map(([label, value]) => (
          <div key={label} className="mb-2.5 flex justify-between last:mb-0">
            <p className={`text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
              {label}
            </p>
            <p className={`text-[13px] font-medium text-white ${body}`}>{value}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between px-5 py-4">
        <p className={`text-[15px] font-bold text-white ${heading}`}>{footerLabel}</p>
        <p className={`text-[22px] font-bold ${heading}`} style={{ color: '#47CF72' }}>
          {footerValue}
        </p>
      </div>
    </div>
  );
}
