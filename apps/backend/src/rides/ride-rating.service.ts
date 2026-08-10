import { Injectable } from '@nestjs/common';
import { RideRatingRole, RideStatus } from '@prisma/client';
import { instanceToPlain } from 'class-transformer';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import { DRIVER_RATING_TAGS, RIDE_AUDIT_ACTIONS } from './ride.constants';
import { toRideRatingDto } from './ride.mapper';

import type { RateRideDto } from './dto/ride-rating.dto';
import type { RideRatingDto } from '@dripplex/types';
import type { Prisma, Ride } from '@prisma/client';

/**
 * Ratings live in their own sibling model (RideRating) rather than the
 * existing polymorphic Review table — Review's verifiedPurchase logic,
 * aggregate rollups, and moderation queue were designed for
 * product/merchant reviews, not per-ride category sub-ratings from both
 * sides of a trip. See docs/RIDE-002.8-POST-RIDE-DESIGN.md.
 */
@Injectable()
export class RideRatingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  public async rateDriver(
    customerId: string,
    rideId: string,
    dto: RateRideDto,
    context: AuditContext,
  ): Promise<RideRatingDto> {
    const ride = await this.requireCompletedRide(rideId, { customerId });
    if (!ride.driverId) {
      throw new ValidationDomainException('Ride has no assigned driver to rate');
    }
    return await this.createRating(
      ride,
      RideRatingRole.CUSTOMER,
      customerId,
      ride.driverId,
      dto,
      context,
    );
  }

  public async rateCustomer(
    driverId: string,
    rideId: string,
    dto: RateRideDto,
    context: AuditContext,
  ): Promise<RideRatingDto> {
    const ride = await this.requireCompletedRide(rideId, { driverId });
    return await this.createRating(
      ride,
      RideRatingRole.DRIVER,
      driverId,
      ride.customerId,
      dto,
      context,
    );
  }

  /** Both sides' ratings for a ride the driver was actually on — up to 2
   * entries (their own outbound rating of the customer, and the customer's
   * rating of them, whichever exist). Backs the Ride History detail view. */
  public async listRideRatings(driverId: string, rideId: string): Promise<RideRatingDto[]> {
    const ride = await this.prisma.ride.findFirst({ where: { id: rideId, driverId } });
    if (!ride) {
      throw new NotFoundDomainException('Ride not found');
    }
    const ratings = await this.prisma.rideRating.findMany({
      where: { rideId },
      orderBy: { createdAt: 'asc' },
    });
    return ratings.map(toRideRatingDto);
  }

  private async createRating(
    ride: Ride,
    raterRole: RideRatingRole,
    raterId: string,
    rateeId: string,
    dto: RateRideDto,
    context: AuditContext,
  ): Promise<RideRatingDto> {
    // DPX-REVIEWS-001 — tags only apply to a customer rating a driver; a
    // driver rating a customer has no preset tag set.
    const tags = this.validateTags(raterRole, dto.tags);

    try {
      const rating = await this.prisma.rideRating.create({
        data: {
          rideId: ride.id,
          raterId,
          rateeId,
          raterRole,
          rating: dto.rating,
          tags,
          ...(dto.comment !== undefined ? { comment: dto.comment } : {}),
          ...(dto.categoryRatings !== undefined
            ? {
                categoryRatings: instanceToPlain(dto.categoryRatings) as Prisma.InputJsonValue,
              }
            : {}),
        },
      });

      await this.auditService.record(
        RIDE_AUDIT_ACTIONS.RATED,
        { ...context, userId: raterId },
        { resource: 'ride', resourceId: ride.id, metadata: { raterRole, rating: dto.rating } },
      );

      return toRideRatingDto(rating);
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        throw new ConflictDomainException('Ride has already been rated from this side');
      }
      throw error;
    }
  }

  private async requireCompletedRide(
    rideId: string,
    ownerClause: { customerId: string } | { driverId: string },
  ): Promise<Ride> {
    const ride = await this.prisma.ride.findFirst({ where: { id: rideId, ...ownerClause } });
    if (!ride) {
      throw new NotFoundDomainException('Ride not found');
    }
    if (ride.status !== RideStatus.COMPLETED) {
      throw new ValidationDomainException(`Ride cannot be rated from status ${ride.status}`);
    }
    return ride;
  }

  /** Tags are only valid for a customer→driver rating and must belong to the
   * fixed DRIVER_RATING_TAGS set. Returns the de-duplicated, trimmed list. */
  private validateTags(raterRole: RideRatingRole, tags: string[] | undefined): string[] {
    if (!tags || tags.length === 0) {
      return [];
    }
    if (raterRole !== RideRatingRole.CUSTOMER) {
      throw new ValidationDomainException('Tags are only supported when rating a driver');
    }
    const cleaned = [...new Set(tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0))];
    const invalid = cleaned.filter((tag) => !DRIVER_RATING_TAGS.includes(tag));
    if (invalid.length > 0) {
      throw new ValidationDomainException(`Unknown driver rating tag(s): ${invalid.join(', ')}`);
    }
    return cleaned;
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    );
  }
}
