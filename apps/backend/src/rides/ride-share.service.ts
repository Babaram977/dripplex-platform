import { randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { VehicleApprovalStatus } from '@prisma/client';

import {
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import { SHARE_LINK_GRACE_MS, SHAREABLE_RIDE_STATUSES } from './ride.constants';

import type { RideShareLinkDto, SharedRideDto } from '@dripplex/types';

/** First name only. The people a passenger shares a trip with are family, not
 * account holders — they need to recognise a driver, not identify them. */
function firstName(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? (trimmed.split(/\s+/)[0] ?? null) : null;
}

/**
 * "Share trip with family and friends" — a real link, live for the trip.
 *
 * The Share Trip screen used to show a hardcoded `drpx.app/t/RX-5201`, a
 * hardcoded driver and a randomly drawn QR code. Nothing was shared and
 * nothing could be followed. This mints a genuine unguessable token against
 * the ride and serves a deliberately thin public view of it.
 *
 * What the link does NOT carry, on purpose: the trip verification code, either
 * party's phone number or surname, the fare, or the ride id. Someone who finds
 * the link can watch a car move towards a destination; they cannot act on the
 * ride or identify who is in it.
 */
@Injectable()
export class RideShareService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Idempotent: the same ride keeps the same link for its whole life, so a
   * passenger who shares at pickup and again mid-trip does not leave their
   * family holding a link that has gone dead.
   */
  public async createShareLink(customerId: string, rideId: string): Promise<RideShareLinkDto> {
    const ride = await this.prisma.ride.findFirst({ where: { id: rideId, customerId } });
    if (!ride) {
      throw new NotFoundDomainException('Ride not found');
    }
    if (!SHAREABLE_RIDE_STATUSES.includes(ride.status)) {
      throw new ValidationDomainException('This trip is over — there is nothing live to share');
    }
    if (ride.shareToken !== null) {
      return { token: ride.shareToken, path: `/t/${ride.shareToken}` };
    }

    const token = randomBytes(16).toString('hex');
    await this.prisma.ride.update({ where: { id: ride.id }, data: { shareToken: token } });
    return { token, path: `/t/${token}` };
  }

  /**
   * The public read. No authentication — the token is the credential — so this
   * is written to leak as little as a follower can get away with.
   *
   * A link stays readable for SHARE_LINK_GRACE_MS past the end of the trip, so
   * the person watching sees it arrive rather than watching it 404.
   */
  public async getSharedRide(token: string): Promise<SharedRideDto> {
    const ride = await this.prisma.ride.findUnique({ where: { shareToken: token } });
    if (!ride) {
      throw new NotFoundDomainException('This trip link is not valid');
    }

    const endedAt = ride.completedAt ?? ride.cancelledAt;
    if (endedAt !== null && Date.now() - endedAt.getTime() > SHARE_LINK_GRACE_MS) {
      throw new NotFoundDomainException('This trip link has expired');
    }

    const [customer, driver, vehicle, availability] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: ride.customerId },
        select: { firstName: true },
      }),
      ride.driverId === null
        ? null
        : this.prisma.user.findUnique({
            where: { id: ride.driverId },
            select: { firstName: true },
          }),
      ride.driverId === null
        ? null
        : this.prisma.vehicle.findFirst({
            where: {
              driverId: ride.driverId,
              isActive: true,
              approvalStatus: VehicleApprovalStatus.APPROVED,
            },
            orderBy: { updatedAt: 'desc' },
            select: { plateNumber: true, make: true, model: true, color: true },
          }),
      // Only while the trip is live: a follower has no business knowing where
      // a driver is once the passenger is out of the car.
      ride.driverId === null || endedAt !== null
        ? null
        : this.prisma.driverAvailability.findUnique({
            where: { driverId: ride.driverId },
            select: { latitude: true, longitude: true, locationUpdatedAt: true },
          }),
    ]);

    return {
      status: ride.status,
      rideType: ride.rideType,
      passengerFirstName: firstName(customer?.firstName),
      driverFirstName: firstName(driver?.firstName),
      vehicle: vehicle ?? null,
      pickupAddress: ride.pickupAddress,
      dropoffAddress: ride.dropoffAddress,
      dropoffLatitude: Number(ride.dropoffLatitude),
      dropoffLongitude: Number(ride.dropoffLongitude),
      driverPosition:
        availability?.latitude !== null &&
        availability?.latitude !== undefined &&
        availability.longitude !== null
          ? {
              latitude: Number(availability.latitude),
              longitude: Number(availability.longitude),
              updatedAt: (availability.locationUpdatedAt ?? new Date()).toISOString(),
            }
          : null,
      estimatedDurationSeconds: ride.estimatedDurationSeconds,
      requestedAt: ride.requestedAt.toISOString(),
      startedAt: ride.startedAt?.toISOString() ?? null,
      completedAt: ride.completedAt?.toISOString() ?? null,
    };
  }
}
