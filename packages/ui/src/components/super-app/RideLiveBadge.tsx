import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/** LIVE / CONNECTING pill shown next to a live-tracking heading. */
export function SuperAppRideLiveBadge({ live }: { live: boolean }): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${body}`}
      style={{
        background: live ? 'rgba(43,172,82,.15)' : 'rgba(255,255,255,.06)',
        color: live ? '#47CF72' : 'rgba(255,255,255,.5)',
      }}
    >
      {live ? 'LIVE' : 'CONNECTING'}
    </span>
  );
}
