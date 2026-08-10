'use client';

import { APIProvider } from '@vis.gl/react-google-maps';
import * as React from 'react';

import { resolveGoogleMapsApiKey } from '@/lib/google-maps-config';

/**
 * Mounted once around the whole ride flow (see RideFlow) rather than per
 * screen, so the Maps JS script loads a single time and survives
 * Home->Search->Fare->tracking screen transitions instead of reloading on
 * every navigation. When no key is configured, renders children directly —
 * LiveMap/PlacesAutocompleteInput detect that themselves and fall back to
 * the decorative MapCanvas placeholder rather than crashing on a missing
 * APIProvider context.
 */
export function RideMapsProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const apiKey = resolveGoogleMapsApiKey();
  if (!apiKey) {
    return <>{children}</>;
  }
  return (
    <APIProvider apiKey={apiKey} version="weekly" libraries={['places']}>
      {children}
    </APIProvider>
  );
}
