import { Injectable } from '@nestjs/common';
import { InspectionStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { OperationsCasesService } from './operations-cases.service';

import type {
  ActivityFeedDto,
  ActivityFeedItemDto,
  OperationsQueueCountersDto,
} from '@dripplex/types';

/** How many rows to pull per source table before merging — the dashboard
 * only ever shows the newest `FEED_LIMIT` overall, but each source query
 * needs its own small limit so one quiet table doesn't starve a busy one
 * out of the merge. */
const PER_SOURCE_LIMIT = 15;
const FEED_LIMIT = 20;

/**
 * DPX-OPS-001 Slice 2 — dashboard extension: queue counters (Slice 1's
 * "Slice 1's dashboard should automatically surface... without
 * duplicating backend logic" requirement) and the Live Activity Feed
 * ("one more addition" the founder asked for). Both are pure read
 * aggregations — no new domain logic, no new event log. The activity feed
 * is composed from existing timestamped rows (`SosAlert`, `IncidentReport`,
 * `Inspection`, `DriverShift`, `Ride`), not a persisted event stream; see
 * this module's own doc comment on `ActivityFeedEventType` in
 * `@dripplex/types` for the one deliberate gap (driver online/offline has
 * no history to read from without touching frozen availability-update
 * code).
 */
@Injectable()
export class OperationsDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly casesService: OperationsCasesService,
  ) {}

  public async getQueueCounters(): Promise<OperationsQueueCountersDto> {
    return await this.casesService.getQueueCounters();
  }

  public async getActivityFeed(): Promise<ActivityFeedDto> {
    const [sosAlerts, incidentReports, inspections, shiftsStarted, shiftsEnded, cancelledRides] =
      await Promise.all([
        this.prisma.sosAlert.findMany({
          include: { driver: true },
          orderBy: { createdAt: 'desc' },
          take: PER_SOURCE_LIMIT,
        }),
        this.prisma.incidentReport.findMany({
          include: { driver: true },
          orderBy: { createdAt: 'desc' },
          take: PER_SOURCE_LIMIT,
        }),
        this.prisma.inspection.findMany({
          where: { status: { in: [InspectionStatus.PASSED, InspectionStatus.FAILED] } },
          include: { driver: true },
          orderBy: { completedAt: 'desc' },
          take: PER_SOURCE_LIMIT,
        }),
        this.prisma.driverShift.findMany({
          include: { driver: true },
          orderBy: { startedAt: 'desc' },
          take: PER_SOURCE_LIMIT,
        }),
        this.prisma.driverShift.findMany({
          where: { endedAt: { not: null } },
          include: { driver: true },
          orderBy: { endedAt: 'desc' },
          take: PER_SOURCE_LIMIT,
        }),
        this.prisma.ride.findMany({
          where: { cancelledAt: { not: null } },
          include: { driver: true },
          orderBy: { cancelledAt: 'desc' },
          take: PER_SOURCE_LIMIT,
        }),
      ]);

    const items: ActivityFeedItemDto[] = [
      ...sosAlerts.map((alert): ActivityFeedItemDto => ({
        id: `sos:${alert.id}`,
        type: 'SOS_TRIGGERED',
        message: `${alert.driver.firstName} ${alert.driver.lastName} triggered an SOS alert.`,
        occurredAt: alert.createdAt.toISOString(),
        driverId: alert.driverId,
        driverName: `${alert.driver.firstName} ${alert.driver.lastName}`,
      })),
      ...incidentReports.map((report): ActivityFeedItemDto => ({
        id: `incident:${report.id}`,
        type: 'INCIDENT_REPORTED',
        message: `${report.driver.firstName} ${report.driver.lastName} reported a ${report.category.toLowerCase().replace('_', ' ')} incident.`,
        occurredAt: report.createdAt.toISOString(),
        driverId: report.driverId,
        driverName: `${report.driver.firstName} ${report.driver.lastName}`,
      })),
      ...inspections
        .filter((inspection) => inspection.completedAt !== null)
        .map((inspection): ActivityFeedItemDto => ({
          id: `inspection:${inspection.id}`,
          type: 'INSPECTION_COMPLETED',
          message: `${inspection.driver.firstName} ${inspection.driver.lastName}'s vehicle inspection ${inspection.status === InspectionStatus.PASSED ? 'passed' : 'failed'}.`,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- filtered above
          occurredAt: inspection.completedAt!.toISOString(),
          driverId: inspection.driverId,
          driverName: `${inspection.driver.firstName} ${inspection.driver.lastName}`,
        })),
      ...shiftsStarted.map((shift): ActivityFeedItemDto => ({
        id: `shift-start:${shift.id}`,
        type: 'SHIFT_STARTED',
        message: `${shift.driver.firstName} ${shift.driver.lastName} started a shift.`,
        occurredAt: shift.startedAt.toISOString(),
        driverId: shift.driverId,
        driverName: `${shift.driver.firstName} ${shift.driver.lastName}`,
      })),
      ...shiftsEnded
        .filter((shift) => shift.endedAt !== null)
        .map((shift): ActivityFeedItemDto => ({
          id: `shift-end:${shift.id}`,
          type: 'SHIFT_ENDED',
          message: `${shift.driver.firstName} ${shift.driver.lastName} ended their shift.`,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- filtered above
          occurredAt: shift.endedAt!.toISOString(),
          driverId: shift.driverId,
          driverName: `${shift.driver.firstName} ${shift.driver.lastName}`,
        })),
      ...cancelledRides
        .filter((ride) => ride.cancelledAt !== null)
        .map((ride): ActivityFeedItemDto => ({
          id: `ride-cancelled:${ride.id}`,
          type: 'RIDE_CANCELLED',
          message: ride.driver
            ? `Ride with ${ride.driver.firstName} ${ride.driver.lastName} was cancelled.`
            : 'A ride was cancelled before a driver was assigned.',
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- filtered above
          occurredAt: ride.cancelledAt!.toISOString(),
          driverId: ride.driverId,
          driverName: ride.driver ? `${ride.driver.firstName} ${ride.driver.lastName}` : null,
        })),
    ];

    items.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

    return { items: items.slice(0, FEED_LIMIT) };
  }
}
