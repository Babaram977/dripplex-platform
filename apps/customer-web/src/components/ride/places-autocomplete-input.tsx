'use client';

import { useMapsLibrary } from '@vis.gl/react-google-maps';
import * as React from 'react';

export interface PlaceSelection {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
}

interface PlacesAutocompleteInputProps {
  placeholder?: string;
  onSelect: (place: PlaceSelection) => void;
  /** Fires on every keystroke, independent of onSelect — lets the caller
   * keep filtering a client-side list (e.g. saved places) while typing. */
  onQueryChange?: (value: string) => void;
  className?: string;
  style?: React.CSSProperties;
  autoFocus?: boolean;
}

/**
 * A plain text input that upgrades itself into a Google Places Autocomplete
 * field once the `places` library is loaded — degrades to an inert text
 * input with no suggestions when no RideMapsProvider/API key is available
 * (useMapsLibrary returns null rather than throwing in that case), so the
 * destination search screen keeps working without Maps credentials
 * configured.
 */
export function PlacesAutocompleteInput({
  placeholder,
  onSelect,
  onQueryChange,
  className,
  style,
  autoFocus,
}: PlacesAutocompleteInputProps): React.JSX.Element {
  const placesLibrary = useMapsLibrary('places');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const onSelectRef = React.useRef(onSelect);
  onSelectRef.current = onSelect;

  React.useEffect(() => {
    if (!placesLibrary || !inputRef.current) {
      return undefined;
    }

    const autocomplete = new placesLibrary.Autocomplete(inputRef.current, {
      fields: ['formatted_address', 'name', 'geometry'],
      componentRestrictions: { country: 'ng' },
    });

    const listener = autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      const location = place.geometry?.location;
      if (!location) {
        return;
      }
      onSelectRef.current({
        label: place.name ?? place.formatted_address ?? 'Selected place',
        address: place.formatted_address ?? place.name ?? '',
        latitude: location.lat(),
        longitude: location.lng(),
      });
    });

    return () => {
      listener.remove();
    };
  }, [placesLibrary]);

  return (
    <input
      ref={inputRef}
      type="text"
      placeholder={placeholder}
      autoFocus={autoFocus}
      className={className}
      style={style}
      onChange={(event) => {
        onQueryChange?.(event.target.value);
      }}
    />
  );
}
