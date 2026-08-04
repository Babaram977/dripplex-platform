/**
 * Browser Google Maps key — same `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` as
 * customer-web/driver-portal (see docs/LAUNCH-READINESS-CREDENTIALS.md).
 * Returns undefined (not a throw) when unset so the Live Fleet Map falls
 * back to a list-only view instead of crashing.
 */
export function resolveGoogleMapsApiKey(): string | undefined {
  const key = process.env['NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'];
  return key !== undefined && key !== '' ? key : undefined;
}
