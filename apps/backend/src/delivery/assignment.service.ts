import { Inject, Injectable } from '@nestjs/common';

import { haversineMeters } from './delivery-fee.service';
import { MAX_RIDER_ACTIVE_JOBS } from './delivery.constants';
import { DELIVERY_REPOSITORY, type DeliveryRepository } from './repositories/delivery.repository';

import type { RiderAvailability } from '@prisma/client';

@Injectable()
export class AssignmentService {
  constructor(
    @Inject(DELIVERY_REPOSITORY)
    private readonly deliveryRepository: DeliveryRepository,
  ) {}

  public async findNearestRider(
    pickupLat: number,
    pickupLng: number,
    excludedRiderIds: string[] = [],
  ): Promise<RiderAvailability | null> {
    const excluded = new Set(excludedRiderIds);
    const candidates = (await this.deliveryRepository.listAvailableRiders(MAX_RIDER_ACTIVE_JOBS))
      .filter((rider) => rider.latitude !== null && rider.longitude !== null)
      .filter((rider) => !excluded.has(rider.riderId))
      .map((rider) => ({
        rider,
        distanceMeters: haversineMeters(
          pickupLat,
          pickupLng,
          Number(rider.latitude),
          Number(rider.longitude),
        ),
      }))
      .sort((left, right) => left.distanceMeters - right.distanceMeters);

    return candidates[0]?.rider ?? null;
  }
}
