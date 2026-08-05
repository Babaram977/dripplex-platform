import { Injectable } from '@nestjs/common';
import { DriverStatus, RideRatingRole } from '@prisma/client';

import { NotFoundDomainException } from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import { toDispatchCandidateDto } from './operations.mapper';

import type { DispatchSupportDto, OperationsRideTrackingDto } from '@dripplex/types';

/** Duplicated from the frozen `apps/backend/src/rides/ride-fare.service.ts`
 * — deliberately never imported. Every prior DPX-OPS-001 slice held to
 * "operations/ never imports rides/, only reads its tables directly";
 * duplicating this one pure formula keeps that boundary intact while
 * still matching the platform's own ETA math exactly (confirmed identical
 * by the Slice 3 reality audit). */
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (deg: number): number => (deg * Math.PI) / 180;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(earthRadiusMeters * c);
}

/** Same constant-speed assumption `ride-fare.service.ts` uses platform-wide
 * for its own ETA estimate (~30km/h) — duplicated for the same reason as
 * `haversineMeters` above, not independently chosen. */
const DEFAULT_RIDE_SPEED_MPS = 8.33;

/** How many nearest eligible drivers the decision-support panel shows.
 * DPX-RIDE-201 asked for "no 20-result cap" relative to the customer-
 * facing pre-booking map — that request was about removing the *privacy*-
 * motivated limit (`RideTrackingReadService.getNearbyDrivers()` caps at 20
 * for a public map), not mandating an unbounded list in a panel meant to
 * answer "who are the best available drivers for this ride," which is
 * inherently a short list. Capped here for ordinary decision-support
 * usability, the same reason any "best candidates" view is capped. */
const MAX_DISPATCH_CANDIDATES = 10;

/** Drivers considered "nearby" for dispatch decision support. Wider than
 * the customer-facing map's 5,000m default radius — an operator judging a
 * genuinely stalled ride needs more visibility than a customer's
 * pre-booking map does — but still a real, bounded radius, not "every
 * online driver platform-wide." */
const DISPATCH_CANDIDATE_RADIUS_METERS = 10_000;

/**
 * DPX-OPS-001 Slice 3 — Trip monitoring (`RideTracking`) and the founder's
 * DPX-RIDE-201 decision-support panel. Both read-only, both composed
 * entirely inside `operations/`. Nothing here ever creates a `RideOffer`
 * or assigns a driver — this service only ever answers "who's available
 * and how far away," never "make it so."
 */
@Injectable()
export class OperationsDispatchSupportService {
  constructor(private readonly prisma: PrismaService) {}

  public async getTripTracking(rideId: string): Promise<OperationsRideTrackingDto> {
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) {
      throw new NotFoundDomainException('Ride not found');
    }

    const points = await this.prisma.rideTracking.findMany({
      where: { rideId },
      orderBy: { createdAt: 'asc' },
    });

    return {
      points: points.map((point) => ({
        latitude: Number(point.latitude),
        longitude: Number(point.longitude),
        heading: point.heading ?? null,
        speed: point.speed ?? null,
        at: point.createdAt.toISOString(),
      })),
    };
  }

  /** The founder's decision-support panel: "these are the best available
   * drivers for this ride" — informational only, never an assignment
   * action. Same eligibility filter `RideTrackingReadService.
   * getNearbyDrivers()` uses for the customer-facing map (online,
   * accepting rides, matching vehicle type, no active ride, approved
   * driver status), but full-fidelity and driver-identified, per the
   * Slice 3 reality audit's own conclusion that the customer-facing
   * method isn't directly reusable here. */
  public async getDispatchCandidates(rideId: string): Promise<DispatchSupportDto> {
    const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) {
      throw new NotFoundDomainException('Ride not found');
    }

    const pickupLat = Number(ride.pickupLatitude);
    const pickupLon = Number(ride.pickupLongitude);

    const availability = await this.prisma.driverAvailability.findMany({
      where: {
        online: true,
        acceptingRides: true,
        vehicleType: ride.rideType,
        activeRideCount: 0,
        latitude: { not: null },
        longitude: { not: null },
        driver: { driverProfile: { status: DriverStatus.APPROVED } },
      },
      include: { driver: true },
    });

    const withDistance = availability
      .map((entry) => ({
        entry,
        distanceMeters: haversineMeters(
          pickupLat,
          pickupLon,
          Number(entry.latitude),
          Number(entry.longitude),
        ),
      }))
      .filter((candidate) => candidate.distanceMeters <= DISPATCH_CANDIDATE_RADIUS_METERS)
      .sort((left, right) => left.distanceMeters - right.distanceMeters)
      .slice(0, MAX_DISPATCH_CANDIDATES);

    if (withDistance.length === 0) {
      return { candidates: [] };
    }

    const candidateDriverIds = withDistance.map(({ entry }) => entry.driverId);
    const [vehicles, ratingAggregates] = await Promise.all([
      this.prisma.vehicle.findMany({
        where: { driverId: { in: candidateDriverIds }, isActive: true },
      }),
      this.prisma.rideRating.groupBy({
        by: ['rateeId'],
        where: { rateeId: { in: candidateDriverIds }, raterRole: RideRatingRole.CUSTOMER },
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);

    return {
      candidates: withDistance.map(({ entry, distanceMeters }) => {
        const vehicle = vehicles.find((v) => v.driverId === entry.driverId);
        const rating = ratingAggregates.find((r) => r.rateeId === entry.driverId);
        return toDispatchCandidateDto({
          availability: entry,
          distanceMeters,
          etaSeconds: Math.ceil(distanceMeters / DEFAULT_RIDE_SPEED_MPS),
          vehiclePlateNumber: vehicle?.plateNumber ?? null,
          averageRating: rating?._avg.rating ?? null,
          ratingCount: rating?._count.rating ?? 0,
        });
      }),
    };
  }
}
