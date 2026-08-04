import * as React from 'react';

import { useSuperAppFonts } from './fonts';

/** Single place-list row (icon + address + city/state), used on Destination Search and Saved Places. */
export function SuperAppRidePlaceRow({
  icon,
  addressLine1,
  cityState,
  onClick,
}: {
  icon: string;
  addressLine1: string;
  cityState: string;
  onClick: () => void;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-1 py-3.5"
    >
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-lg"
        style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
      >
        {icon}
      </div>
      <div className="flex-1 text-left">
        <p className={`text-[14px] font-medium text-white ${heading}`}>{addressLine1}</p>
        <p className={`text-[12px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
          {cityState}
        </p>
      </div>
    </button>
  );
}
