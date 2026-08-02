'use client';

import * as React from 'react';

export interface CurrentLocationState {
  status: 'idle' | 'locating' | 'ready' | 'denied' | 'unavailable';
  latitude: number | null;
  longitude: number | null;
}

/**
 * Real browser Geolocation API — not a backend capability, and not faked.
 * The real backend has no current-location/reverse-geocode endpoint, so
 * pickup coordinates can only come from the device itself.
 */
export function useCurrentLocation(): CurrentLocationState {
  const [state, setState] = React.useState<CurrentLocationState>({
    status: 'idle',
    latitude: null,
    longitude: null,
  });

  React.useEffect(() => {
    if (typeof navigator === 'undefined') {
      setState({ status: 'unavailable', latitude: null, longitude: null });
      return;
    }
    setState((previous) => ({ ...previous, status: 'locating' }));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          status: 'ready',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        setState({ status: 'denied', latitude: null, longitude: null });
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, []);

  return state;
}
