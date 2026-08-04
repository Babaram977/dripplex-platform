import * as React from 'react';

import { useSuperAppFonts } from './fonts';

export interface SuperAppRideSavedPlace {
  id: string;
  /** 'HOME' | 'WORK' | other custom label — controls the icon shown. */
  label: string;
  addressLine1: string;
  city: string;
  state: string;
}

/** "SAVED PLACES" section with a Manage link, used on the Ride home screen. */
export function SuperAppRideSavedPlacesList({
  places,
  isLoading,
  isError,
  onSelect,
  onManage,
}: {
  places: SuperAppRideSavedPlace[];
  isLoading?: boolean | undefined;
  isError?: boolean | undefined;
  onSelect: (place: SuperAppRideSavedPlace) => void;
  onManage: () => void;
}): React.JSX.Element {
  const { heading, body } = useSuperAppFonts();
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p
          className={`text-[13px] font-semibold ${heading}`}
          style={{ color: 'rgba(255,255,255,.5)' }}
        >
          SAVED PLACES
        </p>
        <button
          type="button"
          onClick={onManage}
          className={`text-[12px] font-semibold ${heading}`}
          style={{ color: '#47CF72' }}
        >
          Manage
        </button>
      </div>
      {places.length === 0 ? (
        <p className={`text-[13px] ${body}`} style={{ color: 'rgba(255,255,255,.5)' }}>
          {isLoading
            ? 'Loading…'
            : isError
              ? "Couldn't load your saved places."
              : 'No saved places yet — add one from Destination Search.'}
        </p>
      ) : (
        places.map((place) => (
          <button
            key={place.id}
            type="button"
            onClick={() => {
              onSelect(place);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-1 py-3"
          >
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-lg"
              style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
            >
              {place.label === 'HOME' ? '🏠' : place.label === 'WORK' ? '💼' : '📍'}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className={`text-[14px] font-medium text-white ${heading}`}>
                {place.addressLine1}
              </p>
              <p
                className={`truncate text-[12px] ${body}`}
                style={{ color: 'rgba(255,255,255,.5)' }}
              >
                {place.city}, {place.state}
              </p>
            </div>
          </button>
        ))
      )}
    </div>
  );
}
