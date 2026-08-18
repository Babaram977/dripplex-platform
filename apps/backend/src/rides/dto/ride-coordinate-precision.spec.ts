import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { RequestRideDto } from './request-ride.dto';

/**
 * Pins the coordinate-precision contract that made rides unbookable in
 * production: the browser and the Google geocoder both emit full double
 * precision, and every coordinate DTO caps at 7 decimal places.
 */
describe('ride coordinate precision', () => {
  const base = {
    rideType: 'ECONOMY',
    pickupLatitude: 12.0021847,
    pickupLongitude: 8.5167008,
    dropoffLatitude: 11.9963062,
    dropoffLongitude: 8.5236,
  };

  it('rejects a raw geocoder longitude — this is the production failure', async () => {
    // Exactly the shape google.maps LatLng.lng() returns.
    const dto = plainToInstance(RequestRideDto, { ...base, pickupLongitude: 8.516700799999999 });
    const errors = await validate(dto);
    const longitude = errors.find((e) => e.property === 'pickupLongitude');
    expect(longitude).toBeDefined();
    expect(JSON.stringify(longitude?.constraints)).toContain('number');
  });

  it('rejects raw device-GPS precision too', async () => {
    const dto = plainToInstance(RequestRideDto, { ...base, pickupLatitude: 12.00218474839201 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'pickupLatitude')).toBe(true);
  });

  it('accepts the same coordinates once rounded to 7dp, as the app now sends them', async () => {
    const round = (v: number): number => Number(v.toFixed(7));
    const dto = plainToInstance(RequestRideDto, {
      ...base,
      pickupLatitude: round(12.00218474839201),
      pickupLongitude: round(8.516700799999999),
    });
    expect(await validate(dto)).toHaveLength(0);
  });
});
