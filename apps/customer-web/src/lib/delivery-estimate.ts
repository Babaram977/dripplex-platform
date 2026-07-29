const BASE_PREP_MINUTES = 15;
const AVERAGE_SPEED_KM_PER_MIN = 0.4; // ~24km/h urban average, a rough display-only heuristic.

/**
 * Client-side display heuristic only — there is no logistics/ETA data source
 * on the backend yet. Returns null when distance is unknown so callers can
 * omit the ETA rather than show a fabricated number.
 */
export function estimateDeliveryMinutes(distanceKm: number | null): number | null {
  if (distanceKm === null) {
    return null;
  }
  return Math.round(BASE_PREP_MINUTES + distanceKm / AVERAGE_SPEED_KM_PER_MIN);
}

export function formatDeliveryEstimate(distanceKm: number | null): string | null {
  const minutes = estimateDeliveryMinutes(distanceKm);
  if (minutes === null) {
    return null;
  }
  if (minutes < 60) {
    return `~${String(minutes)} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `~${String(hours)}h` : `~${String(hours)}h ${String(remainder)}m`;
}
