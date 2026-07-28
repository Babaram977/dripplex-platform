import * as React from 'react';

interface Coordinates {
  lat: number;
  lng: number;
}

interface UseGeolocationResult {
  location: Coordinates | null;
  requesting: boolean;
  error: string | null;
  request: () => void;
}

/** Opt-in only — never requests location automatically on mount. */
export function useGeolocation(): UseGeolocationResult {
  const [location, setLocation] = React.useState<Coordinates | null>(null);
  const [requesting, setRequesting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const request = React.useCallback(() => {
    if (typeof navigator === 'undefined') {
      setError('Location is not available in this browser.');
      return;
    }
    setRequesting(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setRequesting(false);
      },
      () => {
        setError('Could not access your location.');
        setRequesting(false);
      },
      { timeout: 10_000 },
    );
  }, []);

  return { location, requesting, error, request };
}
