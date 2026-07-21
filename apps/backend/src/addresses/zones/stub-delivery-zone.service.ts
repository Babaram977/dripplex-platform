import { Injectable } from '@nestjs/common';

import type { DeliveryZoneService } from './delivery-zone.service';
import type { CoordinatesDto, DeliveryZoneResult } from '@dripplex/types';

/**
 * Stub delivery-zone implementation.
 * Always allows points with valid coordinates; polygon/geofence hooks are ready for later.
 */
@Injectable()
export class StubDeliveryZoneService implements DeliveryZoneService {
  public isPointInsidePolygon(point: CoordinatesDto, polygon: CoordinatesDto[]): boolean {
    if (polygon.length < 3) {
      return false;
    }

    // Ray-casting algorithm
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i]?.longitude ?? 0;
      const yi = polygon[i]?.latitude ?? 0;
      const xj = polygon[j]?.longitude ?? 0;
      const yj = polygon[j]?.latitude ?? 0;

      const intersect =
        yi > point.latitude !== yj > point.latitude &&
        point.longitude < ((xj - xi) * (point.latitude - yi)) / (yj - yi + Number.EPSILON) + xi;
      if (intersect) {
        inside = !inside;
      }
    }
    return inside;
  }

  public isWithinMerchantRadius(
    point: CoordinatesDto,
    merchant: CoordinatesDto,
    radiusKm: number,
  ): boolean {
    return this.calculateDistanceKm(point, merchant) <= radiusKm;
  }

  public validateDeliveryZone(point: CoordinatesDto): DeliveryZoneResult {
    const valid =
      point.latitude >= -90 &&
      point.latitude <= 90 &&
      point.longitude >= -180 &&
      point.longitude <= 180;

    return {
      allowed: valid,
      reason: valid ? null : 'Coordinates outside valid ranges',
      provider: 'stub',
    };
  }

  public calculateDistanceKm(from: CoordinatesDto, to: CoordinatesDto): number {
    const toRad = (deg: number): number => (deg * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(to.latitude - from.latitude);
    const dLon = toRad(to.longitude - from.longitude);
    const lat1 = toRad(from.latitude);
    const lat2 = toRad(to.latitude);

    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  }
}
