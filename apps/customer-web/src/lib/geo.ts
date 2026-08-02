/**
 * Pure client-side geometry — not business logic, just the same haversine
 * formula the backend's own RideFareService uses (duplicated intentionally:
 * it's a generic math formula, not a pricing/dispatch rule). Used to show
 * honest, derived distances (e.g. "driver is 1.2km from pickup") from real
 * coordinates, instead of fabricating an ETA the backend never computed.
 */
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (value: number): number => (value * Math.PI) / 180;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(earthRadiusMeters * c);
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${String(Math.round(meters))}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}
