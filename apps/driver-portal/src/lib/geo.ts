const EARTH_RADIUS_METERS = 6_371_000;

/**
 * Straight-line distance between two coordinates. The backend has no
 * driver->pickup distance field on RideOfferPreviewDto (it only estimates
 * the pickup->dropoff trip itself) — this is computed client-side from the
 * driver's own geolocation instead of adding a backend capability for a
 * value derivable from data already on the client.
 */
export function haversineDistanceMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${String(Math.round(meters))} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) {
    return '<1 min';
  }
  return `${String(minutes)} min`;
}
