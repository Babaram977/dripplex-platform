import { Inject, Injectable } from '@nestjs/common';
import { RideCancelledBy, RideStatus } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../events/domain-events';
import {
  NOTIFICATION_SERVICE,
  type NotificationService,
  type RideLifecycleEvent,
} from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';

import { RIDE_EVENTS_PUBLISHER, type RideEventsPublisher } from './ride-events.publisher';
import { haversineMeters } from './ride-fare.service';
import { RIDE_AUDIT_ACTIONS, RIDE_START_PROXIMITY_METERS } from './ride.constants';
import { toRideDto } from './ride.mapper';

import type { RideDto } from '@dripplex/types';
import type { Prisma, Ride } from '@prisma/client';

const DRIVER_CANCELLABLE_STATUSES: RideStatus[] = [RideStatus.DRIVER_ASSIGNED, RideStatus.ARRIVED];

/**
 * Driver-side trip lifecycle, entered once a ride has an assigned driver
 * (RIDE-002.4): DRIVER_ASSIGNED -> ARRIVED -> IN_PROGRESS -> COMPLETED, or a
 * driver-initiated CANCELLED before the trip starts. A driver can't cancel
 * once IN_PROGRESS — that's a completion, not a cancellation.
 */
@Injectable()
export class RideTripService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Inject(NOTIFICATION_SERVICE)
    private readonly notifications: NotificationService,
    @Inject(RIDE_EVENTS_PUBLISHER)
    private readonly events: RideEventsPublisher,
    private readonly eventBus: DomainEventBus,
  ) {}

  /** Which of the 4 real trip-lifecycle events feed the persisted in-app
   * notification feed (DPX-CORE-001) — 'ride_cancelled' has no mapped
   * NotificationType yet, so it's deliberately not included here. */
  private static readonly NOTIFICATION_EVENTS: Partial<Record<RideLifecycleEvent, string>> = {
    ride_arrived: DOMAIN_EVENTS.RIDE_DRIVER_ARRIVED,
    ride_started: DOMAIN_EVENTS.RIDE_STARTED,
    ride_completed: DOMAIN_EVENTS.RIDE_COMPLETED,
  };

  public async markArrived(
    driverId: string,
    rideId: string,
    context: AuditContext,
  ): Promise<RideDto> {
    const ride = await this.requireAssignedRide(driverId, rideId);
    this.requireStatus(ride, RideStatus.DRIVER_ASSIGNED, 'marked arrived');

    const updated = await this.prisma.ride.update({
      where: { id: ride.id },
      data: { status: RideStatus.ARRIVED, arrivedAt: new Date() },
    });

    await this.audit(RIDE_AUDIT_ACTIONS.ARRIVED, driverId, updated.id, context);
    await this.notifyAndPublish(updated, 'ride_arrived');
    return toRideDto(updated);
  }

  public async startTrip(
    driverId: string,
    rideId: string,
    context: AuditContext,
  ): Promise<RideDto> {
    const ride = await this.requireAssignedRide(driverId, rideId);
    this.requireStatus(ride, RideStatus.ARRIVED, 'started');
    const distanceMeters = await this.requireDriverNearPickup(driverId, ride);

    const updated = await this.prisma.ride.update({
      where: { id: ride.id },
      data: { status: RideStatus.IN_PROGRESS, startedAt: new Date() },
    });

    await this.audit(RIDE_AUDIT_ACTIONS.STARTED, driverId, updated.id, context, {
      distanceFromPickupMeters: distanceMeters,
    });
    await this.notifyAndPublish(updated, 'ride_started');
    return toRideDto(updated);
  }

  public async completeTrip(
    driverId: string,
    rideId: string,
    context: AuditContext,
  ): Promise<RideDto> {
    const ride = await this.requireAssignedRide(driverId, rideId);
    this.requireStatus(ride, RideStatus.IN_PROGRESS, 'completed');

    const [updated] = await this.prisma.$transaction([
      this.prisma.ride.update({
        where: { id: ride.id },
        data: { status: RideStatus.COMPLETED, completedAt: new Date() },
      }),
      this.prisma.driverAvailability.update({
        where: { driverId },
        data: { activeRideCount: { decrement: 1 } },
      }),
    ]);

    await this.audit(RIDE_AUDIT_ACTIONS.COMPLETED, driverId, updated.id, context);
    await this.notifyAndPublish(updated, 'ride_completed');
    return toRideDto(updated);
  }

  public async cancelByDriver(
    driverId: string,
    rideId: string,
    reason: string | undefined,
    context: AuditContext,
  ): Promise<RideDto> {
    const ride = await this.requireAssignedRide(driverId, rideId);
    if (!DRIVER_CANCELLABLE_STATUSES.includes(ride.status)) {
      throw new ConflictDomainException(
        `Ride cannot be cancelled by the driver from status ${ride.status}`,
      );
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.ride.update({
        where: { id: ride.id },
        data: {
          status: RideStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledBy: RideCancelledBy.DRIVER,
          ...(reason !== undefined ? { cancellationReason: reason } : {}),
        },
      }),
      this.prisma.driverAvailability.update({
        where: { driverId },
        data: { activeRideCount: { decrement: 1 } },
      }),
    ]);

    await this.auditService.record(
      RIDE_AUDIT_ACTIONS.CANCELLED,
      { ...context, userId: driverId },
      { resource: 'ride', resourceId: updated.id, metadata: { cancelledBy: 'DRIVER', reason } },
    );
    await this.notifyAndPublish(updated, 'ride_cancelled');
    return toRideDto(updated);
  }

  private requireStatus(ride: Ride, expected: RideStatus, action: string): void {
    if (ride.status !== expected) {
      throw new ConflictDomainException(`Ride cannot be ${action} from status ${ride.status}`);
    }
  }

  private async audit(
    action: string,
    driverId: string,
    rideId: string,
    context: AuditContext,
    metadata?: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.auditService.record(
      action,
      { ...context, userId: driverId },
      { resource: 'ride', resourceId: rideId, ...(metadata ? { metadata } : {}) },
    );
  }

  /**
   * Founder-locked decision: no mandatory passenger OTP/PIN before ride
   * start. Instead, gate "Start Ride" on the driver's last-known location
   * being within RIDE_START_PROXIMITY_METERS of the pickup point — reduces
   * accidental or fraudulent starts without requiring any passenger
   * interaction. Returns the measured distance for the audit trail.
   */
  private async requireDriverNearPickup(driverId: string, ride: Ride): Promise<number> {
    const availability = await this.prisma.driverAvailability.findUnique({
      where: { driverId },
    });
    if (!availability?.latitude || !availability.longitude) {
      throw new ValidationDomainException(
        'Driver location is not available; cannot verify proximity to pickup',
      );
    }

    const distanceMeters = haversineMeters(
      Number(availability.latitude),
      Number(availability.longitude),
      Number(ride.pickupLatitude),
      Number(ride.pickupLongitude),
    );
    if (distanceMeters > RIDE_START_PROXIMITY_METERS) {
      throw new ValidationDomainException(
        `Driver is too far from pickup to start the ride (${String(Math.round(distanceMeters))}m away, must be within ${String(RIDE_START_PROXIMITY_METERS)}m)`,
      );
    }
    return distanceMeters;
  }

  private async notifyAndPublish(ride: Ride, event: RideLifecycleEvent): Promise<void> {
    const customer = await this.prisma.user.findUnique({ where: { id: ride.customerId } });
    if (customer?.email) {
      await this.notifications.notifyRideLifecycle({
        audience: 'customer',
        email: customer.email,
        event,
        rideId: ride.id,
      });
    }

    this.events.publishToRide(ride.id, 'ride:status', {
      rideId: ride.id,
      status: ride.status,
      driverId: ride.driverId,
    });

    const domainEventName = RideTripService.NOTIFICATION_EVENTS[event];
    if (domainEventName) {
      await this.eventBus.emit(domainEventName, {
        customerId: ride.customerId,
        rideId: ride.id,
        totalFare: String(ride.totalFare),
      });
    }
  }

  private async requireAssignedRide(driverId: string, rideId: string): Promise<Ride> {
    const ride = await this.prisma.ride.findFirst({ where: { id: rideId, driverId } });
    if (!ride) {
      throw new NotFoundDomainException('Ride not found');
    }
    return ride;
  }
}
