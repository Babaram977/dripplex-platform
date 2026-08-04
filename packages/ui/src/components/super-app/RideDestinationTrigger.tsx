import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/** "Where are you going?" search trigger opening Destination Search. */
export function SuperAppRideDestinationTrigger({
  onClick,
  placeholder = 'Where are you going?',
}: {
  onClick: () => void;
  placeholder?: string | undefined;
}): React.JSX.Element {
  const { body } = useSuperAppFonts();
  return (
    <button type="button" onClick={onClick} className="w-full text-left">
      <div
        className="flex h-14 items-center gap-3 rounded-2xl px-4"
        style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#2BAC52"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <span className={`text-[15px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
          {placeholder}
        </span>
      </div>
    </button>
  );
}
