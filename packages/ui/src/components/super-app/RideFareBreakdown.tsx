import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/** Base/distance/time/total fare line-item card used on Fare Estimate and Payment screens. */
export function SuperAppRideFareBreakdown({
  baseFare,
  distanceFare,
  timeFare,
  totalFare,
}: {
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  totalFare: number;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
    >
      {(
        [
          ['Base fare', baseFare],
          ['Distance', distanceFare],
          ['Time', timeFare],
        ] as const
      ).map(([labelText, amount]) => (
        <div key={labelText} className="mb-2 flex justify-between">
          <p className={`text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.6)' }}>
            {labelText}
          </p>
          <p className={`text-[13px] font-medium text-white ${body}`}>₦{amount.toLocaleString()}</p>
        </div>
      ))}
      <div className="my-2 h-px" style={{ background: 'rgba(255,255,255,.08)' }} />
      <div className="flex justify-between">
        <p className={`text-[14px] font-bold text-white ${heading}`}>Total</p>
        <p className={`text-[18px] font-bold ${heading}`} style={{ color: '#47CF72' }}>
          ₦{totalFare.toLocaleString()}
        </p>
      </div>
    </div>
  );
}
