import { DeliveryFeeService, haversineMeters } from './delivery-fee.service';
import { DEFAULT_SPEED_MPS, FEE_PER_KM, MIN_DELIVERY_FEE } from './delivery.constants';

describe('haversineMeters', () => {
  it('returns zero for the same point', () => {
    expect(haversineMeters(6.5244, 3.3792, 6.5244, 3.3792)).toBe(0);
  });

  it('calculates a known Lagos distance', () => {
    const distance = haversineMeters(6.5244, 3.3792, 6.6018, 3.3515);

    expect(distance).toBeGreaterThan(9100);
    expect(distance).toBeLessThan(9200);
  });
});

describe('DeliveryFeeService', () => {
  const service = new DeliveryFeeService();

  it('uses the minimum fee for short distances', () => {
    expect(service.estimate(500).fee).toBe(MIN_DELIVERY_FEE);
  });

  it('scales the fee with distance', () => {
    expect(service.estimate(5000).fee).toBe(5 * FEE_PER_KM);
  });

  it('rounds distance before calculating fee and duration', () => {
    const estimate = service.estimate(1500.6);

    expect(estimate.distanceMeters).toBe(1501);
    expect(estimate.fee).toBe(MIN_DELIVERY_FEE);
  });

  it('uses merchant override fee when provided', () => {
    expect(service.estimate(5000, 1200).fee).toBe(1200);
  });

  it('allows a zero merchant override fee', () => {
    expect(service.estimate(5000, 0).fee).toBe(0);
  });

  it('calculates duration using DEFAULT_SPEED_MPS', () => {
    const distanceMeters = 1000;

    expect(service.estimate(distanceMeters).durationSeconds).toBe(
      Math.ceil(distanceMeters / DEFAULT_SPEED_MPS),
    );
  });
});
