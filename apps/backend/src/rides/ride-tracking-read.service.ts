import { Injectable } from '@nestjs/common';
import { DriverStatus } from '@prisma/client';

import { NotFoundDomainException } from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import { haversineMeters } from './ride-fare.service';

import type { NearbyDriversQueryDto } from './dto/nearby-drivers-query.dto';
import type { NearbyDriverDto, RideTrackingPointDto } from '@dripplex/types';

/** Rounds to ~11m — enough to place a pin near a driver on the pre-booking
 * map without exposing their exact live position before a ride is matched. */
function fuzzForPrivacy(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/**
 * Read-only map data for the booking/tracking UI — nearby available drivers
 * before a ride is requested, and the RideTracking breadcrumb trail for a
 * ride the customer owns. Deliberately separate from RidesService (lifecycle
 * writes) and RideDispatchService.findNearestEligibleDriver (dispatch
 * matching, which excludes already-offered drivers and stops at the single
 * best candidate) — this service serves a full list for map display instead.
 */
@Injectable()
export class RideTrackingReadService {
  constructor(private readonly prisma: PrismaService) {}

  public async getNearbyDrivers(query: NearbyDriversQueryDto): Promise<NearbyDriverDto[]> {
    const candidates = await this.prisma.driverAvailability.findMany({
      where: {
        online: true,
        acceptingRides: true,
        vehicleType: query.rideType,
        activeRideCount: 0,
        latitude: { not: null },
        longitude: { not: null },
        driver: { driverProfile: { status: DriverStatus.APPROVED } },
      },
    });

    return candidates
      .map((driver) => ({
        latitude: Number(driver.latitude),
        longitude: Number(driver.longitude),
        vehicleType: driver.vehicleType,
        distanceMeters: haversineMeters(
          query.latitude,
          query.longitude,
          Number(driver.latitude),
          Number(driver.longitude),
        ),
      }))
      .filter((driver) => driver.distanceMeters <= query.radiusMeters)
      .sort((left, right) => left.distanceMeters - right.distanceMeters)
      .slice(0, 20)
      .map((driver) => ({
        latitude: fuzzForPrivacy(driver.latitude),
        longitude: fuzzForPrivacy(driver.longitude),
        vehicleType: driver.vehicleType,
      }));
  }

  public async getTrackingHistory(
    customerId: string,
    rideId: string,
  ): Promise<RideTrackingPointDto[]> {
    const ride = await this.prisma.ride.findFirst({ where: { id: rideId, customerId } });
    if (!ride) {
      throw new NotFoundDomainException('Ride not found');
    }

    const points = await this.prisma.rideTracking.findMany({
      where: { rideId },
      orderBy: { createdAt: 'asc' },
    });

    return points.map((point) => ({
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
      heading: point.heading ?? null,
      speed: point.speed ?? null,
      at: point.createdAt.toISOString(),
    }));
  }
}
