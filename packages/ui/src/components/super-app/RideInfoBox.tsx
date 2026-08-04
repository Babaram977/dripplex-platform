import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/** Small rounded message box for inline loading/error/waiting states across Ride screens. */
export function SuperAppRideInfoBox({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'error' | undefined;
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <div
      className={`rounded-2xl p-4 text-[13px] ${body}`}
      style={{
        color: tone === 'error' ? '#EF4444' : 'rgba(255,255,255,.6)',
        background: tone === 'error' ? 'rgba(239,68,68,.08)' : '#112238',
        border:
          tone === 'error' ? '1px solid rgba(239,68,68,.2)' : '1px solid rgba(255,255,255,.08)',
      }}
    >
      {children}
    </div>
  );
}
