import { Injectable } from '@nestjs/common';
import { DeliveryStatus, FleetMemberRole, FleetMemberStatus, RideStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { FleetCommissionService } from './fleet-commission.service';
import { FleetsService } from './fleets.service';

import type {
  AdminFleetListItemDto,
  FleetDto,
  FleetJobDto,
  FleetMemberDto,
  FleetOverviewDto,
} from '@dripplex/types';
import type { Fleet } from '@prisma/client';

/**
 * How stale a position may be before the console stops claiming it is live.
 *
 * Matches `DRIVER_LOCATION_MAX_AGE_MS` in the ride module rather than
 * inventing a second answer: dispatch already treats a driver whose app
 * stopped reporting as not-there, and a map that shows a pin dispatch will not
 * use tells the owner something untrue.
 */
const POSITION_MAX_AGE_MS = 5 * 60_000;

/** Live rides and deliveries — someone is waiting on each of these. */
const LIVE_RIDE_STATUSES: RideStatus[] = [
  RideStatus.DRIVER_ASSIGNED,
  RideStatus.ARRIVED,
  RideStatus.IN_PROGRESS,
];
const LIVE_DELIVERY_STATUSES: DeliveryStatus[] = [
  DeliveryStatus.ASSIGNED,
  DeliveryStatus.ACCEPTED,
  DeliveryStatus.PICKED_UP,
];

/**
 * Who counts as being on the fleet.
 *
 * PENDING is a claim awaiting the owner's confirmation and REJECTED is one
 * they refused; neither belongs in the member list, the member counts, or the
 * volume figures.
 */
const MEMBER_STATUSES: FleetMemberStatus[] = [
  FleetMemberStatus.ACTIVE,
  FleetMemberStatus.DEACTIVATED,
];

/**
 * DPX-FLEET — everything the fleet owner's console shows.
 *
 * Scoped to one fleet throughout. Every query here is filtered by the fleet's
 * own membership, because the whole risk of this feature is one company seeing
 * another company's riders: the scoping is the security boundary, not a
 * convenience.
 *
 * Positions are only returned while a rider is online or on a job. Founder
 * decision, 2026-08-30 — an owner watching where his rider is on their own
 * time is a different thing from monitoring a shift, and only the second was
 * asked for.
 */
@Injectable()
export class FleetOverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fleets: FleetsService,
    private readonly commission: FleetCommissionService,
  ) {}

  private toFleetDto(fleet: Fleet): FleetDto {
    return {
      id: fleet.id,
      fleetNumber: fleet.fleetNumber,
      name: fleet.name,
      contactPhone: fleet.contactPhone,
      status: fleet.status,
      suspendedReason: fleet.suspendedReason,
      createdAt: fleet.createdAt.toISOString(),
    };
  }

  /** Members, their live position where there is one, and their volume. */
  public async listMembers(fleetId: string): Promise<FleetMemberDto[]> {
    return await this.listByStatus(fleetId, MEMBER_STATUSES);
  }

  /**
   * Riders who quoted this fleet's DX number and are waiting to be confirmed.
   *
   * A separate call from `listMembers` rather than a flag on it, because these
   * are not members: they are claims. Mixing them into one list is how an
   * owner ends up confirming somebody by accident.
   */
  public async listPendingRequests(fleetId: string): Promise<FleetMemberDto[]> {
    return await this.listByStatus(fleetId, [FleetMemberStatus.PENDING]);
  }

  private async listByStatus(
    fleetId: string,
    statuses: FleetMemberStatus[],
  ): Promise<FleetMemberDto[]> {
    const members = await this.prisma.fleetMember.findMany({
      where: { fleetId, status: { in: statuses } },
      include: { user: true },
      orderBy: { joinedAt: 'asc' },
    });

    if (members.length === 0) return [];

    const userIds = members.map((member) => member.userId);
    const periodStart = this.commission.monthStart(new Date());
    const freshSince = new Date(Date.now() - POSITION_MAX_AGE_MS);

    const [riderAvailability, driverAvailability, deliveries, rides] = await Promise.all([
      this.prisma.riderAvailability.findMany({ where: { riderId: { in: userIds } } }),
      this.prisma.driverAvailability.findMany({ where: { driverId: { in: userIds } } }),
      this.prisma.deliveryJob.groupBy({
        by: ['riderId'],
        where: {
          riderId: { in: userIds },
          status: DeliveryStatus.DELIVERED,
          deliveredAt: { gte: periodStart },
        },
        _count: { _all: true },
        _sum: { deliveryFee: true },
      }),
      this.prisma.ride.groupBy({
        by: ['driverId'],
        where: {
          driverId: { in: userIds },
          status: RideStatus.COMPLETED,
          completedAt: { gte: periodStart },
        },
        _count: { _all: true },
        _sum: { totalFare: true },
      }),
    ]);

    const riderById = new Map(riderAvailability.map((row) => [row.riderId, row]));
    const driverById = new Map(driverAvailability.map((row) => [row.driverId, row]));
    const deliveriesById = new Map(deliveries.map((row) => [row.riderId ?? '', row]));
    const ridesById = new Map(rides.map((row) => [row.driverId ?? '', row]));

    return members.map((member) => {
      const isRider = member.role === FleetMemberRole.RIDER;
      const rider = riderById.get(member.userId);
      const driver = driverById.get(member.userId);

      const online = isRider ? (rider?.online ?? false) : (driver?.online ?? false);
      const onJob = isRider ? (rider?.activeJobCount ?? 0) > 0 : (driver?.activeRideCount ?? 0) > 0;

      // A rider's row has no separate location timestamp, so `updatedAt`
      // stands in — it moves on every ping, which is the same signal.
      const positionAt = isRider ? (rider?.updatedAt ?? null) : (driver?.locationUpdatedAt ?? null);
      const latitude = isRider ? rider?.latitude : driver?.latitude;
      const longitude = isRider ? rider?.longitude : driver?.longitude;

      const positionIsLive =
        (online || onJob) &&
        positionAt !== null &&
        positionAt >= freshSince &&
        latitude !== null &&
        latitude !== undefined &&
        longitude !== null &&
        longitude !== undefined;

      const deliveryStats = deliveriesById.get(member.userId);
      const rideStats = ridesById.get(member.userId);

      return {
        memberId: member.id,
        userId: member.userId,
        name: `${member.user.firstName} ${member.user.lastName}`.trim(),
        phone: member.user.phone,
        role: member.role,
        status: member.status,
        deactivatedReason: member.deactivatedReason,
        joinedAt: member.joinedAt.toISOString(),
        online,
        onJob,
        // Null unless they are working. See the class comment.
        latitude: positionIsLive ? Number(latitude) : null,
        longitude: positionIsLive ? Number(longitude) : null,
        positionAt: positionIsLive ? positionAt.toISOString() : null,
        completedThisMonth: (deliveryStats?._count._all ?? 0) + (rideStats?._count._all ?? 0),
        grossThisMonth:
          Number(deliveryStats?._sum.deliveryFee ?? 0) + Number(rideStats?._sum.totalFare ?? 0),
      };
    });
  }

  /** What the fleet's people are doing right now. */
  public async listLiveJobs(fleetId: string): Promise<FleetJobDto[]> {
    const memberIds = await this.activeMemberUserIds(fleetId);
    if (memberIds.length === 0) return [];

    const [rides, deliveries] = await Promise.all([
      this.prisma.ride.findMany({
        where: { driverId: { in: memberIds }, status: { in: LIVE_RIDE_STATUSES } },
        include: { driver: true },
        orderBy: { requestedAt: 'desc' },
      }),
      this.prisma.deliveryJob.findMany({
        where: { riderId: { in: memberIds }, status: { in: LIVE_DELIVERY_STATUSES } },
        include: { rider: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const rideJobs: FleetJobDto[] = rides.map((ride) => ({
      jobId: ride.id,
      kind: 'RIDE',
      status: ride.status,
      memberName: ride.driver
        ? `${ride.driver.firstName} ${ride.driver.lastName}`.trim()
        : 'Unassigned',
      memberUserId: ride.driverId,
      amount: Number(ride.totalFare),
      startedAt: ride.requestedAt.toISOString(),
    }));

    const deliveryJobs: FleetJobDto[] = deliveries.map((job) => ({
      jobId: job.id,
      kind: 'DELIVERY',
      status: job.status,
      memberName: job.rider ? `${job.rider.firstName} ${job.rider.lastName}`.trim() : 'Unassigned',
      memberUserId: job.riderId,
      amount: Number(job.deliveryFee),
      startedAt: job.createdAt.toISOString(),
    }));

    return [...rideJobs, ...deliveryJobs].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  private async activeMemberUserIds(fleetId: string): Promise<string[]> {
    const members = await this.prisma.fleetMember.findMany({
      where: { fleetId, status: { not: FleetMemberStatus.REMOVED } },
      select: { userId: true },
    });
    return members.map((member) => member.userId);
  }

  /**
   * Operations' fleet dashboard — every fleet, with who runs it and what it
   * owes.
   *
   * Deliberately answers the whole question in one call. The operator's
   * question is never "does DX-FL-0002 exist" but "who runs it, how many
   * people has it got out, what does it owe this month" — and a bare list of
   * names would make them open each fleet in turn to find out.
   */
  public async listForAdmin(query: {
    includeSuspended?: boolean;
  }): Promise<AdminFleetListItemDto[]> {
    const fleets = await this.fleets.listFleets(
      query.includeSuspended === undefined ? {} : { includeSuspended: query.includeSuspended },
    );
    if (fleets.length === 0) return [];

    const fleetIds = fleets.map((fleet) => fleet.id);
    const [owners, memberRows] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: fleets.map((fleet) => fleet.ownerId) } },
        select: { id: true, firstName: true, lastName: true, phone: true, email: true },
      }),
      this.prisma.fleetMember.groupBy({
        by: ['fleetId', 'status'],
        where: { fleetId: { in: fleetIds }, status: { not: FleetMemberStatus.REMOVED } },
        _count: { _all: true },
      }),
    ]);

    const ownerById = new Map(owners.map((owner) => [owner.id, owner]));

    // The running month is per-fleet and cheap (one row each), so it is read
    // in parallel rather than turned into a single clever aggregate — the
    // projected rate depends on each fleet's own negotiated rate. Carried
    // alongside its fleet rather than as a parallel array, so nothing depends
    // on two lists staying in the same order.
    const withTotals = await Promise.all(
      fleets.map(async (fleet) => ({
        fleet,
        totals: await this.commission.periodTotals(fleet.id),
      })),
    );

    return withTotals.map(({ fleet, totals }) => {
      const owner = ownerById.get(fleet.ownerId);
      const counts = memberRows.filter((row) => row.fleetId === fleet.id);
      const active =
        counts.find((row) => row.status === FleetMemberStatus.ACTIVE)?._count._all ?? 0;
      const deactivated =
        counts.find((row) => row.status === FleetMemberStatus.DEACTIVATED)?._count._all ?? 0;

      return {
        fleet: this.toFleetDto(fleet),
        owner: {
          userId: fleet.ownerId,
          // A deleted owner leaves the fleet standing; the row says so rather
          // than rendering "undefined undefined".
          name:
            owner === undefined
              ? 'Owner account not found'
              : `${owner.firstName} ${owner.lastName}`.trim(),
          phone: owner?.phone ?? null,
          email: owner?.email ?? '',
        },
        memberCounts: { total: active + deactivated, active, deactivated },
        period: {
          periodStart: totals.periodStart.toISOString(),
          periodEnd: totals.periodEnd.toISOString(),
          orderCount: totals.orderCount,
          chargeableTotal: totals.chargeableTotal,
          projectedRate: totals.projectedRate,
          projectedCommission: totals.projectedCommission,
          settled: totals.settled,
          appliedRate: totals.appliedRate,
          commissionAmount: totals.commissionAmount,
        },
        negotiatedRate: fleet.negotiatedRate === null ? null : Number(fleet.negotiatedRate),
        negotiationNote: fleet.negotiationNote,
        negotiatedAt: fleet.negotiatedAt === null ? null : fleet.negotiatedAt.toISOString(),
      };
    });
  }

  /** The console's landing view. */
  public async getOverview(fleetId: string): Promise<FleetOverviewDto> {
    const fleet = await this.fleets.requireFleet(fleetId);
    const [members, pendingRequests, liveJobs, totals] = await Promise.all([
      this.listMembers(fleetId),
      this.listPendingRequests(fleetId),
      this.listLiveJobs(fleetId),
      this.commission.periodTotals(fleetId),
    ]);

    return {
      fleet: this.toFleetDto(fleet),
      members,
      pendingRequests,
      liveJobs,
      period: {
        periodStart: totals.periodStart.toISOString(),
        periodEnd: totals.periodEnd.toISOString(),
        orderCount: totals.orderCount,
        chargeableTotal: totals.chargeableTotal,
        projectedRate: totals.projectedRate,
        projectedCommission: totals.projectedCommission,
        settled: totals.settled,
        appliedRate: totals.appliedRate,
        commissionAmount: totals.commissionAmount,
      },
      summary: {
        totalMembers: members.length,
        onlineMembers: members.filter((member) => member.online).length,
        onJobMembers: members.filter((member) => member.onJob).length,
        deactivatedMembers: members.filter(
          (member) => member.status === FleetMemberStatus.DEACTIVATED,
        ).length,
        pendingRequests: pendingRequests.length,
      },
    };
  }
}
