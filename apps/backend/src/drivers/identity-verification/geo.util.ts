/** Local copy of ride-fare.service.ts's haversine — Ride is frozen
 * (DPX Freeze Rule), so this is a small, deliberate duplication rather than
 * a cross-module import that would need touching frozen code. */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadiusMeters = 6_371_000;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
}

/** Implied speed in km/h between two (lat, lng, timestamp) fixes. */
export function impliedSpeedKmh(
  from: { latitude: number; longitude: number; at: Date },
  to: { latitude: number; longitude: number; at: Date },
): number {
  const elapsedMs = to.at.getTime() - from.at.getTime();
  if (elapsedMs <= 0) return 0;
  const distanceKm =
    haversineMeters(from.latitude, from.longitude, to.latitude, to.longitude) / 1000;
  const elapsedHours = elapsedMs / (60 * 60 * 1000);
  return distanceKm / elapsedHours;
}

/** Africa/Lagos is UTC+1 year-round (no DST) — Nigeria is DrippleX's stated
 * launch market. Returns a YYYY-MM-DD calendar-date key in that zone. */
export function lagosDateKey(date: Date): string {
  const shifted = new Date(date.getTime() + 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}
