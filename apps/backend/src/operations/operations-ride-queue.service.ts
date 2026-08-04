import { Injectable } from '@nestjs/common';
import { RideStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { toLiveRideDto } from './operations.mapper';

import type { OperationsRideQueueDto } from '@dripplex/types';

const PENDING_STATUSES: RideStatus[] = [RideStatus.REQUESTED, RideStatus.SEARCHING];
const ASSIGNED_STATUSES: RideStatus[] = [RideStatus.DRIVER_ASSIGNED, RideStatus.ARRIVED];
const LIVE_STATUSES: RideStatus[] = [
  ...PENDING_STATUSES,
  ...ASSIGNED_STATUSES,
  RideStatus.IN_PROGRESS,
];

/**
 * DPX-OPS-001 Slice 1 — read-only live ride queue for Dispatch Oversight's
 * "what's happening right now" view. Reads `Ride` directly, read-only —
 * `apps/backend/src/rides/` files are never touched or modified. Every
 * "live" status (unassigned requests through in-progress trips) in one
 * list; `AdminRideReportsController` (problem reports, a different
 * concern) is unaffected and unrelated.
 */
@Injectable()
export class OperationsRideQueueService {
  constructor(private readonly prisma: PrismaService) {}

  public async getRideQueue(): Promise<OperationsRideQueueDto> {
    const rides = await this.prisma.ride.findMany({
      where: { status: { in: LIVE_STATUSES } },
      include: { customer: true, driver: true },
      orderBy: { requestedAt: 'asc' },
    });

    return {
      rides: rides.map(toLiveRideDto),
      summary: {
        pendingCount: rides.filter((r) => PENDING_STATUSES.includes(r.status)).length,
        assignedCount: rides.filter((r) => ASSIGNED_STATUSES.includes(r.status)).length,
        inProgressCount: rides.filter((r) => r.status === RideStatus.IN_PROGRESS).length,
      },
    };
  }
}
