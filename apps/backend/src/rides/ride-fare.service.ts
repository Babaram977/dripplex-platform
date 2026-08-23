import { Injectable } from '@nestjs/common';

import { haversineMeters } from './ride-geo';
import { RidePricingService } from './ride-pricing.service';
import { DEFAULT_RIDE_SPEED_MPS } from './ride.constants';

import type { RideType } from '@prisma/client';

export interface RideFareEstimate {
  distanceMeters: number;
  durationSeconds: number;
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  /** Naira added by a surcharge zone, or 0. Broken out so a receipt can show
   * the line rather than folding it invisibly into the total. */
  surchargeAmount: number;
  /** The zone that added it, snapshotted for the receipt, or null. */
  surchargeZoneId: string | null;
  surchargeZoneName: string | null;
  /** base + distance + time, before any surcharge and before the floor. The
   * number the itemised lines actually add up to. */
  meteredFare: number;
  /** The floor in force for this ride type. Sent whether or not it bit, so a
   * breakdown can say why a short trip costs what it costs. */
  minimumFare: number;
  /** True when the floor decided the price — i.e. the metered fare plus any
   * surcharge came in under it. */
  minimumFareApplied: boolean;
  totalFare: number;
}

@Injectable()
export class RideFareService {
  constructor(private readonly pricing: RidePricingService) {}

  /**
   * Prices a trip from the Ops-editable fare table.
   *
   * The rates were a hardcoded constant until the pricing console; they now
   * come from `ride_fare_rates`, seeded from those same constants so the first
   * fare quoted after the change matches the last one quoted before it.
   *
   * Order matters: the metered fare is base + distance + time, a surcharge
   * zone is applied to that, and the minimum is a floor under the result — not
   * an addition. A sub-kilometre trip that prices below the minimum is charged
   * the minimum (founder decision, 2026-08-16); anything above is unaffected.
   */
  public async estimate(
    rideType: RideType,
    pickup: { lat: number; lng: number },
    dropoff: { lat: number; lng: number },
  ): Promise<RideFareEstimate> {
    const distanceMeters = haversineMeters(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
    const durationSeconds = Math.ceil(distanceMeters / DEFAULT_RIDE_SPEED_MPS);
    const distanceKm = distanceMeters / 1000;
    const durationMinutes = durationSeconds / 60;

    const rates = await this.pricing.getRate(rideType);
    const distanceFare = Math.round(distanceKm * rates.perKmRate);
    const timeFare = Math.round(durationMinutes * rates.perMinuteRate);
    const meteredFare = rates.baseFare + distanceFare + timeFare;

    const surcharge = await this.pricing.resolveSurcharge(pickup, dropoff, meteredFare);
    const surchargeAmount = surcharge?.amount ?? 0;

    const beforeFloor = meteredFare + surchargeAmount;
    const totalFare = Math.max(beforeFloor, rates.minimumFare);

    return {
      distanceMeters,
      durationSeconds,
      baseFare: rates.baseFare,
      distanceFare,
      timeFare,
      surchargeAmount,
      surchargeZoneId: surcharge?.zoneId ?? null,
      surchargeZoneName: surcharge?.zoneName ?? null,
      meteredFare,
      minimumFare: rates.minimumFare,
      // Reported rather than left for the client to infer. A breakdown that
      // lists base + distance + time and then shows a larger total, with
      // nothing accounting for the gap, reads as an overcharge — which is
      // exactly how a ₦564 trip quoted at ₦1,500 was reported.
      minimumFareApplied: beforeFloor < rates.minimumFare,
      totalFare,
    };
  }
}

// Re-exported so the ride module's existing `from './ride-fare.service'`
// imports keep resolving. New code should import from './ride-geo' directly.
export { boundingBox, haversineMeters, type GeoBoundingBox } from './ride-geo';
