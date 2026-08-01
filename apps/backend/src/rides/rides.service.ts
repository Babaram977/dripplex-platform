import { Inject, Injectable } from '@nestjs/common';
import { RideCancelledBy, RideStatus } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import {
  NOTIFICATION_SERVICE,
  type NotificationService,
} from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';

import { RideDispatchService } from './ride-dispatch.service';
import { RIDE_EVENTS_PUBLISHER, type RideEventsPublisher } from './ride-events.publisher';
import { RideFareService } from './ride-fare.service';
import { CANCELLABLE_RIDE_STATUSES, RIDE_AUDIT_ACTIONS } from './ride.constants';
import { toDriverAvailabilityDto, toRideDto } from './ride.mapper';

import type { ListRidesQueryDto } from './dto/list-rides-query.dto';
import type { CancelRideDto, RequestRideDto } from './dto/request-ride.dto';
import type { UpdateDriverAvailabilityDto } from './dto/update-driver-availability.dto';
import type { DriverAvailabilityDto, RideDto } from '@dripplex/types';
import type { Ride } from '@prisma/client';

@Injectable()
export class RidesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fareService: RideFareService,
    private readonly auditService: AuditService,
    private readonly dispatchService: RideDispatchService,
    @Inject(NOTIFICATION_SERVICE)
    private readonly notifications: NotificationService,
    @Inject(RIDE_EVENTS_PUBLISHER)
    private readonly events: RideEventsPublisher,
  ) {}

  public async requestRide(
    customerId: string,
    dto: RequestRideDto,
    context: AuditContext,
  ): Promise<RideDto> {
    const estimate = this.fareService.estimate(
      dto.rideType,
      { lat: dto.pickupLatitude, lng: dto.pickupLongitude },
      { lat: dto.dropoffLatitude, lng: dto.dropoffLongitude },
    );

    const ride = await this.prisma.ride.create({
      data: {
        customerId,
        rideType: dto.rideType,
        pickupLatitude: dto.pickupLatitude,
        pickupLongitude: dto.pickupLongitude,
        ...(dto.pickupAddress !== undefined ? { pickupAddress: dto.pickupAddress } : {}),
        dropoffLatitude: dto.dropoffLatitude,
        dropoffLongitude: dto.dropoffLongitude,
        ...(dto.dropoffAddress !== undefined ? { dropoffAddress: dto.dropoffAddress } : {}),
        estimatedDistanceMeters: estimate.distanceMeters,
        estimatedDurationSeconds: estimate.durationSeconds,
        baseFare: estimate.baseFare,
        distanceFare: estimate.distanceFare,
        timeFare: estimate.timeFare,
        totalFare: estimate.totalFare,
      },
    });

    await this.auditService.record(
      RIDE_AUDIT_ACTIONS.REQUESTED,
      { ...context, userId: customerId },
      { resource: 'ride', resourceId: ride.id, metadata: { rideType: ride.rideType } },
    );

    return await this.dispatchService.dispatchRide(ride.id);
  }

  public async getOwnRide(customerId: string, rideId: string): Promise<RideDto> {
    const ride = await this.requireOwnedRide(customerId, rideId);
    return toRideDto(ride);
  }

  public async listOwnRides(
    customerId: string,
    query: ListRidesQueryDto,
  ): Promise<{
    items: RideDto[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const where = { customerId, ...(query.status ? { status: query.status } : {}) };
    const [rides, total] = await Promise.all([
      this.prisma.ride.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.ride.count({ where }),
    ]);

    return {
      items: rides.map(toRideDto),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  public async cancelRide(
    customerId: string,
    rideId: string,
    dto: CancelRideDto,
    context: AuditContext,
  ): Promise<RideDto> {
    const ride = await this.requireOwnedRide(customerId, rideId);

    if (!CANCELLABLE_RIDE_STATUSES.includes(ride.status)) {
      throw new ValidationDomainException(`Ride cannot be cancelled from status ${ride.status}`);
    }

    const rideUpdate = this.prisma.ride.update({
      where: { id: ride.id },
      data: {
        status: RideStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledBy: RideCancelledBy.CUSTOMER,
        ...(dto.reason !== undefined ? { cancellationReason: dto.reason } : {}),
      },
    });

    const updated = ride.driverId
      ? (
          await this.prisma.$transaction([
            rideUpdate,
            this.prisma.driverAvailability.update({
              where: { driverId: ride.driverId },
              data: { activeRideCount: { decrement: 1 } },
            }),
          ])
        )[0]
      : await rideUpdate;

    await this.auditService.record(
      RIDE_AUDIT_ACTIONS.CANCELLED,
      { ...context, userId: customerId },
      { resource: 'ride', resourceId: ride.id, metadata: { reason: dto.reason } },
    );

    if (ride.driverId) {
      await this.notifyDriver(ride.driverId, updated.id);
      this.events.publishToRide(updated.id, 'ride:status', {
        rideId: updated.id,
        status: updated.status,
        driverId: updated.driverId,
      });
    }

    return toRideDto(updated);
  }

  private async notifyDriver(driverId: string, rideId: string): Promise<void> {
    const driver = await this.prisma.user.findUnique({ where: { id: driverId } });
    if (!driver?.email) {
      return;
    }
    await this.notifications.notifyRideLifecycle({
      audience: 'driver',
      email: driver.email,
      event: 'ride_cancelled',
      rideId,
    });
  }

  public async updateDriverAvailability(
    driverId: string,
    dto: UpdateDriverAvailabilityDto,
  ): Promise<DriverAvailabilityDto> {
    const availability = await this.prisma.driverAvailability.upsert({
      where: { driverId },
      create: {
        driverId,
        online: dto.online,
        acceptingRides: dto.acceptingRides,
        vehicleType: dto.vehicleType,
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
      },
      update: {
        online: dto.online,
        acceptingRides: dto.acceptingRides,
        vehicleType: dto.vehicleType,
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
      },
    });
    return toDriverAvailabilityDto(availability);
  }

  private async requireOwnedRide(customerId: string, rideId: string): Promise<Ride> {
    const ride = await this.prisma.ride.findFirst({ where: { id: rideId, customerId } });
    if (!ride) {
      throw new NotFoundDomainException('Ride not found');
    }
    return ride;
  }
}
