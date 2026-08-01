import { Inject, Injectable } from '@nestjs/common';
import { DriverStatus, RideOfferStatus, RideStatus } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
} from '../common/exceptions/domain.exception';
import {
  NOTIFICATION_SERVICE,
  type NotificationService,
} from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';

import { RIDE_EVENTS_PUBLISHER, type RideEventsPublisher } from './ride-events.publisher';
import { haversineMeters } from './ride-fare.service';
import { MAX_DISPATCH_ATTEMPTS, RIDE_AUDIT_ACTIONS, RIDE_OFFER_TIMEOUT_MS } from './ride.constants';
import { toRideDto, toRideOfferDto } from './ride.mapper';

import type { RideDto, RideOfferDto } from '@dripplex/types';
import type { DriverAvailability, Ride, RideOffer } from '@prisma/client';

/**
 * Finds the nearest eligible driver, creates an offer, and — on decline or
 * expiry — retries the next-nearest candidate, up to MAX_DISPATCH_ATTEMPTS.
 * Dispatch correctness never depends on realtime: a driver discovers a
 * pending offer either by polling GET /driver/rides/offers or via the
 * best-effort RIDE_EVENTS_PUBLISHER push (RIDE-002.5); expiry is swept
 * lazily by RideOfferSweepService, mirroring ReservationCleanupService's
 * pattern (plain setInterval, no @nestjs/schedule dependency).
 */
@Injectable()
export class RideDispatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Inject(NOTIFICATION_SERVICE)
    private readonly notifications: NotificationService,
    @Inject(RIDE_EVENTS_PUBLISHER)
    private readonly events: RideEventsPublisher,
  ) {}

  public async dispatchRide(rideId: string): Promise<RideDto> {
    const ride = await this.requireRide(rideId);

    if (ride.status !== RideStatus.REQUESTED && ride.status !== RideStatus.SEARCHING) {
      return toRideDto(ride);
    }

    const attemptedDriverIds = (
      await this.prisma.rideOffer.findMany({
        where: { rideId: ride.id },
        select: { driverId: true },
      })
    ).map((offer) => offer.driverId);

    if (attemptedDriverIds.length >= MAX_DISPATCH_ATTEMPTS) {
      return await this.giveUp(ride);
    }

    const candidate = await this.findNearestEligibleDriver(
      ride.rideType,
      Number(ride.pickupLatitude),
      Number(ride.pickupLongitude),
      attemptedDriverIds,
    );

    if (!candidate) {
      return await this.giveUp(ride);
    }

    await this.prisma.rideOffer.create({
      data: {
        rideId: ride.id,
        driverId: candidate.driverId,
        expiresAt: new Date(Date.now() + RIDE_OFFER_TIMEOUT_MS),
      },
    });

    const updated = await this.prisma.ride.update({
      where: { id: ride.id },
      data: { status: RideStatus.SEARCHING },
    });

    await this.auditService.record(
      RIDE_AUDIT_ACTIONS.OFFERED,
      {},
      { resource: 'ride', resourceId: ride.id, metadata: { driverId: candidate.driverId } },
    );
    await this.notifyUser(candidate.driverId, 'driver', 'ride_offered', ride.id);
    this.events.publishToDriver(candidate.driverId, 'ride:offered', { rideId: ride.id });

    return toRideDto(updated);
  }

  public async listOwnOffers(driverId: string): Promise<RideOfferDto[]> {
    const offers = await this.prisma.rideOffer.findMany({
      where: { driverId, status: RideOfferStatus.PENDING, expiresAt: { gt: new Date() } },
      orderBy: { offeredAt: 'asc' },
    });
    return offers.map(toRideOfferDto);
  }

  public async acceptOffer(
    driverId: string,
    offerId: string,
    context: AuditContext,
  ): Promise<RideDto> {
    const offer = await this.requireLiveOffer(driverId, offerId);

    const [, , updatedRide] = await this.prisma.$transaction([
      this.prisma.rideOffer.update({
        where: { id: offer.id },
        data: { status: RideOfferStatus.ACCEPTED, respondedAt: new Date() },
      }),
      this.prisma.driverAvailability.update({
        where: { driverId },
        data: { activeRideCount: { increment: 1 } },
      }),
      this.prisma.ride.update({
        where: { id: offer.rideId },
        data: {
          status: RideStatus.DRIVER_ASSIGNED,
          driverId,
          assignedAt: new Date(),
        },
      }),
    ]);

    await this.auditService.record(
      RIDE_AUDIT_ACTIONS.OFFER_ACCEPTED,
      { ...context, userId: driverId },
      { resource: 'ride', resourceId: offer.rideId, metadata: { driverId } },
    );
    await this.notifyUser(updatedRide.customerId, 'customer', 'ride_assigned', updatedRide.id);
    this.events.publishToRide(updatedRide.id, 'ride:status', {
      rideId: updatedRide.id,
      status: updatedRide.status,
      driverId: updatedRide.driverId,
    });

    return toRideDto(updatedRide);
  }

  public async declineOffer(
    driverId: string,
    offerId: string,
    context: AuditContext,
  ): Promise<void> {
    const offer = await this.requireLiveOffer(driverId, offerId);

    await this.prisma.rideOffer.update({
      where: { id: offer.id },
      data: { status: RideOfferStatus.DECLINED, respondedAt: new Date() },
    });

    await this.auditService.record(
      RIDE_AUDIT_ACTIONS.OFFER_DECLINED,
      { ...context, userId: driverId },
      { resource: 'ride', resourceId: offer.rideId, metadata: { driverId } },
    );

    await this.dispatchRide(offer.rideId);
  }

  /** Called by RideOfferSweepService on a timer — expires stale offers and retries dispatch. */
  public async expireStaleOffers(): Promise<number> {
    const stale = await this.prisma.rideOffer.findMany({
      where: { status: RideOfferStatus.PENDING, expiresAt: { lt: new Date() } },
    });

    for (const offer of stale) {
      await this.prisma.rideOffer.update({
        where: { id: offer.id },
        data: { status: RideOfferStatus.EXPIRED, respondedAt: new Date() },
      });
      await this.auditService.record(
        RIDE_AUDIT_ACTIONS.OFFER_EXPIRED,
        {},
        { resource: 'ride', resourceId: offer.rideId, metadata: { driverId: offer.driverId } },
      );
      await this.dispatchRide(offer.rideId);
    }

    return stale.length;
  }

  private async findNearestEligibleDriver(
    rideType: Ride['rideType'],
    pickupLat: number,
    pickupLng: number,
    excludedDriverIds: string[],
  ): Promise<DriverAvailability | null> {
    const candidates = await this.prisma.driverAvailability.findMany({
      where: {
        online: true,
        acceptingRides: true,
        vehicleType: rideType,
        activeRideCount: 0,
        driverId: { notIn: excludedDriverIds },
        driver: {
          driverProfile: { status: DriverStatus.APPROVED },
          rideOffers: { none: { status: RideOfferStatus.PENDING } },
        },
      },
    });

    const ranked = candidates
      .filter((driver) => driver.latitude !== null && driver.longitude !== null)
      .map((driver) => ({
        driver,
        distanceMeters: haversineMeters(
          pickupLat,
          pickupLng,
          Number(driver.latitude),
          Number(driver.longitude),
        ),
      }))
      .sort((left, right) => left.distanceMeters - right.distanceMeters);

    return ranked[0]?.driver ?? null;
  }

  private async giveUp(ride: Ride): Promise<RideDto> {
    const updated = await this.prisma.ride.update({
      where: { id: ride.id },
      data: { status: RideStatus.NO_DRIVERS_FOUND },
    });
    await this.auditService.record(
      RIDE_AUDIT_ACTIONS.NO_DRIVERS_FOUND,
      {},
      { resource: 'ride', resourceId: ride.id },
    );
    await this.notifyUser(updated.customerId, 'customer', 'ride_no_drivers_found', updated.id);
    this.events.publishToRide(updated.id, 'ride:status', {
      rideId: updated.id,
      status: updated.status,
      driverId: null,
    });
    return toRideDto(updated);
  }

  private async notifyUser(
    userId: string,
    audience: 'customer' | 'driver',
    event: 'ride_offered' | 'ride_assigned' | 'ride_no_drivers_found',
    rideId: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.email) {
      return;
    }
    await this.notifications.notifyRideLifecycle({ audience, email: user.email, event, rideId });
  }

  private async requireRide(rideId: string): Promise<Ride> {
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) {
      throw new NotFoundDomainException('Ride not found');
    }
    return ride;
  }

  private async requireLiveOffer(driverId: string, offerId: string): Promise<RideOffer> {
    const offer = await this.prisma.rideOffer.findFirst({ where: { id: offerId, driverId } });
    if (!offer) {
      throw new NotFoundDomainException('Ride offer not found');
    }
    if (offer.status !== RideOfferStatus.PENDING) {
      throw new ConflictDomainException(`Offer is no longer pending (status: ${offer.status})`);
    }
    if (offer.expiresAt.getTime() < Date.now()) {
      throw new ConflictDomainException('Offer has expired');
    }
    return offer;
  }
}
