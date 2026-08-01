import { RideType } from '@prisma/client';

import { haversineMeters, RideFareService } from './ride-fare.service';

describe('haversineMeters', () => {
  it('returns zero for identical coordinates', () => {
    expect(haversineMeters(6.5244, 3.3792, 6.5244, 3.3792)).toBe(0);
  });

  it('computes a plausible distance between two Lagos-area points', () => {
    // Ikeja to Victoria Island, Lagos — roughly 15-20km straight-line
    const meters = haversineMeters(6.6018, 3.3515, 6.4281, 3.4219);
    expect(meters).toBeGreaterThan(15_000);
    expect(meters).toBeLessThan(25_000);
  });
});

describe('RideFareService', () => {
  const service = new RideFareService();

  it('estimates a higher fare for Economy than Tricycle over the same trip', () => {
    const pickup = { lat: 6.6018, lng: 3.3515 };
    const dropoff = { lat: 6.605, lng: 3.355 };

    const economy = service.estimate(RideType.ECONOMY, pickup, dropoff);
    const tricycle = service.estimate(RideType.TRICYCLE, pickup, dropoff);

    expect(economy.totalFare).toBeGreaterThan(tricycle.totalFare);
  });

  it('composes total fare from base + distance + time components', () => {
    const estimate = service.estimate(
      RideType.ECONOMY,
      { lat: 6.6018, lng: 3.3515 },
      { lat: 6.62, lng: 3.36 },
    );

    expect(estimate.totalFare).toBe(estimate.baseFare + estimate.distanceFare + estimate.timeFare);
    expect(estimate.distanceMeters).toBeGreaterThan(0);
    expect(estimate.durationSeconds).toBeGreaterThan(0);
  });

  it('charges only the base fare for a zero-distance trip', () => {
    const estimate = service.estimate(
      RideType.ECONOMY,
      { lat: 6.6018, lng: 3.3515 },
      { lat: 6.6018, lng: 3.3515 },
    );

    expect(estimate.distanceFare).toBe(0);
    expect(estimate.timeFare).toBe(0);
    expect(estimate.totalFare).toBe(estimate.baseFare);
  });
});
