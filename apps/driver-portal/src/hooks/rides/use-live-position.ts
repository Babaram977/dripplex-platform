'use client';

import * as React from 'react';

export interface LiveGeolocationPoint {
  latitude: number;
  longitude: number;
}

/**
 * Continuously watched device position for map display (the driver's own
 * marker on the trip map). Separate from useReportDriverLocation, which
 * independently streams position to the backend over a socket — this hook
 * only holds local state for rendering and never emits anywhere.
 */
export function useLivePosition(): LiveGeolocationPoint | null {
  const [position, setPosition] = React.useState<LiveGeolocationPoint | null>(null);

  React.useEffect(() => {
    if (typeof navigator === 'undefined') {
      return undefined;
    }
    const watchId = navigator.geolocation.watchPosition(
      (result) => {
        setPosition({ latitude: result.coords.latitude, longitude: result.coords.longitude });
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 4_000 },
    );
    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  return position;
}
