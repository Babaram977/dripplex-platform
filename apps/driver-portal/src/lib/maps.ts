/**
 * No Google Maps JS SDK integration exists anywhere in this codebase yet
 * (see MapCanvas doc comment) — but a real, zero-setup deep link into the
 * device's own Maps app needs no API key at all. This gives the driver
 * genuine turn-by-turn navigation today; swapping in an embedded map SDK
 * later is additive, not a replacement for this link.
 */
export function buildDirectionsUrl(destination: { latitude: number; longitude: number }): string {
  const params = new URLSearchParams({
    api: '1',
    destination: `${String(destination.latitude)},${String(destination.longitude)}`,
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
