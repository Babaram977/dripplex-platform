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
import { haversineMeters, RideFareService } from './ride-fare.service';
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
    private readonly fareService: RideFareService,
  ) {}

  /** Which trip-lifecycle events feed the persisted in-app notification
   * feed (DPX-CORE-001). ride_cancelled's payload below always carries
   * customerId (this service only cancels rides on the driver's behalf),
   * which the RIDE_CANCELLED mapping's userKeys picks up — the same
   * mapping RidesService.cancelRide uses with driverId instead, since only
   * one of the two ids is ever present per emission. */
  private static readonly NOTIFICATION_EVENTS: Partial<Record<RideLifecycleEvent, string>> = {
    ride_arrived: DOMAIN_EVENTS.RIDE_DRIVER_ARRIVED,
    ride_started: DOMAIN_EVENTS.RIDE_STARTED,
    ride_completed: DOMAIN_EVENTS.RIDE_COMPLETED,
    ride_cancelled: DOMAIN_EVENTS.RIDE_CANCELLED,
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
    verificationCode: string | undefined,
    context: AuditContext,
  ): Promise<RideDto> {
    const ride = await this.requireAssignedRide(driverId, rideId);
    this.requireStatus(ride, RideStatus.ARRIVED, 'started');
    this.requireVerificationCode(ride, verificationCode);
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

    const completedAt = new Date();
    const repriced = await this.repriceOnActualDuration(ride, completedAt);

    const [updated] = await this.prisma.$transaction([
      this.prisma.ride.update({
        where: { id: ride.id },
        data: {
          status: RideStatus.COMPLETED,
          completedAt,
          ...repriced.data,
        },
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

  /**
   * DPX-PRICING-002 — charge the time the trip actually took.
   *
   * The fare was quoted at request from an assumed 30 km/h, which made the
   * per-minute rate a second per-km rate: a driver held up in traffic was paid
   * the same as one on an empty road. Founder decision 2026-08-27 — real
   * elapsed time is charged, because that is what a time rate is for.
   *
   * Safe to charge more here because **payment is gated on completion**:
   * RidePaymentService refuses both the gateway and cash paths unless the ride
   * is already COMPLETED, so nobody has paid the quote by the time this runs.
   * There is no second charge and no refund to reconcile. If that gate ever
   * moves, this becomes a double-charge and the two must be changed together.
   *
   * Deliberately not done here:
   *
   * - **No cap.** A short trip in gridlock can exceed a long one on an open
   *   road. That is the honest consequence of charging for time, and a cap is a
   *   pricing decision to take on real Kano data rather than a guess now
   *   (founder, 2026-08-27).
   * - **The meter starts at `startedAt`**, when the driver taps Start with the
   *   passenger aboard — not at acceptance. Time spent waiting at the kerb is
   *   still unpaid; waiting fees were excluded from this launch.
   * - **The promo discount is not rescaled.** It was granted against the quote,
   *   and re-deriving it here would reopen the redemption accounting for a
   *   number the customer already accepted.
   *
   * Known consequence, recorded rather than papered over: the whole fare is
   * recomputed from the rates **live at completion**, so an Ops rate edit made
   * while a trip is running applies to that trip. The window is the length of
   * one ride and the alternative — snapshotting the four rate values onto every
   * ride row at booking — is a schema decision that needs founder sign-off, so
   * it is logged as a gap rather than invented here.
   */
  private async repriceOnActualDuration(
    ride: Ride,
    completedAt: Date,
  ): Promise<{ data: Prisma.RideUncheckedUpdateInput }> {
    if (ride.startedAt === null) {
      // Cannot happen from IN_PROGRESS, which is the only status this is
      // reached from — but a fare must never silently price on a null.
      return { data: {} };
    }

    const actualDurationSeconds = Math.max(
      0,
      Math.round((completedAt.getTime() - ride.startedAt.getTime()) / 1_000),
    );

    const priced = await this.fareService.price(
      ride.rideType,
      { lat: Number(ride.pickupLatitude), lng: Number(ride.pickupLongitude) },
      { lat: Number(ride.dropoffLatitude), lng: Number(ride.dropoffLongitude) },
      actualDurationSeconds,
    );

    const promoDiscount = Number(ride.promoDiscount);
    const totalFare = Math.max(0, Math.round(priced.totalFare - promoDiscount));

    return {
      data: {
        actualDurationSeconds,
        // Preserved once, so the receipt can show the passenger what they were
        // quoted next to what they paid. The `??` makes the write idempotent:
        // a second repricing would otherwise record the first repriced total
        // as the "quote" and lose the number the passenger actually agreed to.
        quotedTotalFare: ride.quotedTotalFare ?? ride.totalFare,
        baseFare: priced.baseFare,
        distanceFare: priced.distanceFare,
        timeFare: priced.timeFare,
        // Re-snapshotted with the amount, not left at the quote's values: a
        // percentage surcharge scales with the metered fare, and a zone
        // deactivated mid-trip resolves to nothing. Either way the stored
        // amount and the stored zone name have to describe the same charge,
        // or the receipt names a zone for money nobody added.
        surchargeAmount: priced.surchargeAmount,
        surchargeZoneId: priced.surchargeZoneId,
        surchargeZoneName: priced.surchargeZoneName,
        totalFare,
      },
    };
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
   * The passenger's trip code — the proof that the person getting into the car
   * is the person who booked it. Generated when the driver accepts the offer,
   * shown only in the passenger's app, and read out at the kerb.
   *
   * Rides assigned before trip codes existed carry no code; those skip the
   * check rather than becoming permanently unstartable.
   */
  private requireVerificationCode(ride: Ride, supplied: string | undefined): void {
    if (ride.verificationCode === null) {
      return;
    }
    if (supplied?.trim() !== ride.verificationCode) {
      throw new ValidationDomainException(
        'That trip code does not match. Ask your passenger to read the code shown in their app.',
      );
    }
  }

  /**
   * The second half of the start gate: the driver's last-known location must
   * be within RIDE_START_PROXIMITY_METERS of the pickup point. The trip code
   * proves *who* is in the car; this proves the car is at the kerb it was
   * sent to. Returns the measured distance for the audit trail.
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
