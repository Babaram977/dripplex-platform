import { RideType } from '@prisma/client';

import { haversineMeters, RideFareService } from './ride-fare.service';
import { RIDE_MINIMUM_FARE } from './ride.constants';

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
    // Far enough apart that both price above the platform minimum — below it
    // every type is charged the same floor, which is the point of a floor.
    const pickup = { lat: 6.6018, lng: 3.3515 };
    const dropoff = { lat: 6.4281, lng: 3.4219 };

    const economy = service.estimate(RideType.ECONOMY, pickup, dropoff);
    const tricycle = service.estimate(RideType.TRICYCLE, pickup, dropoff);

    expect(economy.totalFare).toBeGreaterThan(tricycle.totalFare);
  });

  it('composes total fare from base + distance + time once above the minimum', () => {
    const estimate = service.estimate(
      RideType.ECONOMY,
      { lat: 6.6018, lng: 3.3515 },
      { lat: 6.4281, lng: 3.4219 },
    );

    expect(estimate.totalFare).toBe(estimate.baseFare + estimate.distanceFare + estimate.timeFare);
    expect(estimate.totalFare).toBeGreaterThan(RIDE_MINIMUM_FARE);
    expect(estimate.distanceMeters).toBeGreaterThan(0);
    expect(estimate.durationSeconds).toBeGreaterThan(0);
  });

  /**
   * Founder decision, 2026-08-16: a trip under a kilometre is charged NGN 1,500.
   * Economy's base fare is 300, so before this a sub-kilometre hop earned a
   * driver a few hundred naira and was not worth taking.
   */
  describe('platform minimum fare', () => {
    it('charges the minimum for a zero-distance trip, not the base fare alone', () => {
      const estimate = service.estimate(
        RideType.ECONOMY,
        { lat: 6.6018, lng: 3.3515 },
        { lat: 6.6018, lng: 3.3515 },
      );

      expect(estimate.distanceFare).toBe(0);
      expect(estimate.timeFare).toBe(0);
      expect(estimate.totalFare).toBe(RIDE_MINIMUM_FARE);
    });

    it('charges the minimum for a trip under one kilometre', () => {
      const estimate = service.estimate(
        RideType.ECONOMY,
        { lat: 6.6018, lng: 3.3515 },
        // ~600 m away.
        { lat: 6.6072, lng: 3.3515 },
      );

      expect(estimate.distanceMeters).toBeLessThan(1000);
      expect(estimate.totalFare).toBe(RIDE_MINIMUM_FARE);
    });

    it('applies to every ride type, including the cheapest', () => {
      for (const rideType of [RideType.ECONOMY, RideType.COMFORT, RideType.XL, RideType.TRICYCLE]) {
        const estimate = service.estimate(
          rideType,
          { lat: 6.6018, lng: 3.3515 },
          { lat: 6.6018, lng: 3.3515 },
        );
        expect(estimate.totalFare).toBe(RIDE_MINIMUM_FARE);
      }
    });

    it('leaves a long trip alone — the minimum is a floor, never an addition', () => {
      const estimate = service.estimate(
        RideType.ECONOMY,
        { lat: 6.6018, lng: 3.3515 },
        { lat: 6.4281, lng: 3.4219 },
      );

      expect(estimate.totalFare).toBe(
        estimate.baseFare + estimate.distanceFare + estimate.timeFare,
      );
    });
  });
});
