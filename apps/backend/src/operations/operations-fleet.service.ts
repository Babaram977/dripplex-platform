import { Injectable } from '@nestjs/common';
import {
  DriverShiftStatus,
  DriverStatus,
  InspectionStatus,
  RideStatus,
  SosAlertStatus,
  VehicleApprovalStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { DRIVER_LOCATION_MAX_AGE_MS } from '../rides/ride.constants';

import { toFleetDriverDto } from './operations.mapper';

import type { FleetDriverStatus, OperationsFleetSnapshotDto } from '@dripplex/types';

const ACTIVE_RIDE_STATUSES: RideStatus[] = [
  RideStatus.DRIVER_ASSIGNED,
  RideStatus.ARRIVED,
  RideStatus.IN_PROGRESS,
];

/** A driver's inspection is treated as satisfied only by their most
 * recently *decided* (PASSED/FAILED) inspection on their active vehicle —
 * same definition `DriverActivationService.checkEligibility()` uses for
 * the activation gate, applied here read-only for fleet visibility rather
 * than to gate anything. Computed in bulk across the whole fleet snapshot
 * (a handful of `findMany` calls), not per-driver, to keep this cheap
 * enough to poll. */
export interface FleetComputationInput {
  driverId: string;
  driverStatus: DriverStatus;
  hasOpenSos: boolean;
  /**
   * Reachability, NOT the driver's own toggle.
   *
   * Dispatch has refused to offer rides to a driver whose last position is
   * older than DRIVER_LOCATION_MAX_AGE_MS ever since the stale-location fix.
   * This snapshot must apply the identical test or Operations reads a fleet
   * that does not exist — drivers shown ready for work that dispatch has
   * already written off. The caller does the freshness comparison and passes
   * the answer in; see `isReachable` at the call site.
   */
  reachable: boolean;
  acceptingRides: boolean;
  activeRideCount: number;
  hasActiveRide: boolean;
  shiftStatus: 'ACTIVE' | 'ON_BREAK' | null;
  vehicleApprovalStatus: VehicleApprovalStatus | null;
  latestDecidedInspectionStatus: InspectionStatus | null;
}

/** Priority when a driver matches more than one condition — highest wins.
 * Safety/compliance flags outrank routine activity status, per the
 * founder's own ordering ("SOS drivers (highest priority)..."). */
export function computeFleetDriverStatus(input: FleetComputationInput): FleetDriverStatus {
  if (input.hasOpenSos) return 'SOS';
  if (input.driverStatus === DriverStatus.SUSPENDED) return 'SUSPENDED';

  const needsInspection =
    input.vehicleApprovalStatus === null ||
    input.vehicleApprovalStatus === VehicleApprovalStatus.PENDING ||
    input.latestDecidedInspectionStatus === null ||
    input.latestDecidedInspectionStatus === InspectionStatus.FAILED;
  if (needsInspection) return 'NEEDS_INSPECTION';

  if (input.hasActiveRide || input.activeRideCount > 0) return 'BUSY';
  if (input.reachable && input.acceptingRides) return 'AVAILABLE';
  return 'OFFLINE';
}

/**
 * Whether the platform can still see this driver.
 *
 * The toggle alone is not evidence of anything: nothing clears `online` when a
 * driver force-quits, loses signal or lets their battery die, so the flag
 * survives indefinitely. Freshness of the last position ping is the only
 * signal that the driver is actually there, which is why dispatch already
 * gates on it — this reuses that rule rather than inventing a second one.
 */
export function isReachable(
  online: boolean,
  locationUpdatedAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (!online || locationUpdatedAt === null) return false;
  return now.getTime() - locationUpdatedAt.getTime() <= DRIVER_LOCATION_MAX_AGE_MS;
}

/**
 * DPX-OPS-001 Slice 1 — read-only fleet snapshot for the Live Fleet Map and
 * driver list. Reads `DriverProfile`/`DriverAvailability`/`Vehicle`/
 * `Inspection`/`DriverShift`/`SosAlert`/`Ride` directly via Prisma — the
 * same established cross-module-read pattern `SosAlertService`/
 * `DriverRideContactService`/`DriversService.getOwnPerformanceStats`
 * already use. `apps/backend/src/rides/` files are never touched; `Ride`
 * is only ever read here, never written.
 */
@Injectable()
export class OperationsFleetService {
  constructor(private readonly prisma: PrismaService) {}

  public async getFleetSnapshot(): Promise<OperationsFleetSnapshotDto> {
    const profiles = await this.prisma.driverProfile.findMany({
      where: {
        deletedAt: null,
        status: { in: [DriverStatus.APPROVED, DriverStatus.SUSPENDED] },
      },
      include: { user: true },
    });
    const driverIds = profiles.map((profile) => profile.userId);

    if (driverIds.length === 0) {
      return {
        drivers: [],
        summary: {
          totalDrivers: 0,
          onlineCount: 0,
          staleCount: 0,
          availableCount: 0,
          busyCount: 0,
          offlineCount: 0,
          sosCount: 0,
          suspendedCount: 0,
          needsInspectionCount: 0,
        },
      };
    }

    const [availability, openSosAlerts, activeShifts, vehicles, activeRides] = await Promise.all([
      this.prisma.driverAvailability.findMany({ where: { driverId: { in: driverIds } } }),
      this.prisma.sosAlert.findMany({
        where: {
          driverId: { in: driverIds },
          status: { in: [SosAlertStatus.OPEN, SosAlertStatus.ACKNOWLEDGED] },
        },
      }),
      this.prisma.driverShift.findMany({
        where: {
          driverId: { in: driverIds },
          status: { in: [DriverShiftStatus.ACTIVE, DriverShiftStatus.ON_BREAK] },
        },
      }),
      this.prisma.vehicle.findMany({ where: { driverId: { in: driverIds }, isActive: true } }),
      this.prisma.ride.findMany({
        where: { driverId: { in: driverIds }, status: { in: ACTIVE_RIDE_STATUSES } },
      }),
    ]);

    const vehicleIds = vehicles.map((vehicle) => vehicle.id);
    const decidedInspections =
      vehicleIds.length > 0
        ? await this.prisma.inspection.findMany({
            where: {
              vehicleId: { in: vehicleIds },
              status: { in: [InspectionStatus.PASSED, InspectionStatus.FAILED] },
            },
            orderBy: { completedAt: 'desc' },
          })
        : [];

    // One timestamp for the whole snapshot, so two drivers with identical
    // ping ages cannot land on opposite sides of the freshness cut-off
    // partway through the loop.
    const now = new Date();

    const drivers = profiles.map((profile) => {
      const driverId = profile.userId;
      const driverAvailability = availability.find((a) => a.driverId === driverId);
      const hasOpenSos = openSosAlerts.some((alert) => alert.driverId === driverId);
      const shift = activeShifts.find((s) => s.driverId === driverId);
      // A driver may have more than one active vehicle on file; the fleet
      // view only needs one representative vehicle — the most recently
      // updated active one.
      const vehicle = vehicles
        .filter((v) => v.driverId === driverId)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
      const latestInspection = vehicle
        ? decidedInspections.find((i) => i.vehicleId === vehicle.id)
        : undefined;
      const activeRide = activeRides.find((r) => r.driverId === driverId);

      const reachable = isReachable(
        driverAvailability?.online ?? false,
        driverAvailability?.locationUpdatedAt ?? null,
        now,
      );

      const status = computeFleetDriverStatus({
        driverId,
        driverStatus: profile.status,
        hasOpenSos,
        reachable,
        acceptingRides: driverAvailability?.acceptingRides ?? false,
        activeRideCount: driverAvailability?.activeRideCount ?? 0,
        hasActiveRide: activeRide !== undefined,
        shiftStatus: shift ? (shift.status as 'ACTIVE' | 'ON_BREAK') : null,
        vehicleApprovalStatus: vehicle?.approvalStatus ?? null,
        latestDecidedInspectionStatus: latestInspection?.status ?? null,
      });

      return toFleetDriverDto({
        profile,
        user: profile.user,
        status,
        reachable,
        hasOpenSos,
        isSuspended: profile.status === DriverStatus.SUSPENDED,
        needsInspection: status === 'NEEDS_INSPECTION',
        availability: driverAvailability,
        activeRideId: activeRide?.id ?? null,
        shiftStatus: shift ? (shift.status as 'ACTIVE' | 'ON_BREAK') : null,
        vehiclePlateNumber: vehicle?.plateNumber ?? null,
      });
    });

    // The first three partition the fleet and must keep summing to
    // totalDrivers. They are deliberately derived from reachability rather
    // than from `status`: `status` answers "why can't this driver work",
    // which is a different question and overlaps itself (a suspended driver
    // is never also counted OFFLINE). Mixing the two is what previously let
    // the same driver be counted twice, or not at all.
    const onlineCount = drivers.filter((d) => d.reachable).length;
    const staleCount = drivers.filter((d) => d.online && !d.reachable).length;

    const summary = {
      totalDrivers: drivers.length,
      onlineCount,
      staleCount,
      offlineCount: drivers.length - onlineCount - staleCount,
      availableCount: drivers.filter((d) => d.status === 'AVAILABLE').length,
      busyCount: drivers.filter((d) => d.status === 'BUSY').length,
      sosCount: drivers.filter((d) => d.status === 'SOS').length,
      suspendedCount: drivers.filter((d) => d.status === 'SUSPENDED').length,
      needsInspectionCount: drivers.filter((d) => d.status === 'NEEDS_INSPECTION').length,
    };

    return { drivers, summary };
  }
}
