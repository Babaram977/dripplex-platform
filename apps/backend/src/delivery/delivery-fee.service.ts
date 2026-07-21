import { Injectable } from '@nestjs/common';

import { DEFAULT_SPEED_MPS, FEE_PER_KM, MIN_DELIVERY_FEE } from './delivery.constants';

export interface DeliveryFeeEstimate {
  fee: number;
  distanceMeters: number;
  durationSeconds: number;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadiusMeters = 6_371_000;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(earthRadiusMeters * c);
}

@Injectable()
export class DeliveryFeeService {
  public estimate(
    distanceMeters: number,
    merchantOverrideFee?: number | null,
  ): DeliveryFeeEstimate {
    const safeDistanceMeters = Math.max(0, Math.round(distanceMeters));
    const distanceKm = safeDistanceMeters / 1000;
    const calculatedFee = Math.max(MIN_DELIVERY_FEE, Math.round(distanceKm * FEE_PER_KM));

    return {
      fee: merchantOverrideFee ?? calculatedFee,
      distanceMeters: safeDistanceMeters,
      durationSeconds: Math.ceil(safeDistanceMeters / DEFAULT_SPEED_MPS),
    };
  }
}
