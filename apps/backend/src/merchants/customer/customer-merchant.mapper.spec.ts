import { distanceKm, isOpenNow, toMerchantSummaryDto } from './customer-merchant.mapper';

import type { Business } from '@prisma/client';

/** Only the fields toMerchantSummaryDto reads. Building a whole Business row
 * would say nothing extra about the distance rule under test. */
function businessAt(latitude: number, longitude: number): Business {
  return {
    businessName: 'Nasara Pharmacy',
    businessType: 'SOLE_PROPRIETORSHIP',
    category: 'PHARMACY',
    logoUrl: null,
    coverPhotoUrl: null,
    verificationStatus: 'VERIFIED',
    city: '',
    state: '',
    operatingHours: null,
    latitude,
    longitude,
  } as unknown as Business;
}

const KANO = { lat: 12.0022, lng: 8.592 };

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

describe('toMerchantSummaryDto — distance to a shop we cannot place', () => {
  it('reports no distance for a merchant sitting at 0,0', () => {
    // 0,0 is the schema's fallback when geocoding never resolved the address,
    // not a location. Measured literally it is 1,637 km from Kano — so three
    // live merchants were being shown as impossibly far rather than as
    // unplaced, and could never reach the top of a "nearest" list.
    expect(toMerchantSummaryDto(businessAt(0, 0), 'mp-1', undefined, KANO).distanceKm).toBeNull();
  });

  it('still measures a merchant we can place', () => {
    const dto = toMerchantSummaryDto(businessAt(12.0106, 8.5919), 'mp-2', undefined, KANO);
    expect(dto.distanceKm).not.toBeNull();
    expect(dto.distanceKm).toBeLessThan(5);
  });

  it('reports no distance when the customer has no location either', () => {
    expect(toMerchantSummaryDto(businessAt(12.0106, 8.5919), 'mp-3').distanceKm).toBeNull();
  });
});
