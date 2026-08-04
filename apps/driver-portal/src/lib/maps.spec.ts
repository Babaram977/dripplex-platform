import { describe, expect, it } from 'vitest';

import { buildAppleMapsUrl, buildGoogleMapsUrl, buildNavAppOptions, buildWazeUrl } from './maps';

const destination = { latitude: 6.5244, longitude: 3.3792 };

describe('maps', () => {
  it('builds a Google Maps directions universal link', () => {
    const url = buildGoogleMapsUrl(destination);
    expect(url).toBe('https://www.google.com/maps/dir/?api=1&destination=6.5244%2C3.3792');
  });

  it('builds an Apple Maps driving-directions universal link', () => {
    const url = buildAppleMapsUrl(destination);
    expect(url).toBe('https://maps.apple.com/?daddr=6.5244%2C3.3792&dirflg=d');
  });

  it('builds a Waze navigate-now universal link', () => {
    const url = buildWazeUrl(destination);
    expect(url).toBe('https://waze.com/ul?ll=6.5244%2C3.3792&navigate=yes');
  });

  it('offers the three founder-approved nav apps, in order', () => {
    const options = buildNavAppOptions(destination);
    expect(options.map((option) => option.label)).toEqual(['Google Maps', 'Apple Maps', 'Waze']);
    expect(options.every((option) => option.url.startsWith('https://'))).toBe(true);
  });
});
