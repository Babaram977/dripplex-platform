import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/** Centered title/subtitle pair used for ride-status moments (searching, arrived, completed). */
export function SuperAppRideStatusBanner({
  title,
  subtitle,
  tone = 'neutral',
}: {
  title: string;
  subtitle?: string | undefined;
  tone?: 'neutral' | 'success' | 'error' | undefined;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  const titleColor = tone === 'success' ? '#47CF72' : tone === 'error' ? '#EF4444' : '#fff';
  return (
    <div className="text-center">
      <p className={`mb-1 text-[20px] font-bold ${heading}`} style={{ color: titleColor }}>
        {title}
      </p>
      {subtitle ? (
        <p className={`text-[14px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
