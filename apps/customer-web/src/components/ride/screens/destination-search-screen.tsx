'use client';

import * as React from 'react';

import { type PlaceSelection, PlacesAutocompleteInput } from '../places-autocomplete-input';
import { ActionButton, RideHeader, StatusBanner } from '../ride-ui';

import type { CustomerAddressDto } from '@dripplex/types';

import { useSavedPlaces } from '@/hooks/rides';

export interface SelectedDestination {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
}

function fromSavedPlace(place: CustomerAddressDto): SelectedDestination {
  return {
    label: place.label === 'HOME' ? 'Home' : place.label === 'WORK' ? 'Work' : place.addressLine1,
    address: place.addressLine1,
    latitude: place.latitude,
    longitude: place.longitude,
  };
}

/**
 * Free-text destination entry resolves through Google Places Autocomplete
 * when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is configured (see
 * RideMapsProvider/PlacesAutocompleteInput); the saved-places list below
 * still filters client-side and stays available either way, so a rider can
 * always fall back to a saved place if Maps credentials aren't set up.
 */
export function DestinationSearchScreen({
  onBack,
  onSelect,
}: {
  onBack: () => void;
  onSelect: (destination: SelectedDestination) => void;
}): React.JSX.Element {
  const [query, setQuery] = React.useState('');
  const savedPlaces = useSavedPlaces();

  const filtered = (savedPlaces.data?.items ?? []).filter((place) =>
    query.length > 0
      ? `${place.addressLine1} ${place.city}`.toLowerCase().includes(query.toLowerCase())
      : true,
  );

  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      <RideHeader onBack={onBack} title="Set Destination" />
      <div className="px-5 pb-4 pt-3">
        <div
          className="flex h-14 items-center gap-3 rounded-2xl px-4"
          style={{ background: '#112238', border: '1px solid rgba(43,172,82,.4)' }}
        >
          <div className="h-2.5 w-2.5 rounded-full" style={{ background: '#EF4444' }} />
          <PlacesAutocompleteInput
            placeholder="Search for an address or saved place..."
            onQueryChange={setQuery}
            onSelect={(place: PlaceSelection) => {
              onSelect({
                label: place.label,
                address: place.address,
                latitude: place.latitude,
                longitude: place.longitude,
              });
            }}
            className="flex-1 bg-transparent outline-none"
            style={{ fontFamily: "'Inter',sans-serif", fontSize: 15, color: '#fff' }}
            autoFocus
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5">
        {savedPlaces.isLoading ? (
          <p
            className="py-4 text-[13px]"
            style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.5)' }}
          >
            Loading saved places…
          </p>
        ) : null}
        {savedPlaces.isError ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <StatusBanner
              tone="error"
              title="Couldn't load your saved places"
              subtitle="Check your connection and try again."
            />
            <div className="w-full max-w-[200px]">
              <ActionButton
                label="Retry"
                variant="secondary"
                onClick={() => {
                  void savedPlaces.refetch();
                }}
              />
            </div>
          </div>
        ) : null}
        {!savedPlaces.isLoading && !savedPlaces.isError && filtered.length === 0 ? (
          <p
            className="py-4 text-[13px]"
            style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.5)' }}
          >
            No matching saved places — keep typing to search addresses, or add a place from Saved
            Places.
          </p>
        ) : null}
        {filtered.map((place) => (
          <button
            key={place.id}
            type="button"
            onClick={() => {
              onSelect(fromSavedPlace(place));
            }}
            className="flex w-full items-center gap-3 rounded-xl px-1 py-3.5"
          >
            <div
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-lg"
              style={{ background: '#112238', border: '1px solid rgba(255,255,255,.08)' }}
            >
              {place.label === 'HOME' ? '🏠' : place.label === 'WORK' ? '💼' : '📍'}
            </div>
            <div className="flex-1 text-left">
              <p
                className="text-[14px] font-medium"
                style={{ fontFamily: "'Poppins',sans-serif", color: '#fff' }}
              >
                {place.addressLine1}
              </p>
              <p
                className="text-[12px]"
                style={{ fontFamily: "'Inter',sans-serif", color: 'rgba(255,255,255,.5)' }}
              >
                {place.city}, {place.state}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
