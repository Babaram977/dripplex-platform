/**
 * Browser Google Maps key — safe to ship in a client bundle once restricted
 * by HTTP referrer (see docs/LAUNCH-READINESS-CREDENTIALS.md), same pattern
 * as resolveFirebaseWebConfig(). Returns undefined (not a throw) when unset
 * so map components can fall back to the decorative MapCanvas placeholder
 * instead of crashing in any environment that hasn't configured this yet.
 */
export function resolveGoogleMapsApiKey(): string | undefined {
  const key = process.env['NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'];
  return key !== undefined && key !== '' ? key : undefined;
}
