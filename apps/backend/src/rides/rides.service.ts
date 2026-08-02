import { Inject, Injectable } from '@nestjs/common';
import { PromotionDomain, RideCancelledBy, RideStatus } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../events/domain-events';
import {
  NOTIFICATION_SERVICE,
  type NotificationService,
} from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { PromotionsService } from '../promotions/promotions.service';

import { RideDispatchService } from './ride-dispatch.service';
import { RIDE_EVENTS_PUBLISHER, type RideEventsPublisher } from './ride-events.publisher';
import { type RideFareEstimate, RideFareService } from './ride-fare.service';
import {
  ACTIVE_DRIVER_RIDE_STATUSES,
  CANCELLABLE_RIDE_STATUSES,
  RIDE_AUDIT_ACTIONS,
  RIDE_PROMOTION_REFERENCE_TYPE,
} from './ride.constants';
import { toDriverAvailabilityDto, toRideDto } from './ride.mapper';

import type { ListRidesQueryDto } from './dto/list-rides-query.dto';
import type { CancelRideDto, EstimateRideFareDto, RequestRideDto } from './dto/request-ride.dto';
import type { UpdateDriverAvailabilityDto } from './dto/update-driver-availability.dto';
import type { DriverAvailabilityDto, EstimateRideFareResponse, RideDto } from '@dripplex/types';
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
    private readonly promotionsService: PromotionsService,
    private readonly eventBus: DomainEventBus,
  ) {}

  /** Read-only preview — does not redeem or lock anything. Used by the
   * `/rides/estimate` endpoint so a customer can see a coupon's discount
   * before requesting the ride. */
  public async estimateFare(
    customerId: string,
    dto: EstimateRideFareDto,
  ): Promise<EstimateRideFareResponse> {
    const estimate = this.fareService.estimate(
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
    const estimate = this.fareService.estimate(
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
    const finalFare = this.roundFare(Math.max(0, estimate.totalFare - promoDiscount));

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
        totalFare: finalFare,
        ...(promotionId !== null ? { promotionId } : {}),
        promoDiscount,
      },
    });

    if (promotionId !== null) {
      await this.redeemRidePromotion(ride, promotionId, estimate.totalFare, dto.rideType, context);
    }

    await this.auditService.record(
      RIDE_AUDIT_ACTIONS.REQUESTED,
      { ...context, userId: customerId },
      { resource: 'ride', resourceId: ride.id, metadata: { rideType: ride.rideType } },
    );

    return await this.dispatchService.dispatchRide(ride.id);
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
          eligibility: { rideType },
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
  ): Promise<{ promotionId: string | null; promoDiscount: number }> {
    if (!couponCode) {
      return { promotionId: null, promoDiscount: 0 };
    }
    const preview = await this.promotionsService.previewSinglePromotion({
      userId: customerId,
      domain: PromotionDomain.RIDE,
      subtotal,
      couponCode,
      eligibility: { rideType },
    });
    if (!preview || preview.discountAmount <= 0) {
      return { promotionId: null, promoDiscount: 0 };
    }
    return { promotionId: preview.promotion.id, promoDiscount: preview.discountAmount };
  }

  private roundFare(amount: number): number {
    return Math.round((amount + Number.EPSILON) * 100) / 100;
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

  public async getOwnAvailability(driverId: string): Promise<DriverAvailabilityDto | null> {
    const availability = await this.prisma.driverAvailability.findUnique({ where: { driverId } });
    return availability ? toDriverAvailabilityDto(availability) : null;
  }

  /** Lets the dashboard recover "you have a trip in progress" after a page
   * refresh — acceptOffer/arrive/start all return the updated RideDto
   * directly, but nothing persists that reference client-side. */
  public async getActiveRide(driverId: string): Promise<RideDto | null> {
    const ride = await this.prisma.ride.findFirst({
      where: { driverId, status: { in: ACTIVE_DRIVER_RIDE_STATUSES } },
      orderBy: { assignedAt: 'desc' },
    });
    return ride ? toRideDto(ride) : null;
  }

  private async requireOwnedRide(customerId: string, rideId: string): Promise<Ride> {
    const ride = await this.prisma.ride.findFirst({ where: { id: rideId, customerId } });
    if (!ride) {
      throw new NotFoundDomainException('Ride not found');
    }
    return ride;
  }
}
