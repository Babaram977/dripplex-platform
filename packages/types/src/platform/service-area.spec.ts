import { describe, expect, it } from 'vitest';

import {
  PLATFORM_BASE_CENTRE,
  PLATFORM_BASE_CITY,
  PLATFORM_BASE_COUNTRY,
  PLATFORM_BASE_STATE,
} from './service-area.js';

/** Great-circle metres between two points — same formula the delivery fee uses. */
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** The Lagos point every fallback in the product used to carry. */
const OLD_LAGOS_FALLBACK = { latitude: 6.5244, longitude: 3.3792 };

describe('platform base', () => {
  it('names Kano as the operating base', () => {
    expect(PLATFORM_BASE_CITY).toBe('Kano');
    expect(PLATFORM_BASE_STATE).toBe('Kano');
    expect(PLATFORM_BASE_COUNTRY).toBe('Nigeria');
  });

  it('is not the Lagos point the fallbacks used to use', () => {
    // The regression this guards: a Lagos fallback under a Kano operation is
    // ~830 km of phantom distance, which on the delivery path became a real
    // fee and a real ETA rather than a harmless map position.
    const drift = haversineMeters(
      PLATFORM_BASE_CENTRE.latitude,
      PLATFORM_BASE_CENTRE.longitude,
      OLD_LAGOS_FALLBACK.latitude,
      OLD_LAGOS_FALLBACK.longitude,
    );
    expect(drift).toBeGreaterThan(800_000);
  });

  it('sits inside Kano State', () => {
    // Kano State spans roughly 10.5–12.6 N and 7.7–9.5 E. A fat-fingered edit
    // that puts the base in the wrong state should fail here rather than in
    // production pricing.
    expect(PLATFORM_BASE_CENTRE.latitude).toBeGreaterThan(10.5);
    expect(PLATFORM_BASE_CENTRE.latitude).toBeLessThan(12.6);
    expect(PLATFORM_BASE_CENTRE.longitude).toBeGreaterThan(7.7);
    expect(PLATFORM_BASE_CENTRE.longitude).toBeLessThan(9.5);
  });
});
