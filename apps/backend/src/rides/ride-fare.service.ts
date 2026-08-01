import { Injectable } from '@nestjs/common';
import { RideType } from '@prisma/client';

import { DEFAULT_RIDE_SPEED_MPS, RIDE_FARE_RATES } from './ride.constants';

export interface RideFareEstimate {
  distanceMeters: number;
  durationSeconds: number;
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  totalFare: number;
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
export class RideFareService {
  public estimate(
    rideType: RideType,
    pickup: { lat: number; lng: number },
    dropoff: { lat: number; lng: number },
  ): RideFareEstimate {
    const distanceMeters = haversineMeters(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
    const durationSeconds = Math.ceil(distanceMeters / DEFAULT_RIDE_SPEED_MPS);
    const distanceKm = distanceMeters / 1000;
    const durationMinutes = durationSeconds / 60;

    const rates = RIDE_FARE_RATES[rideType];
    const distanceFare = Math.round(distanceKm * rates.perKmRate);
    const timeFare = Math.round(durationMinutes * rates.perMinuteRate);
    const totalFare = rates.baseFare + distanceFare + timeFare;

    return {
      distanceMeters,
      durationSeconds,
      baseFare: rates.baseFare,
      distanceFare,
      timeFare,
      totalFare,
    };
  }
}
