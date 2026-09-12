import { Inject, Injectable } from '@nestjs/common';
import {
  Prisma,
  CommissionOwnerType,
  DriverStatus,
  PromotionDomain,
  RideCancelledBy,
  RideStatus,
  VehicleApprovalStatus,
} from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import { CommissionAccountService } from '../commercial/commission-account.service';
import {
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { DriverIdentityVerificationService } from '../drivers/identity-verification/driver-identity-verification.service';
import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../events/domain-events';
import {
  NOTIFICATION_SERVICE,
  type NotificationService,
} from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { PromotionsService } from '../promotions/promotions.service';

import {
  UNIVERSAL_ACQUISITION_INCENTIVE_ID,
  UNIVERSAL_ACQUISITION_INCENTIVE_MAX_RIDES,
} from './acquisition-incentive.constants';
import { RideDispatchService } from './ride-dispatch.service';
import { RIDE_EVENTS_PUBLISHER, type RideEventsPublisher } from './ride-events.publisher';
import {
  boundingBox,
  haversineMeters,
  type RideFareEstimate,
  RideFareService,
} from './ride-fare.service';
import { RidePricingService } from './ride-pricing.service';
import {
  ACTIVE_DRIVER_RIDE_STATUSES,
  CANCELLABLE_RIDE_STATUSES,
  DRIVER_LOCATION_MAX_AGE_MS,
  OPERATIONS_CANCELLABLE_RIDE_STATUSES,
  RIDE_AUDIT_ACTIONS,
  RIDE_DISPATCH_MAX_RADIUS_METERS,
  RIDE_PROMOTION_REFERENCE_TYPE,
  RIDE_TYPE_CATALOG,
} from './ride.constants';
import { toDriverAvailabilityDto, toRideDto } from './ride.mapper';

import type { ListRidesQueryDto } from './dto/list-rides-query.dto';
import type {
  CancelRideByOperationsDto,
  CancelRideDto,
  EstimateRideFareDto,
  RequestRideDto,
} from './dto/request-ride.dto';
import type { UpdateDriverAvailabilityDto } from './dto/update-driver-availability.dto';
import type {
  CustomerRideDto,
  DriverAvailabilityDto,
  DriverRideDto,
  EstimateRideFareResponse,
  RideDriverVehicleDto,
  RideDto,
  RideTypeCatalogEntryDto,
} from '@dripplex/types';
import type { Ride, RideType } from '@prisma/client';

/**
 * What the promotions engine is told about a customer when a ride is priced.
 *
 * Gathered once per request and used for BOTH the quote and the redemption.
 * They must be judged on the same facts: a redemption re-evaluates the rules,
 * and a thinner context there means a promotion that previews and then refuses.
 */
interface AcquisitionContext {
  isReferral: boolean;
  isNewUser: boolean;
  completedRides: number;
}

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
    private readonly promotionsService: PromotionsService,
    private readonly eventBus: DomainEventBus,
    private readonly identityVerificationService: DriverIdentityVerificationService,
    private readonly commissionAccounts: CommissionAccountService,
    private readonly pricing: RidePricingService,
  ) {}

  /** Real service-type catalog (display name + description) so the
   * frontend never hardcodes ride-type labels — the founder-directed fix
   * for Dx Ride/Dx Comfort/Dx XL replacing the previous per-screen
   * hardcoded "Economy"/"Tricycle" label maps. Deterministic, no DB call. */
  public listRideTypes(): RideTypeCatalogEntryDto[] {
    return (Object.keys(RIDE_TYPE_CATALOG) as RideType[]).map((type) => ({
      type,
      ...RIDE_TYPE_CATALOG[type],
    }));
  }

  /**
   * The catalog, plus whether each type can actually be served from a pickup.
   *
   * A passenger could pick Dx Comfort with no Comfort driver anywhere near
   * them, book, and sit on "Finding your driver" through five offer attempts
   * before the ride ended NO_DRIVERS_FOUND — with nothing on screen saying
   * why. This answers the question up front, and answers it the same way
   * dispatch will: same vehicle type, same freshness rule, same outer radius.
   *
   * One query for the whole catalog rather than one per type — the fare screen
   * asks on every pickup change, and four round trips per change is the kind
   * of thing that stops scaling at a few hundred concurrent passengers.
   */
  public async listRideTypesWithAvailability(
    latitude: number,
    longitude: number,
  ): Promise<RideTypeCatalogEntryDto[]> {
    const box = boundingBox(latitude, longitude, RIDE_DISPATCH_MAX_RADIUS_METERS);

    const drivers = await this.prisma.driverAvailability.findMany({
      where: {
        online: true,
        acceptingRides: true,
        activeRideCount: 0,
        locationUpdatedAt: { gte: new Date(Date.now() - DRIVER_LOCATION_MAX_AGE_MS) },
        latitude: { gte: box.minLat, lte: box.maxLat },
        longitude: { gte: box.minLng, lte: box.maxLng },
        driver: { driverProfile: { status: DriverStatus.APPROVED } },
      },
      select: { vehicleType: true, latitude: true, longitude: true },
    });

    // Nearest driver per vehicle type. The box over-selects at its corners, so
    // the haversine check is what decides who is genuinely within reach.
    const nearestByType = new Map<RideType, number>();
    for (const driver of drivers) {
      if (driver.latitude === null || driver.longitude === null) {
        continue;
      }
      const distanceMeters = haversineMeters(
        latitude,
        longitude,
        Number(driver.latitude),
        Number(driver.longitude),
      );
      if (distanceMeters > RIDE_DISPATCH_MAX_RADIUS_METERS) {
        continue;
      }
      const best = nearestByType.get(driver.vehicleType);
      if (best === undefined || distanceMeters < best) {
        nearestByType.set(driver.vehicleType, distanceMeters);
      }
    }

    // "Not permitted here" is a different answer from "nobody is free", and a
    // passenger standing at the airport must not be told to wait for a
    // tricycle that is never coming.
    const barred = await this.pricing.exclusionsAtPoint({ lat: latitude, lng: longitude });

    return this.listRideTypes().map((entry) => {
      const nearest = nearestByType.get(entry.type);
      const restricted = barred.has(entry.type);
      return {
        ...entry,
        availableNow: !restricted && nearest !== undefined,
        nearestDriverMeters: nearest ?? null,
        restrictedReason: restricted
          ? `${entry.displayName} is not permitted from this location`
          : null,
      };
    });
  }

  /** Read-only preview — does not redeem or lock anything. Used by the
   * `/rides/estimate` endpoint so a customer can see a coupon's discount
   * before requesting the ride. */
  /**
   * Refuse a ride type a zone bars from the trip.
   *
   * Checked on both the estimate and the request, not just the request: a
   * passenger who is quoted a fare and only then told the vehicle cannot go
   * has been misled, and the fare screen is where the choice is actually made.
   */
  private async assertRideTypeAllowed(
    rideType: RideType,
    pickup: { lat: number; lng: number },
    dropoff: { lat: number; lng: number },
  ): Promise<void> {
    const exclusion = await this.pricing.findExclusion(rideType, pickup, dropoff);
    if (exclusion !== null) {
      throw new ValidationDomainException(
        `${RIDE_TYPE_CATALOG[rideType].displayName} cannot serve trips to or from ${exclusion.zoneName}. Choose another ride type.`,
      );
    }
  }

  public async estimateFare(
    customerId: string,
    dto: EstimateRideFareDto,
  ): Promise<EstimateRideFareResponse> {
    await this.assertRideTypeAllowed(
      dto.rideType,
      { lat: dto.pickupLatitude, lng: dto.pickupLongitude },
      { lat: dto.dropoffLatitude, lng: dto.dropoffLongitude },
    );
    const estimate = await this.fareService.estimate(
      dto.rideType,
      { lat: dto.pickupLatitude, lng: dto.pickupLongitude },
      { lat: dto.dropoffLatitude, lng: dto.dropoffLongitude },
    );
    const { promotionId, promoDiscount } = await this.previewCoupon(
      customerId,
      dto.rideType,
      estimate.totalFare,
      dto.couponCode,
    );
    return {
      ...estimate,
      promotionId,
      promoDiscount,
      finalFare: this.roundFare(Math.max(0, estimate.totalFare - promoDiscount)),
    };
  }

  public async requestRide(
    customerId: string,
    dto: RequestRideDto,
    context: AuditContext,
  ): Promise<RideDto> {
    // Re-checked here rather than trusted from the estimate: the estimate is a
    // separate call the client may skip, and Ops may have added the
    // restriction between the quote and the tap.
    await this.assertRideTypeAllowed(
      dto.rideType,
      { lat: dto.pickupLatitude, lng: dto.pickupLongitude },
      { lat: dto.dropoffLatitude, lng: dto.dropoffLongitude },
    );
    const estimate = await this.fareService.estimate(
      dto.rideType,
      { lat: dto.pickupLatitude, lng: dto.pickupLongitude },
      { lat: dto.dropoffLatitude, lng: dto.dropoffLongitude },
    );
    const { promotionId, promoDiscount, acquisition } = await this.previewCoupon(
      customerId,
      dto.rideType,
      estimate.totalFare,
      dto.couponCode,
    );
    // DPX-PROMO-REF-001 — the acquisition incentive is capped at three
    // discounted rides, and that cap has to survive simultaneous requests.
    //
    // The eligibility rule (`maxPriorCompletedRides`) reads COMPLETED rides,
    // and a ride being priced is not completed — so three requests made at once
    // by a customer with two completed rides all price as eligible, and all
    // three would carry 20%. Founder ruling: never more than three, concurrency
    // included.
    //
    // This is NOT a second COUNT. A count would race exactly as the first one
    // does. The grant is decided inside a transaction that first takes a row
    // lock on the customer's acquisition record, which every concurrent request
    // for that customer must queue behind, and the ride row created in the same
    // transaction IS the reservation.
    const granted = await this.prisma.$transaction(async (tx) => {
      const keepsIncentive = await this.reserveAcquisitionSlot(tx, customerId, promotionId);
      const grantedPromotionId = keepsIncentive ? promotionId : null;
      const grantedDiscount = keepsIncentive ? promoDiscount : 0;
      const finalFare = this.roundFare(Math.max(0, estimate.totalFare - grantedDiscount));
      const created = await tx.ride.create({
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
          // Snapshotted, not looked up later: editing a rate or a zone in the
          // pricing console must never re-price a trip that has already
          // happened, and the zone name has to survive the zone being renamed
          // or deactivated so the receipt keeps explaining itself.
          surchargeAmount: estimate.surchargeAmount,
          ...(estimate.surchargeZoneId !== null
            ? { surchargeZoneId: estimate.surchargeZoneId }
            : {}),
          ...(estimate.surchargeZoneName !== null
            ? { surchargeZoneName: estimate.surchargeZoneName }
            : {}),
          totalFare: finalFare,
          ...(grantedPromotionId !== null ? { promotionId: grantedPromotionId } : {}),
          promoDiscount: grantedDiscount,
        },
      });
      return { ride: created, promotionId: grantedPromotionId };
    });
    const ride = granted.ride;

    if (granted.promotionId !== null) {
      await this.redeemRidePromotion(
        ride,
        granted.promotionId,
        estimate.totalFare,
        dto.rideType,
        acquisition,
        context,
      );
    }

    await this.auditService.record(
      RIDE_AUDIT_ACTIONS.REQUESTED,
      { ...context, userId: customerId },
      { resource: 'ride', resourceId: ride.id, metadata: { rideType: ride.rideType } },
    );

    return await this.dispatchService.dispatchRide(ride.id);
  }

  /**
   * Take one of the three acquisition-discount slots, atomically.
   *
   * Returns true if this ride may carry the universal incentive. Only ever
   * consulted for that one promotion: every other promotion keeps its existing
   * behaviour untouched.
   *
   * **The reservation is the ride row itself.** No separate reservation table
   * exists, and none is needed: `Ride.promotionId` is already durable state
   * written in this same transaction, and it already follows the ride's
   * lifecycle. A cancelled ride stops counting because its status changes, and
   * a completed one keeps its slot because its status does not. A dedicated
   * reservation record would have to be kept in step with that lifecycle by
   * hand, and the day it drifted somebody would be charged full price for a
   * ride they were promised at 20% off.
   *
   * **The serialization point is the customer's acquisition row.**
   * `referral_redemptions.referee_user_id` is unique platform-wide, so one
   * customer has exactly one, and eligibility already requires it to exist.
   * `FOR UPDATE` on it makes every concurrent request by that customer queue,
   * so the count below is taken by one request at a time. Counting without the
   * lock — however carefully — is the race this exists to close.
   *
   * Crash safety falls out of the transaction: a process that dies between
   * taking the lock and creating the ride rolls back and leaks nothing, because
   * there is no reservation to orphan. Retrying is simply the next request.
   */
  private async reserveAcquisitionSlot(
    tx: Prisma.TransactionClient,
    customerId: string,
    promotionId: string | null,
  ): Promise<boolean> {
    if (promotionId !== UNIVERSAL_ACQUISITION_INCENTIVE_ID) {
      return promotionId !== null;
    }

    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM referral_redemptions
      WHERE referee_user_id = ${customerId}::uuid
      FOR UPDATE
    `;
    if (locked.length === 0) {
      // No acquisition, no incentive.
      //
      // Unreachable today and deliberately kept: `referralOnly` means the quote
      // cannot name this promotion unless the row exists, so nothing can drive
      // this branch — a mutation removing it survives the whole suite, and that
      // is stated rather than papered over with a test that fakes a path into
      // it. It is a fail-closed backstop for the day the rules and this method
      // stop agreeing, and refusing a discount is the safe side of that
      // disagreement.
      return false;
    }

    // Counted inside the lock, on rides that still hold a slot. CANCELLED and
    // NO_DRIVERS_FOUND release theirs: a ride that never happened must not
    // consume a benefit the customer was promised.
    const consumed = await tx.ride.count({
      where: {
        customerId,
        promotionId: UNIVERSAL_ACQUISITION_INCENTIVE_ID,
        status: { notIn: [RideStatus.CANCELLED, RideStatus.NO_DRIVERS_FOUND] },
      },
    });
    return consumed < UNIVERSAL_ACQUISITION_INCENTIVE_MAX_RIDES;
  }

  /**
   * What the promotions engine needs to know about this customer, gathered
   * once per pricing call.
   *
   * `completedRides` is counted from the rides table rather than from
   * promotion redemptions, which is the whole point: the founder's rule is the
   * first three completed rides *ever*, so declining the discount must not
   * leave a slot unused for later. When ride N is priced the customer has
   * exactly N-1 completed rides, so ride #1 sees 0 and ride #4 sees 3.
   *
   * `isReferral` is true when somebody was acquired through a referral at all —
   * a self-serve code or a campaign token alike, because the acquisition
   * incentive is universal and does not care who brought them.
   */
  private async acquisitionContext(customerId: string): Promise<AcquisitionContext> {
    const [completedRides, acquisition] = await Promise.all([
      this.prisma.ride.count({
        where: { customerId, status: RideStatus.COMPLETED },
      }),
      this.prisma.referralRedemption.findUnique({
        where: { refereeUserId: customerId },
        select: { id: true },
      }),
    ]);
    return {
      isReferral: acquisition !== null,
      isNewUser: completedRides === 0,
      completedRides,
    };
  }

  /** Locks and redeems the promotion previewed in `requestRide`, using the
   * Ride's own id as `referenceId` (created just before this call). This is
   * a second, non-atomic step — Ride creation and promotion redemption are
   * two separate transactions (WalletService.credit/cashback, which the
   * redemption may call, manages its own internal transaction and can't be
   * nested — see docs/PROMOTION-PLATFORM.md's "known limitations" section).
   * If the redemption loses a race (e.g. another request exhausted the
   * usage limit between preview and this call), the ride degrades
   * gracefully to its undiscounted fare rather than failing the request. */
  private async redeemRidePromotion(
    ride: Ride,
    promotionId: string,
    subtotal: RideFareEstimate['totalFare'],
    rideType: RequestRideDto['rideType'],
    acquisition: AcquisitionContext,
    context: AuditContext,
  ): Promise<void> {
    try {
      await this.promotionsService.redeemForReference(
        {
          userId: ride.customerId,
          domain: PromotionDomain.RIDE,
          subtotal,
          promotionId,
          referenceType: RIDE_PROMOTION_REFERENCE_TYPE,
          referenceId: ride.id,
          // The SAME context the quote was judged on, not a thinner one.
          // Redemption re-evaluates the rules, so passing only `rideType` here
          // made every acquisition-incentive redemption fail `referralOnly` and
          // be swallowed by the catch below: the customer was quoted 20% off
          // and then charged full price, silently. Preview and redemption must
          // be given the same facts or they will disagree.
          eligibility: { rideType, ...acquisition },
        },
        context,
      );
    } catch {
      await this.prisma.ride.update({
        where: { id: ride.id },
        data: { promotionId: null, promoDiscount: 0, totalFare: subtotal },
      });
    }
  }

  /** Read-only, unlocked lookup of the discount a coupon code would grant
   * right now — used by both `estimateFare` (pure preview) and
   * `requestRide` (preview-then-redeem). Never throws: an invalid/expired/
   * ineligible code just yields no discount, same as having no code. */
  private async previewCoupon(
    customerId: string,
    rideType: RequestRideDto['rideType'],
    subtotal: number,
    couponCode: string | undefined,
  ): Promise<{
    promotionId: string | null;
    promoDiscount: number;
    acquisition: AcquisitionContext;
  }> {
    // No coupon typed → fall back to automatic (codeless) RIDE promotions, the
    // same way the marketplace already does via PricingService.evaluateForCart.
    // This is what makes an automatic campaign such as "Free First Ride"
    // (perUserLimit: 1) apply without the rider having to know a code.
    // DPX-PROMO-REF-001 — the eligibility context the rules engine has always
    // read and nobody ever supplied.
    //
    // `newUsersOnly`, `returningUsersOnly`, `referralOnly` and `inviteOnly` are
    // implemented in the evaluator and were dead in production: no caller set
    // `isNewUser`, `isReferral` or `isInvited`, so a `newUsersOnly` campaign
    // configured in Ops refused everybody and said nothing. Their unit tests
    // passed because they handed the evaluator a context directly. Supplying it
    // here is what makes those rules real, and what the universal acquisition
    // incentive needs.
    const acquisition = await this.acquisitionContext(customerId);

    if (!couponCode) {
      const auto = await this.promotionsService.previewPromotion({
        userId: customerId,
        domain: PromotionDomain.RIDE,
        subtotal,
        eligibility: { rideType, ...acquisition },
      });
      // A ride records ONE promotionId, so only a single promotion may be
      // attached. Take the best (selectDiscounts orders by priority) and use
      // that promotion's own discount — never the stacked total, which would
      // credit one promotion with another's savings at redemption time.
      const best = auto.discounts[0];
      if (!best || best.discountAmount <= 0) {
        return { promotionId: null, promoDiscount: 0, acquisition };
      }
      return { promotionId: best.promotionId, promoDiscount: best.discountAmount, acquisition };
    }
    const preview = await this.promotionsService.previewSinglePromotion({
      userId: customerId,
      domain: PromotionDomain.RIDE,
      subtotal,
      couponCode,
      // The same context as the codeless branch. A typed coupon must be judged
      // by the same rules as an automatic one, or a `newUsersOnly` code would
      // behave differently from a `newUsersOnly` campaign.
      eligibility: { rideType, ...acquisition },
    });
    if (!preview || preview.discountAmount <= 0) {
      return { promotionId: null, promoDiscount: 0, acquisition };
    }
    return {
      promotionId: preview.promotion.id,
      promoDiscount: preview.discountAmount,
      acquisition,
    };
  }

  private roundFare(amount: number): number {
    return Math.round((amount + Number.EPSILON) * 100) / 100;
  }

  public async getOwnRide(customerId: string, rideId: string): Promise<CustomerRideDto> {
    const ride = await this.requireOwnedRide(customerId, rideId);
    const [driverName, driverVehicle] = await Promise.all([
      this.displayName(ride.driverId),
      this.driverVehicle(ride.driverId, ride.rideType),
    ]);
    return {
      ...toRideDto(ride),
      driverName,
      // The trip code belongs to the passenger and to nobody else — this is
      // the only endpoint that ever returns it.
      verificationCode: ride.verificationCode,
      driverVehicle,
    };
  }

  /**
   * The car the passenger should be looking for. A passenger standing on a
   * kerb needs a plate and a colour, not a ride class — so this reads the
   * driver's approved, active vehicle, preferring the one registered for the
   * ride's class and falling back to their most recently updated approved
   * vehicle. Returns null rather than a guess when nothing is approved.
   */
  private async driverVehicle(
    driverId: string | null,
    rideType: RideType,
  ): Promise<RideDriverVehicleDto | null> {
    if (driverId === null) {
      return null;
    }
    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        driverId,
        isActive: true,
        approvalStatus: VehicleApprovalStatus.APPROVED,
      },
      orderBy: { updatedAt: 'desc' },
      select: { plateNumber: true, make: true, model: true, color: true, rideCategory: true },
    });
    const match = vehicles.find((vehicle) => vehicle.rideCategory === rideType) ?? vehicles[0];
    if (!match) {
      return null;
    }
    return {
      plateNumber: match.plateNumber,
      make: match.make,
      model: match.model,
      color: match.color,
    };
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

  /** Driver-side mirror of listOwnRides — same shape, keyed by driverId
   * instead of customerId. Backs both the dashboard's ride-statistics
   * widget and the Ride History screen. */
  public async listOwnRidesForDriver(
    driverId: string,
    query: ListRidesQueryDto,
  ): Promise<{
    items: RideDto[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const where = { driverId, ...(query.status ? { status: query.status } : {}) };
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
      await this.eventBus.emit(DOMAIN_EVENTS.RIDE_CANCELLED, {
        driverId: ride.driverId,
        rideId: updated.id,
      });
    }

    return toRideDto(updated);
  }

  /**
   * Operations cancels a ride on someone else's behalf.
   *
   * This exists because rides strand. A driver marks ARRIVED and their phone
   * dies; a trip goes IN_PROGRESS and nobody ever completes it. The row then
   * sits forever holding that driver's `activeRideCount` at 1, so dispatch
   * stops offering them work, and neither party can clear it — the passenger's
   * cancel button is gone by that point and the driver's app is what failed.
   * Until now the console's answer was "the ride lifecycle is owned by the
   * rider/driver apps", which left the only people who could see the problem
   * unable to touch it.
   *
   * Three things separate this from `cancelRide`:
   *  - no ownership check — the operator is a third party by definition;
   *  - `OPERATIONS`, not `CUSTOMER` or `SYSTEM`, so the row records that a
   *    human support decision ended the trip rather than the expiry sweep;
   *  - the reason is mandatory, and the driver's availability is released with
   *    a guarded `updateMany` rather than a bare `update`. A ride reaching this
   *    path is already an anomaly, so the release must not itself fail on a
   *    missing availability row or drive the counter negative.
   *
   * No money moves. Settlement runs only on completion, so cancelling an
   * IN_PROGRESS ride charges the passenger nothing and pays the driver nothing
   * — a refund is a separate, separately audited act.
   */
  public async cancelRideAsOperations(
    operatorId: string,
    rideId: string,
    dto: CancelRideByOperationsDto,
    context: AuditContext,
  ): Promise<RideDto> {
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) {
      throw new NotFoundDomainException('Ride not found');
    }
    if (!OPERATIONS_CANCELLABLE_RIDE_STATUSES.includes(ride.status)) {
      throw new ValidationDomainException(
        `Ride cannot be cancelled from status ${ride.status} — it has already finished.`,
      );
    }

    const previousStatus = ride.status;
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.ride.update({
        where: { id: ride.id },
        data: {
          status: RideStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledBy: RideCancelledBy.OPERATIONS,
          cancellationReason: dto.reason,
        },
      });
      if (ride.driverId) {
        await tx.driverAvailability.updateMany({
          where: { driverId: ride.driverId, activeRideCount: { gt: 0 } },
          data: { activeRideCount: { decrement: 1 } },
        });
      }
      return next;
    });

    await this.auditService.record(
      RIDE_AUDIT_ACTIONS.CANCELLED,
      { ...context, userId: operatorId },
      {
        resource: 'ride',
        resourceId: ride.id,
        metadata: {
          cancelledBy: 'OPERATIONS',
          reason: dto.reason,
          previousStatus,
          customerId: ride.customerId,
          driverId: ride.driverId,
        },
      },
    );

    // Both sides are told, because neither of them asked for this.
    await this.notifyCustomer(ride.customerId, updated.id);
    if (ride.driverId) {
      await this.notifyDriver(ride.driverId, updated.id);
    }
    this.events.publishToRide(updated.id, 'ride:status', {
      rideId: updated.id,
      status: updated.status,
      driverId: updated.driverId,
    });
    if (ride.driverId) {
      await this.eventBus.emit(DOMAIN_EVENTS.RIDE_CANCELLED, {
        driverId: ride.driverId,
        rideId: updated.id,
      });
    }

    return toRideDto(updated);
  }

  private async notifyCustomer(customerId: string, rideId: string): Promise<void> {
    const customer = await this.prisma.user.findUnique({ where: { id: customerId } });
    if (!customer?.email) {
      return;
    }
    await this.notifications.notifyRideLifecycle({
      audience: 'customer',
      email: customer.email,
      event: 'ride_cancelled',
      rideId,
    });
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
    // Driver-001 / DPX-DS-001: going online is gated on identity
    // verification when the risk engine requires it (onboarding / idle
    // timeout / first login of day / new device / GPS anomaly / suspicious
    // activity / random spot-check / a prior failed attempt / admin or
    // event-driven flags). Going offline is never blocked. See
    // docs/DRIVER-001-IDENTITY-VERIFICATION-DESIGN.md.
    if (dto.online) {
      // Founder decision, 2026-08-19: a driver with any pending approval must
      // not be able to go online. Dispatch only ever offers a ride to a driver
      // whose DriverProfile.status is APPROVED
      // (RideDispatchService.findNearestEligibleDriver), so without this a
      // PENDING or UNDER_REVIEW driver toggled Online, was told "You are live ·
      // Waiting for ride requests…", pushed GPS every thirty seconds, and was
      // structurally unreachable — which is what two drivers did while a
      // passenger watched an empty search. Going OFFLINE is never blocked.
      const profile = await this.prisma.driverProfile.findUnique({
        where: { userId: driverId },
        select: { status: true, rejectedReason: true },
      });
      if (!profile) {
        throw new ValidationDomainException(
          'Complete your driver registration before going online',
        );
      }
      if (profile.status !== DriverStatus.APPROVED) {
        throw new ValidationDomainException(
          profile.status === DriverStatus.REJECTED && profile.rejectedReason
            ? `Your account was not approved: ${profile.rejectedReason}`
            : profile.status === DriverStatus.SUSPENDED
              ? 'Your account is suspended, so you cannot go online. Contact Operations.'
              : `Your account is ${profile.status.toLowerCase().replace(/_/g, ' ')}. You cannot go online until Operations approves it.`,
        );
      }

      await this.identityVerificationService.assertNotRequired(driverId, {
        ...(dto.deviceId !== undefined ? { deviceId: dto.deviceId } : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
      });

      // DPX-COMMERCIAL-001 Slice 4 — a driver whose outstanding cash
      // commission balance exceeds their credit limit cannot go online
      // for new work (an already-accepted trip always finishes; this is
      // a new-work gate only, same shape as the identity-verification
      // check right above and Slice 2's merchant checkout-blocking gate).
      const commissionAccount = await this.commissionAccounts.getOrCreateAccount(
        CommissionOwnerType.DRIVER,
        driverId,
      );
      if (commissionAccount.blocked) {
        throw new ValidationDomainException(
          'Driver is currently blocked from going online due to an outstanding commission balance',
        );
      }
    }

    // Going online carries a position, so it counts as a location ping. Stamp
    // locationUpdatedAt only when coordinates actually arrive — a driver
    // flipping "accepting rides" off and on must not refresh a stale position.
    const locationStamp =
      dto.latitude !== undefined && dto.longitude !== undefined
        ? { locationUpdatedAt: new Date() }
        : {};

    const availability = await this.prisma.driverAvailability.upsert({
      where: { driverId },
      create: {
        driverId,
        online: dto.online,
        acceptingRides: dto.acceptingRides,
        // Spread, not defaulted: an absent field must leave the stored
        // preference alone. Every client that predates delivery opt-in sends
        // this DTO without it, and reading absence as false would opt a
        // driver back out every time they went online.
        ...(dto.acceptingDeliveries !== undefined
          ? { acceptingDeliveries: dto.acceptingDeliveries }
          : {}),
        vehicleType: dto.vehicleType,
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
        ...locationStamp,
      },
      update: {
        online: dto.online,
        acceptingRides: dto.acceptingRides,
        ...(dto.acceptingDeliveries !== undefined
          ? { acceptingDeliveries: dto.acceptingDeliveries }
          : {}),
        vehicleType: dto.vehicleType,
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
        ...locationStamp,
      },
    });
    return toDriverAvailabilityDto(availability);
  }

  public async getOwnAvailability(driverId: string): Promise<DriverAvailabilityDto | null> {
    const availability = await this.prisma.driverAvailability.findUnique({ where: { driverId } });
    return availability ? toDriverAvailabilityDto(availability) : null;
  }

  /** Lets the dashboard recover "you have a trip in progress" after a page
   * refresh — acceptOffer/arrive/start all return the updated RideDto
   * directly, but nothing persists that reference client-side. */
  public async getActiveRide(driverId: string): Promise<DriverRideDto | null> {
    const ride = await this.prisma.ride.findFirst({
      where: { driverId, status: { in: ACTIVE_DRIVER_RIDE_STATUSES } },
      orderBy: { assignedAt: 'desc' },
    });
    if (!ride) {
      return null;
    }
    return {
      ...toRideDto(ride),
      customerName: await this.displayName(ride.customerId),
      requiresVerificationCode: ride.verificationCode !== null,
    };
  }

  /**
   * The display name of the other party on a ride — name only, never phone.
   *
   * A driver and a passenger in the same car should be able to address each
   * other by name and open a chat thread that says who is on the other end.
   * Neither needs the other's phone number to do that, and a number, once
   * given, cannot be taken back when the trip ends. (Founder decision,
   * 2026-08-16.)
   */
  private async displayName(userId: string | null): Promise<string | null> {
    if (userId === null) {
      return null;
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    return user ? `${user.firstName} ${user.lastName}`.trim() : null;
  }

  private async requireOwnedRide(customerId: string, rideId: string): Promise<Ride> {
    const ride = await this.prisma.ride.findFirst({ where: { id: rideId, customerId } });
    if (!ride) {
      throw new NotFoundDomainException('Ride not found');
    }
    return ride;
  }
}
