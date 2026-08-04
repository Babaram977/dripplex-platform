import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/** Small rounded message box for inline loading/error/waiting states across Ride screens. */
export function SuperAppRideInfoBox({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'error' | 'success' | undefined;
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
  const colors: Record<
    'neutral' | 'error' | 'success',
    { color: string; background: string; border: string }
  > = {
    neutral: {
      color: 'rgba(255,255,255,.6)',
      background: '#112238',
      border: '1px solid rgba(255,255,255,.08)',
    },
    error: {
      color: '#EF4444',
      background: 'rgba(239,68,68,.08)',
      border: '1px solid rgba(239,68,68,.2)',
    },
    success: {
      color: '#47CF72',
      background: 'rgba(34,197,94,.06)',
      border: '1px solid rgba(34,197,94,.15)',
    },
  };
  return (
    <div className={`rounded-2xl p-4 text-[13px] ${body}`} style={colors[tone]}>
      {children}
    </div>
  );
}
