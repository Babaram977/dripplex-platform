import { Inject, Injectable } from '@nestjs/common';
import { DriverStatus, RideOfferStatus, RideStatus } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
} from '../common/exceptions/domain.exception';
import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../events/domain-events';
import {
  NOTIFICATION_SERVICE,
  type NotificationService,
} from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';

import { RIDE_EVENTS_PUBLISHER, type RideEventsPublisher } from './ride-events.publisher';
import { boundingBox, haversineMeters } from './ride-fare.service';
import {
  DRIVER_LOCATION_MAX_AGE_MS,
  MAX_DISPATCH_ATTEMPTS,
  RIDE_AUDIT_ACTIONS,
  RIDE_DISPATCH_RADIUS_BANDS_METERS,
  RIDE_OFFER_TIMEOUT_MS,
  RIDE_SEARCH_WINDOW_MS,
} from './ride.constants';
import { toRideDto, toRideOfferDto, toRideOfferPreviewDto } from './ride.mapper';

import type { RideDto, RideOfferDto, RideOfferPreviewDto } from '@dripplex/types';
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
    private readonly eventBus: DomainEventBus,
  ) {}

  public async dispatchRide(rideId: string): Promise<RideDto> {
    const ride = await this.requireRide(rideId);

    if (ride.status !== RideStatus.REQUESTED && ride.status !== RideStatus.SEARCHING) {
      return toRideDto(ride);
    }

    const offers = await this.prisma.rideOffer.findMany({
      where: { rideId: ride.id },
      select: { driverId: true, status: true },
    });

    if (offers.length >= MAX_DISPATCH_ATTEMPTS) {
      return await this.giveUp(ride);
    }

    // Everyone who has already seen this ride. Preferred exclusion: spread
    // offers around rather than pestering one driver.
    const alreadyOffered = offers.map((offer) => offer.driverId);

    // Founder decision, 2026-08-19: with a thin fleet, no driver is ever barred
    // from an order they did not take. Preference, not prohibition — three
    // tiers, tried in order:
    //
    //   1. never offered this ride    — spread the work
    //   2. let an offer lapse         — they never saw it
    //   3. declined                   — they said no, so they are asked last
    //
    // Only a driver holding a live PENDING offer is truly excluded, and only
    // so the same ride is not offered to one person twice at once. Excluding
    // declines permanently is what made a one-driver fleet unable to serve a
    // ride at all.
    const holdingLiveOffer = offers
      .filter((offer) => offer.status === RideOfferStatus.PENDING)
      .map((offer) => offer.driverId);
    const declined = offers
      .filter((offer) => offer.status === RideOfferStatus.DECLINED)
      .map((offer) => offer.driverId);

    const nearest = async (exclude: string[]): Promise<DriverAvailability | null> =>
      await this.findNearestEligibleDriver(
        ride.rideType,
        Number(ride.pickupLatitude),
        Number(ride.pickupLongitude),
        exclude,
      );

    const candidate =
      (await nearest(alreadyOffered)) ??
      (await nearest([...holdingLiveOffer, ...declined])) ??
      (await nearest(holdingLiveOffer));

    if (!candidate) {
      // Nobody eligible *right now* is not the same as nobody at all. A
      // driver typically opens the app because demand exists, so giving up on
      // the first empty look is how a passenger who books twenty seconds
      // before a driver comes online is told there are no drivers while three
      // sit polling for work. The ride stays SEARCHING and the sweep tries
      // again until the search window closes.
      return await this.keepSearching(ride);
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

  /** Preview shown to the driver before accept/decline — deliberately omits
   * customer identity, which only becomes visible via RideDto after the
   * driver accepts (see RideOfferPreviewDto doc comment). */
  public async getOfferPreview(driverId: string, offerId: string): Promise<RideOfferPreviewDto> {
    const offer = await this.requireLiveOffer(driverId, offerId);
    const ride = await this.requireRide(offer.rideId);
    return toRideOfferPreviewDto(offer, ride);
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
    await this.eventBus.emit(DOMAIN_EVENTS.RIDE_DRIVER_ASSIGNED, {
      customerId: updatedRide.customerId,
      rideId: updatedRide.id,
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

  /**
   * Called by RideOfferSweepService on a timer.
   *
   * An offer that runs out of time is only taken away when there is somebody
   * else to give it to. Founder decision, 2026-08-19: the offer stays on the
   * driver's screen — with a thin fleet, expiring it just to re-create it
   * moments later makes the request flicker in and out of existence while the
   * only driver on the platform watches. Rotation is for sharing work between
   * drivers; when there is nobody to rotate to, there is nothing to share.
   */
  public async expireStaleOffers(): Promise<number> {
    const stale = await this.prisma.rideOffer.findMany({
      where: { status: RideOfferStatus.PENDING, expiresAt: { lt: new Date() } },
    });

    const renewed: string[] = [];
    for (const offer of stale) {
      const ride = await this.prisma.ride.findUnique({ where: { id: offer.rideId } });
      const stillLooking =
        ride?.status === RideStatus.SEARCHING || ride?.status === RideStatus.REQUESTED;
      if (ride && stillLooking) {
        const alternative = await this.findNearestEligibleDriver(
          ride.rideType,
          Number(ride.pickupLatitude),
          Number(ride.pickupLongitude),
          [offer.driverId],
        );
        if (!alternative) {
          // Nobody else to offer it to: hold it open rather than dropping it.
          await this.prisma.rideOffer.update({
            where: { id: offer.id },
            data: { expiresAt: new Date(Date.now() + RIDE_OFFER_TIMEOUT_MS) },
          });
          renewed.push(offer.id);
          continue;
        }
      }
    }

    for (const offer of stale.filter((o) => !renewed.includes(o.id))) {
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

    // Only the ones actually taken away — a renewed offer is not an expiry,
    // and counting it as one would make the sweep log look like churn.
    return stale.length - renewed.length;
  }

  /**
   * Nearest un-offered driver, searched in expanding rings.
   *
   * Ranking was always nearest-first; what was missing was any bound. This
   * walks RIDE_DISPATCH_RADIUS_BANDS_METERS outward and returns from the first
   * ring that still holds a candidate, so the wider rings are only reached
   * once the nearer ones are exhausted — a passenger gets somebody close
   * whenever somebody close exists, and a thin fleet still gets served rather
   * than failing at the 5km edge.
   *
   * The database query is bounded by a bounding box before any distance maths
   * happens. Loading every online driver in the country and ranking them in
   * Node ran on every dispatch attempt — up to five per ride, plus again on
   * each decline and each expiry sweep — which is exactly the shape that stops
   * scaling at a few hundred concurrent passengers.
   */
  private async findNearestEligibleDriver(
    rideType: Ride['rideType'],
    pickupLat: number,
    pickupLng: number,
    excludedDriverIds: string[],
  ): Promise<DriverAvailability | null> {
    const freshSince = new Date(Date.now() - DRIVER_LOCATION_MAX_AGE_MS);

    for (const radiusMeters of RIDE_DISPATCH_RADIUS_BANDS_METERS) {
      const box = boundingBox(pickupLat, pickupLng, radiusMeters);

      const candidates = await this.prisma.driverAvailability.findMany({
        where: {
          online: true,
          acceptingRides: true,
          vehicleType: rideType,
          activeRideCount: 0,
          driverId: { notIn: excludedDriverIds },
          // A driver whose app stopped reporting is not where the row says.
          locationUpdatedAt: { gte: freshSince },
          latitude: { gte: box.minLat, lte: box.maxLat },
          longitude: { gte: box.minLng, lte: box.maxLng },
          driver: {
            driverProfile: { status: DriverStatus.APPROVED },
            rideOffers: { none: { status: RideOfferStatus.PENDING } },
          },
        },
      });

      // The box is a square around the circle, so it over-selects at the
      // corners; haversine is what actually decides who is inside the ring.
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
        .filter((entry) => entry.distanceMeters <= radiusMeters)
        .sort((left, right) => left.distanceMeters - right.distanceMeters);

      if (ranked[0]) {
        return ranked[0].driver;
      }
    }

    return null;
  }

  /**
   * No candidate this time round. Hold the ride open and let the sweep look
   * again, until the search window closes.
   */
  private async keepSearching(ride: Ride): Promise<RideDto> {
    if (Date.now() - ride.requestedAt.getTime() >= RIDE_SEARCH_WINDOW_MS) {
      return await this.giveUp(ride);
    }

    if (ride.status === RideStatus.SEARCHING) {
      return toRideDto(ride);
    }

    const updated = await this.prisma.ride.update({
      where: { id: ride.id },
      data: { status: RideStatus.SEARCHING },
    });
    this.events.publishToRide(updated.id, 'ride:status', {
      rideId: updated.id,
      status: updated.status,
      driverId: null,
    });
    return toRideDto(updated);
  }

  /**
   * Rides that are still looking but have no live offer.
   *
   * `expireStaleOffers` retries a ride by way of the offer that expired, so a
   * ride that never got an offer in the first place was invisible to it —
   * which is precisely the ride that most needs another look. Called on the
   * same sweep.
   */
  public async retryStalledSearches(): Promise<number> {
    const stalled = await this.prisma.ride.findMany({
      where: {
        status: { in: [RideStatus.REQUESTED, RideStatus.SEARCHING] },
        offers: { none: { status: RideOfferStatus.PENDING } },
      },
      select: { id: true },
      // A bound so one sweep cannot walk an unbounded backlog; anything left
      // is picked up by the next tick five seconds later.
      take: 50,
    });

    for (const ride of stalled) {
      await this.dispatchRide(ride.id);
    }

    return stalled.length;
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
