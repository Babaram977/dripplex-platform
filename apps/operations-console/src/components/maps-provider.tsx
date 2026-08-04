'use client';

import { APIProvider } from '@vis.gl/react-google-maps';
import * as React from 'react';

import { resolveGoogleMapsApiKey } from '@/lib/google-maps-config';

/**
 * Mirrors customer-web's `RideMapsProvider` — mounted once around the Live
 * Fleet Map screen so the Maps JS script loads a single time. When no key
 * is configured, renders children directly; `FleetMap` detects that itself
 * and falls back to the list view rather than crashing on a missing
 * `APIProvider` context.
 */
export function OperationsMapsProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const apiKey = resolveGoogleMapsApiKey();
  if (!apiKey) {
    return <>{children}</>;
  }
  return <APIProvider apiKey={apiKey}>{children}</APIProvider>;
}
