import { Inject, Injectable } from '@nestjs/common';
import { DeliveryStatus } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ForbiddenDomainException,
  NotFoundDomainException,
  RateLimitedDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';

import { TRACKING_THROTTLE_MS, DELIVERY_AUDIT_ACTIONS } from './delivery.constants';
import { toTrackingDto, type TrackingDto } from './delivery.mapper';
import { DELIVERY_REPOSITORY, type DeliveryRepository } from './repositories/delivery.repository';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  heading?: number | null;
  speed?: number | null;
  accuracy?: number | null;
}

const TRACKABLE_STATUSES: DeliveryStatus[] = [
  DeliveryStatus.ACCEPTED,
  DeliveryStatus.PICKED_UP,
  DeliveryStatus.ON_THE_WAY,
  DeliveryStatus.ARRIVED,
];

@Injectable()
export class TrackingService {
  private readonly lastUpdateByJobId = new Map<string, number>();

  constructor(
    @Inject(DELIVERY_REPOSITORY)
    private readonly deliveryRepository: DeliveryRepository,
    private readonly auditService: AuditService,
  ) {}

  public async recordLocation(
    jobId: string,
    riderId: string,
    coords: LocationCoordinates,
    context: AuditContext = {},
  ): Promise<TrackingDto> {
    const now = Date.now();
    const job = await this.deliveryRepository.findJobById(jobId);
    if (!job) {
      throw new NotFoundDomainException('Delivery job not found');
    }
    if (job.riderId !== riderId) {
      throw new ForbiddenDomainException('Delivery job is not assigned to this rider');
    }
    if (!TRACKABLE_STATUSES.includes(job.status)) {
      throw new ValidationDomainException('Delivery job cannot be tracked in its current status');
    }

    const latest = await this.deliveryRepository.findLatestTracking(job.id);
    const lastUpdate = this.lastUpdateByJobId.get(jobId);
    if (lastUpdate !== undefined && now - lastUpdate < TRACKING_THROTTLE_MS) {
      if (latest) {
        return toTrackingDto(latest);
      }
      throw new RateLimitedDomainException(
        'Location updates are throttled',
        Math.ceil((TRACKING_THROTTLE_MS - (now - lastUpdate)) / 1000),
      );
    }

    if (job.status === DeliveryStatus.PICKED_UP && !latest) {
      await this.deliveryRepository.updateJobStatus(job.id, DeliveryStatus.ON_THE_WAY);
    }

    const tracking = await this.deliveryRepository.createTracking({
      deliveryJobId: job.id,
      latitude: coords.latitude,
      longitude: coords.longitude,
      ...(coords.heading !== undefined ? { heading: coords.heading } : {}),
      ...(coords.speed !== undefined ? { speed: coords.speed } : {}),
      ...(coords.accuracy !== undefined ? { accuracy: coords.accuracy } : {}),
    });
    this.lastUpdateByJobId.set(jobId, now);

    await this.auditService.record(
      DELIVERY_AUDIT_ACTIONS.LOCATION_UPDATED,
      { ...context, userId: riderId },
      {
        resource: 'delivery_job',
        resourceId: job.id,
        metadata: {
          latitude: coords.latitude,
          longitude: coords.longitude,
        },
      },
    );

    return toTrackingDto(tracking);
  }
}
