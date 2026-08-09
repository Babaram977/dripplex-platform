'use client';

import { useMapsLibrary } from '@vis.gl/react-google-maps';
import * as React from 'react';

export interface PlaceSelection {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  /** Google Places place ID for the selected prediction, when available. */
  placeId?: string;
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

/** How long to wait after the last keystroke before hitting the Places API. */
const DEBOUNCE_MS = 300;

/** Restrict predictions to Nigeria (CLDR region code), matching the launch market. */
const INCLUDED_REGION_CODES = ['ng'];

/**
 * A plain text input backed by the Google **Places API (New)**
 * (`AutocompleteSuggestion.fetchAutocompleteSuggestions`). Predictions are
 * fetched as the rider types (debounced) and rendered as the app's own
 * selectable dropdown list rather than relying on the legacy
 * `google.maps.places.Autocomplete` widget's built-in UI — the legacy widget
 * requires the deprecated classic "Places API", which cannot be enabled on the
 * founder's Google Cloud project (only "Places API (New)" is enabled there).
 *
 * Degrades to an inert text input with no suggestions when no
 * RideMapsProvider/API key is available (`useMapsLibrary` returns null rather
 * than throwing), so the destination search screen keeps working without Maps
 * credentials configured.
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

  const onSelectRef = React.useRef(onSelect);
  onSelectRef.current = onSelect;

  const [value, setValue] = React.useState('');
  const [suggestions, setSuggestions] = React.useState<google.maps.places.AutocompleteSuggestion[]>(
    [],
  );
  const [open, setOpen] = React.useState(false);

  // Reused across every request within a session; regenerated after each
  // selection so billing groups the query + fetchFields phases correctly.
  const sessionTokenRef = React.useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  const ensureSessionToken =
    React.useCallback((): google.maps.places.AutocompleteSessionToken | null => {
      if (!placesLibrary) {
        return null;
      }
      sessionTokenRef.current ??= new placesLibrary.AutocompleteSessionToken();
      return sessionTokenRef.current;
    }, [placesLibrary]);

  // Debounced prediction fetch. Ignores stale responses so an earlier,
  // slower request can't overwrite the results of a later keystroke.
  React.useEffect(() => {
    if (!placesLibrary || value.trim() === '') {
      setSuggestions([]);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      const sessionToken = ensureSessionToken() ?? undefined;
      void placesLibrary.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: value,
        sessionToken,
        includedRegionCodes: INCLUDED_REGION_CODES,
      })
        .then((response) => {
          if (cancelled) {
            return;
          }
          setSuggestions(response.suggestions);
          setOpen(true);
        })
        .catch(() => {
          if (!cancelled) {
            setSuggestions([]);
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [placesLibrary, value, ensureSessionToken]);

  const handleSelect = React.useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion): Promise<void> => {
      const prediction = suggestion.placePrediction;
      if (!prediction) {
        return;
      }

      const place = prediction.toPlace();
      await place.fetchFields({ fields: ['location', 'formattedAddress', 'displayName'] });

      const location = place.location;
      if (!location) {
        return;
      }

      const mainText = prediction.mainText?.text;
      const label = place.displayName ?? mainText ?? prediction.text.text;
      const address = place.formattedAddress ?? prediction.text.text;

      // Close the dropdown and start a fresh billing session for the next search.
      setSuggestions([]);
      setOpen(false);
      sessionTokenRef.current = null;

      onSelectRef.current({
        label: label !== '' ? label : 'Selected place',
        address,
        latitude: location.lat(),
        longitude: location.lng(),
        placeId: prediction.placeId,
      });
    },
    [],
  );

  return (
    <div className="relative min-w-0 flex-1">
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={className}
        style={style}
        onChange={(event) => {
          const next = event.target.value;
          setValue(next);
          onQueryChange?.(next);
        }}
        onFocus={() => {
          if (suggestions.length > 0) {
            setOpen(true);
          }
        }}
      />
      {open && suggestions.length > 0 ? (
        <ul
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-2xl py-1"
          style={{
            background: '#112238',
            border: '1px solid rgba(43,172,82,.4)',
            boxShadow: '0 12px 32px rgba(0,0,0,.45)',
          }}
        >
          {suggestions.map((suggestion) => {
            const prediction = suggestion.placePrediction;
            if (!prediction) {
              return null;
            }
            const mainText = prediction.mainText?.text ?? prediction.text.text;
            const secondaryText = prediction.secondaryText?.text;
            return (
              <li key={prediction.placeId}>
                <button
                  type="button"
                  className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left"
                  style={{ background: 'transparent' }}
                  onMouseDown={(event) => {
                    // Prevent the input's blur from closing the list before the tap registers.
                    event.preventDefault();
                  }}
                  onClick={() => {
                    void handleSelect(suggestion);
                  }}
                >
                  <span style={{ fontSize: 14, color: '#fff' }}>{mainText}</span>
                  {secondaryText !== undefined && secondaryText !== '' ? (
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,.55)' }}>
                      {secondaryText}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
