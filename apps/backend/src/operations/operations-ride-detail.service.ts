import { Injectable } from '@nestjs/common';
import { SosAlertStatus } from '@prisma/client';

import { NotFoundDomainException } from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import { toOperationsRideDetailDto, toOperationsRideOfferDto } from './operations.mapper';

import type { OperationsRideAllocationDto, OperationsRideDetailDto } from '@dripplex/types';

/**
 * DPX-OPS-001 Slice 3 — Dispatch Management (founder-approved 2026-08-05,
 * reality-audited before implementation — see
 * docs/DPX-OPS-001-SLICE-3-REALITY-AUDIT.md). Ride detail + driver
 * allocation history for the ride queue Slice 1 already built. Read-only:
 * `apps/backend/src/rides/` files are never touched or modified, the same
 * discipline every prior DPX-OPS-001 slice held to.
 */
@Injectable()
export class OperationsRideDetailService {
  constructor(private readonly prisma: PrismaService) {}

  public async getRideDetail(rideId: string): Promise<OperationsRideDetailDto> {
    const [ride, openSosCount] = await Promise.all([
      this.prisma.ride.findUnique({
        where: { id: rideId },
        include: { customer: true, driver: true },
      }),
      this.prisma.sosAlert.count({
        where: { rideId, status: { in: [SosAlertStatus.OPEN, SosAlertStatus.ACKNOWLEDGED] } },
      }),
    ]);
    if (!ride) {
      throw new NotFoundDomainException('Ride not found');
    }
    return toOperationsRideDetailDto(ride, openSosCount > 0);
  }

  /** The founder's "driver allocation history" — who was offered this
   * ride, in what order, and what happened. Reads `RideOffer` directly;
   * `RideDispatchService`/`RideOfferSweepService` (both frozen) are never
   * called into or duplicated. */
  public async getRideAllocation(rideId: string): Promise<OperationsRideAllocationDto> {
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: { driver: true },
    });
    if (!ride) {
      throw new NotFoundDomainException('Ride not found');
    }

    const offers = await this.prisma.rideOffer.findMany({
      where: { rideId },
      include: { driver: true },
      orderBy: { offeredAt: 'asc' },
    });

    return {
      offers: offers.map(toOperationsRideOfferDto),
      currentDriverId: ride.driverId,
      currentDriverName: ride.driver ? `${ride.driver.firstName} ${ride.driver.lastName}` : null,
    };
  }
}
