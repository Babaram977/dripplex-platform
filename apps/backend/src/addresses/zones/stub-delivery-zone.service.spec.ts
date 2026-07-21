import { StubDeliveryZoneService } from './stub-delivery-zone.service';

describe('StubDeliveryZoneService', () => {
  const service = new StubDeliveryZoneService();

  it('validates coordinate ranges', () => {
    expect(service.validateDeliveryZone({ latitude: 6.6, longitude: 3.3 }).allowed).toBe(true);
    expect(service.validateDeliveryZone({ latitude: 120, longitude: 3.3 }).allowed).toBe(false);
  });

  it('detects points inside a simple square polygon', () => {
    const polygon = [
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 10 },
      { latitude: 10, longitude: 10 },
      { latitude: 10, longitude: 0 },
    ];
    expect(service.isPointInsidePolygon({ latitude: 5, longitude: 5 }, polygon)).toBe(true);
    expect(service.isPointInsidePolygon({ latitude: 15, longitude: 5 }, polygon)).toBe(false);
  });

  it('checks merchant radius compatibility', () => {
    const merchant = { latitude: 6.6, longitude: 3.35 };
    const nearby = { latitude: 6.601, longitude: 3.351 };
    expect(service.isWithinMerchantRadius(nearby, merchant, 5)).toBe(true);
    expect(service.isWithinMerchantRadius({ latitude: 7.5, longitude: 4.5 }, merchant, 1)).toBe(
      false,
    );
  });

  it('calculates haversine distance', () => {
    const km = service.calculateDistanceKm(
      { latitude: 6.5244, longitude: 3.3792 },
      { latitude: 6.6018, longitude: 3.3515 },
    );
    expect(km).toBeGreaterThan(0);
    expect(km).toBeLessThan(20);
  });
});
