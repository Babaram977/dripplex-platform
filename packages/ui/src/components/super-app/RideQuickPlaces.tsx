import * as React from 'react';

import { useSuperAppFonts } from './fonts';

export interface SuperAppRideQuickPlace {
  id: string;
  /** 'HOME' | 'WORK' — controls the icon shown. */
  label: 'HOME' | 'WORK';
  addressLine1: string;
}

/** Home/Work quick-select chips on the Ride home screen. */
export function SuperAppRideQuickPlaces({
  places,
  onSelect,
}: {
  places: SuperAppRideQuickPlace[];
  onSelect: (place: SuperAppRideQuickPlace) => void;
}): React.JSX.Element | null {
  const { heading, body } = useSuperAppFonts();
  if (places.length === 0) {
    return null;
  }
  return (
    <div className="mb-5 flex gap-3">
      {places.map((place) => (
        <button
          key={place.id}
          type="button"
          onClick={() => {
            onSelect(place);
          }}
          className="flex flex-1 items-center gap-2.5 rounded-2xl px-3 py-3"
          style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
        >
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-base"
            style={{ background: 'rgba(43,172,82,.12)' }}
          >
            {place.label === 'HOME' ? '🏠' : '💼'}
          </div>
          <div className="min-w-0">
            <p className={`truncate text-[13px] font-semibold text-white ${heading}`}>
              {place.label === 'HOME' ? 'Home' : 'Work'}
            </p>
            <p className={`truncate text-[11px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
              {place.addressLine1}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
