import { distanceKm, isOpenNow } from './customer-merchant.mapper';

describe('distanceKm', () => {
  it('returns ~0 for the same point', () => {
    const point = { lat: 6.5244, lng: 3.3792 };
    expect(distanceKm(point, point)).toBeCloseTo(0, 5);
  });

  it('computes a plausible distance between two Lagos-area points', () => {
    // Ikeja (~6.6018, 3.3515) to Lagos Island (~6.4550, 3.3841) is roughly 17km straight-line.
    const km = distanceKm({ lat: 6.6018, lng: 3.3515 }, { lat: 6.455, lng: 3.3841 });
    expect(km).toBeGreaterThan(10);
    expect(km).toBeLessThan(25);
  });
});

describe('isOpenNow', () => {
  it('returns null when no hours are set', () => {
    expect(isOpenNow(null)).toBeNull();
    expect(isOpenNow(undefined)).toBeNull();
  });

  it('returns null when hours are malformed', () => {
    expect(isOpenNow({ mon: 'not an object' })).toBeNull();
    expect(isOpenNow({ mon: { open: '09:00' } })).toBeNull();
  });

  it('returns null when today has no configured hours', () => {
    const wednesday = new Date('2026-07-29T10:00:00Z'); // a Wednesday
    expect(isOpenNow({ mon: { open: '08:00', close: '20:00' } }, wednesday)).toBeNull();
  });

  it('returns true when within the configured window', () => {
    const wednesdayNoon = new Date('2026-07-29T12:00:00Z');
    expect(isOpenNow({ wed: { open: '08:00', close: '20:00' } }, wednesdayNoon)).toBe(true);
  });

  it('returns false when outside the configured window', () => {
    const wednesdayMidnight = new Date('2026-07-29T23:30:00Z');
    expect(isOpenNow({ wed: { open: '08:00', close: '20:00' } }, wednesdayMidnight)).toBe(false);
  });
});
