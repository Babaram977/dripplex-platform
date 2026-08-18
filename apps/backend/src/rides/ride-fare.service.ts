import { Injectable } from '@nestjs/common';
import { RideType } from '@prisma/client';

import { DEFAULT_RIDE_SPEED_MPS, RIDE_FARE_RATES, RIDE_MINIMUM_FARE } from './ride.constants';

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

export interface GeoBoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * The square that contains a circle of `radiusMeters` around a point.
 *
 * Exists so a proximity query can be narrowed in the database — four indexable
 * range comparisons — before any trigonometry runs in Node. Dispatch used to
 * load every online driver on the platform and rank them all in memory on
 * every attempt; that is the part that stops scaling.
 *
 * Deliberately a square, not a circle: it over-selects at the corners by up to
 * ~41%, and the caller re-filters with `haversineMeters`, which is what
 * actually decides who is inside the ring. Cheap over-selection beats an
 * unbounded scan.
 *
 * Known limit: a box that would cross the ±180° antimeridian is clamped rather
 * than split into two ranges, so it under-selects there. DrippleX operates
 * around 3–15°E, nowhere near it. Split the range here before serving a region
 * that is.
 */
export function boundingBox(
  latitude: number,
  longitude: number,
  radiusMeters: number,
): GeoBoundingBox {
  const earthRadiusMeters = 6_371_000;
  const latDelta = ((radiusMeters / earthRadiusMeters) * 180) / Math.PI;

  // Longitude degrees shrink towards the poles. The floor keeps the division
  // finite if this is ever called at a pole, where every longitude is in range.
  const cosLat = Math.max(Math.cos(toRadians(latitude)), 1e-6);
  const lngDelta = ((radiusMeters / (earthRadiusMeters * cosLat)) * 180) / Math.PI;

  return {
    minLat: Math.max(-90, latitude - latDelta),
    maxLat: Math.min(90, latitude + latDelta),
    minLng: Math.max(-180, longitude - lngDelta),
    maxLng: Math.min(180, longitude + lngDelta),
  };
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
    // The platform minimum is a floor, not an addition: a sub-kilometre trip
    // that computes to less than RIDE_MINIMUM_FARE is charged the minimum, and
    // anything above it is unaffected (founder decision, 2026-08-16).
    const computedFare = rates.baseFare + distanceFare + timeFare;
    const totalFare = Math.max(computedFare, RIDE_MINIMUM_FARE);

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
