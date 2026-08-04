import { Injectable } from '@nestjs/common';
import { RideStatus } from '@prisma/client';

import { NotFoundDomainException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';

import type { RidePassengerContactDto } from '@dripplex/types';

/** Driver Slice 2 item 2 — one-tap phone calling (founder-approved
 * 2026-08-04): plain `tel:` calling only, no masked calling, no telephony
 * provider. `RideDto` never exposes the customer's name/phone to the
 * driver (see `PassengerCard`'s honest gap notice) — this service closes
 * that gap by reading the Ride/User tables directly via Prisma, read-only.
 *
 * Deliberately lives under `drivers/`, not `rides/` — the Ride module is
 * frozen (bug fixes/security/perf/regulatory/founder-approved only, no
 * functional expansion; see MATURITY.md). This is the same cross-module
 * read pattern already used elsewhere (wallet, notifications reading Ride
 * tables without touching Ride's own files): no file under
 * `apps/backend/src/rides/` is modified to deliver this capability. */
@Injectable()
export class DriverRideContactService {
  constructor(private readonly prisma: PrismaService) {}

  /** The customer contact for whichever ride is currently active for this
   * driver. "Active" is scoped to statuses where the driver and customer
   * are actually expected to coordinate in real time — assigned, arrived,
   * or in progress. Throws if the driver has no such ride right now,
   * rather than silently resolving stale/unrelated contact info. */
  public async getActiveContact(driverUserId: string): Promise<RidePassengerContactDto> {
    const ride = await this.prisma.ride.findFirst({
      where: {
        driverId: driverUserId,
        status: {
          in: [RideStatus.DRIVER_ASSIGNED, RideStatus.ARRIVED, RideStatus.IN_PROGRESS],
        },
      },
      orderBy: { requestedAt: 'desc' },
      select: {
        id: true,
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });

    if (!ride) {
      throw new NotFoundDomainException('No active ride to resolve passenger contact for');
    }

    return {
      rideId: ride.id,
      customerId: ride.customer.id,
      name: `${ride.customer.firstName} ${ride.customer.lastName}`.trim(),
      phone: ride.customer.phone,
    };
  }
}
