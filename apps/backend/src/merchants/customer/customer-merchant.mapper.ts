import type {
  RatingSummaryDto,
  MerchantDetailDto,
  MerchantSummaryDto,
  OperatingHoursDayKey,
  OperatingHoursDto,
} from '@dripplex/types';
import type { Business } from '@prisma/client';

export const ZERO_RATING: RatingSummaryDto = { average: 0, count: 0 };

const EARTH_RADIUS_KM = 6371;

/** Straight-line (haversine) distance in km — not a routed/driving distance. */
export function distanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

const DAY_KEYS: OperatingHoursDayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/**
 * Reads operatingHours as wall-clock time with no timezone stored on the
 * business — this compares against server UTC time, so it's an approximation
 * until businesses carry a timezone field. Returns null when no hours are
 * set for today (render as "Hours unavailable", not "Closed").
 */
export function isOpenNow(hours: unknown, now: Date = new Date()): boolean | null {
  if (!hours || typeof hours !== 'object') {
    return null;
  }
  const dayKey = DAY_KEYS[now.getUTCDay()];
  const today = (hours as Record<string, unknown>)[dayKey as string];
  if (!today || typeof today !== 'object') {
    return null;
  }
  const { open, close } = today as { open?: unknown; close?: unknown };
  if (typeof open !== 'string' || typeof close !== 'string') {
    return null;
  }
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const openParts = open.split(':').map(Number);
  const closeParts = close.split(':').map(Number);
  const [openH, openM] = openParts;
  const [closeH, closeM] = closeParts;
  if (
    openH === undefined ||
    openM === undefined ||
    closeH === undefined ||
    closeM === undefined ||
    [openH, openM, closeH, closeM].some((n) => Number.isNaN(n))
  ) {
    return null;
  }
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;
  return nowMinutes >= openMinutes && nowMinutes < closeMinutes;
}

/**
 * Business.merchantId references User.id, not MerchantProfile.id — the id
 * space Product.merchantId actually uses. merchantProfileId must be passed
 * in explicitly (resolved via Business -> User -> MerchantProfile) so this
 * DTO's id lines up with ProductSummaryDto.merchantId for the Mini Store link.
 */
export function toMerchantSummaryDto(
  business: Business,
  merchantProfileId: string,
  rating: RatingSummaryDto = ZERO_RATING,
  fromLocation?: { lat: number; lng: number },
): MerchantSummaryDto {
  return {
    id: merchantProfileId,
    businessName: business.businessName,
    businessType: business.businessType,
    logoUrl: business.logoUrl,
    coverPhotoUrl: business.coverPhotoUrl,
    verificationStatus: business.verificationStatus,
    city: business.city,
    state: business.state,
    rating,
    distanceKm: fromLocation
      ? Number(
          distanceKm(fromLocation, {
            lat: Number(business.latitude),
            lng: Number(business.longitude),
          }).toFixed(1),
        )
      : null,
    isOpenNow: isOpenNow(business.operatingHours),
  };
}

export function toMerchantDetailDto(
  business: Business,
  merchantProfileId: string,
  rating: RatingSummaryDto,
  productCount: number,
  fromLocation?: { lat: number; lng: number },
): MerchantDetailDto {
  return {
    ...toMerchantSummaryDto(business, merchantProfileId, rating, fromLocation),
    description: business.description,
    address: business.address,
    country: business.country,
    phone: business.phone,
    email: business.email,
    operatingHours: (business.operatingHours as OperatingHoursDto | null) ?? null,
    productCount,
  };
}
