import { Inject, Injectable } from '@nestjs/common';

import { haversineMeters } from './delivery-fee.service';
import { MAX_RIDER_ACTIVE_JOBS } from './delivery.constants';
import {
  DELIVERY_REPOSITORY,
  type DeliveryCandidate,
  type DeliveryRepository,
} from './repositories/delivery.repository';

@Injectable()
export class AssignmentService {
  constructor(
    @Inject(DELIVERY_REPOSITORY)
    private readonly deliveryRepository: DeliveryRepository,
  ) {}

  /**
   * The nearest person who can carry this delivery — courier or opted-in
   * driver, ranked purely by distance.
   *
   * Couriers are NOT preferred over drivers here. Distance is the whole rule,
   * because the pool a driver joins is one they opted into, and quietly
   * ranking them last would mean a driver who turned the toggle on sees
   * almost nothing and concludes the feature is broken. The preference the
   * founder asked for lives in the opt-in itself: a driver receives deliveries
   * only if they said yes.
   */
  public async findNearestCourier(
    pickupLat: number,
    pickupLng: number,
    excludedUserIds: string[] = [],
  ): Promise<DeliveryCandidate | null> {
    const excluded = new Set(excludedUserIds);
    const candidates = (await this.deliveryRepository.listAvailableCouriers(MAX_RIDER_ACTIVE_JOBS))
      .filter((courier) => courier.latitude !== null && courier.longitude !== null)
      .filter((courier) => !excluded.has(courier.userId))
      .map((courier) => ({
        courier,
        distanceMeters: haversineMeters(
          pickupLat,
          pickupLng,
          Number(courier.latitude),
          Number(courier.longitude),
        ),
      }))
      .sort((left, right) => left.distanceMeters - right.distanceMeters);

    return candidates[0]?.courier ?? null;
  }
}
