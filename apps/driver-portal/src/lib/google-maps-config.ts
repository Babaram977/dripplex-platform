/**
 * Browser Google Maps key — same NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as
 * customer-web (see docs/LAUNCH-READINESS-CREDENTIALS.md). Returns
 * undefined (not a throw) when unset so LiveMap falls back to the
 * decorative MapCanvas placeholder instead of crashing.
 */
export function resolveGoogleMapsApiKey(): string | undefined {
  const key = process.env['NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'];
  return key !== undefined && key !== '' ? key : undefined;
}
