import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CancelRideDto, RequestRideDto } from './request-ride.dto';

describe('Ride DTO validation', () => {
  it('accepts a valid ride request', async () => {
    const dto = plainToInstance(RequestRideDto, {
      rideType: 'ECONOMY',
      pickupLatitude: '6.6018',
      pickupLongitude: '3.3515',
      dropoffLatitude: 6.605,
      dropoffLongitude: 3.355,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.pickupLatitude).toBeCloseTo(6.6018);
  });

  it('rejects an out-of-range latitude', async () => {
    const dto = plainToInstance(RequestRideDto, {
      rideType: 'ECONOMY',
      pickupLatitude: 200,
      pickupLongitude: 3.3515,
      dropoffLatitude: 6.605,
      dropoffLongitude: 3.355,
    });

    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'pickupLatitude')).toBe(true);
  });

  it('rejects an unknown ride type', async () => {
    const dto = plainToInstance(RequestRideDto, {
      rideType: 'HELICOPTER',
      pickupLatitude: 6.6018,
      pickupLongitude: 3.3515,
      dropoffLatitude: 6.605,
      dropoffLongitude: 3.355,
    });

    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'rideType')).toBe(true);
  });

  it('accepts an empty cancel-ride payload since a reason is optional', async () => {
    const dto = plainToInstance(CancelRideDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects a cancel reason shorter than 3 characters', async () => {
    const dto = plainToInstance(CancelRideDto, { reason: 'no' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'reason')).toBe(true);
  });
});
