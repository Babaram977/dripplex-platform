import type { CoordinatesDto, DeliveryZoneResult } from '@dripplex/types';

/**
 * Delivery zone helpers for future food/grocery/logistics geofencing.
 * Stub only — no external map providers.
 */
export interface DeliveryZoneService {
  isPointInsidePolygon(point: CoordinatesDto, polygon: CoordinatesDto[]): boolean;
  isWithinMerchantRadius(
    point: CoordinatesDto,
    merchant: CoordinatesDto,
    radiusKm: number,
  ): boolean;
  validateDeliveryZone(point: CoordinatesDto): DeliveryZoneResult;
  calculateDistanceKm(from: CoordinatesDto, to: CoordinatesDto): number;
}

export const DELIVERY_ZONE_SERVICE = Symbol('DELIVERY_ZONE_SERVICE');
