import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/** Small stat chip (ETA, distance, etc) used in ride tracking headers. */
export function SuperAppRideETAChip({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div
      className="flex flex-col items-center gap-1 rounded-2xl px-3 py-2"
      style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
    >
      <p className={`text-[13px] font-bold ${heading}`} style={{ color: '#47CF72' }}>
        {value}
      </p>
      <p className={`text-[10px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
        {label}
      </p>
    </div>
  );
}
