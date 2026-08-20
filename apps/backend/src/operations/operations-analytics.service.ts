import { Injectable } from '@nestjs/common';
import {
  DriverShiftStatus,
  OperationsCaseType as PrismaOperationsCaseType,
  OperationsLifecycleStatus,
  RideCancelledBy,
  RideOfferStatus,
  RideStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import type {
  AnalyticsTimeRangeDto,
  CancellationReasonCountDto,
  DemandSeriesPointDto,
  DispatchPerformanceAnalyticsDto,
  DriverUtilizationAnalyticsDto,
  DriverUtilizationRowDto,
  GeographicDemandAnalyticsDto,
  GeographicDemandCellDto,
  OperationsAnalyticsOverviewDto,
  OperationsResponseAnalyticsDto,
  OperationsResponseByTypeDto,
  RevenueBucketDto,
  RideOperationsAnalyticsDto,
  RideTypeBreakdownDto,
  ShiftAnalyticsDto,
} from '@dripplex/types';
import type { Prisma } from '@prisma/client';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const TWO_DAYS_MS = 2 * DAY_MS;

/** A caller-supplied window — always required, never defaulted server-side.
 * Per the founder's explicit instruction, time-range filtering is
 * fundamental: `operations-console` computes "Today"/"Last 7 days"/
 * "Last 30 days"/custom into concrete timestamps before ever calling this
 * service. */
export interface AnalyticsRange {
  from: Date;
  to: Date;
}

/** Drill-down ranked lists are capped, not full exports — this is a
 * decision-support screen, not a reporting tool. */
const MAX_UTILIZATION_ROWS = 20;
const MAX_CANCELLATION_REASONS = 5;
const MAX_GEOGRAPHIC_CELLS = 500;
/** ~1.1km at the equator — an accurate, if coarse, spatial bucket. Not a
 * named zone/region: the Slice 2 and Slice 4 reality audits both confirmed
 * no canonical geography model exists, and the founder's own instruction is
 * not to invent one. Grid cells report real coordinates, nothing more. */
const DEFAULT_GEOGRAPHIC_CELL_SIZE_DEGREES = 0.01;

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function secondsBetween(start: Date, end: Date | null): number | null {
  return end ? (end.getTime() - start.getTime()) / 1000 : null;
}

function toRangeDto(range: AnalyticsRange): AnalyticsTimeRangeDto {
  return { from: range.from.toISOString(), to: range.to.toISOString() };
}

interface CaseResponseRow {
  caseType: PrismaOperationsCaseType;
  createdAt: Date;
  firstRespondedAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
}

function summarizeResponseTimes(rows: CaseResponseRow[]): {
  averageTimeToFirstResponseSeconds: number | null;
  averageTimeToResolutionSeconds: number | null;
  averageTimeToClosureSeconds: number | null;
} {
  const firstResponse = rows
    .map((row) => secondsBetween(row.createdAt, row.firstRespondedAt))
    .filter((value): value is number => value !== null);
  const resolution = rows
    .map((row) => secondsBetween(row.createdAt, row.resolvedAt))
    .filter((value): value is number => value !== null);
  const closure = rows
    .map((row) => secondsBetween(row.createdAt, row.closedAt))
    .filter((value): value is number => value !== null);

  return {
    averageTimeToFirstResponseSeconds: average(firstResponse),
    averageTimeToResolutionSeconds: average(resolution),
    averageTimeToClosureSeconds: average(closure),
  };
}

/**
 * DPX-OPS-001 Slice 4 — Operations Analytics (founder-approved 2026-08-05,
 * reality-audited first — see docs/DPX-OPS-001-SLICE-4-REALITY-AUDIT.md).
 * Every method here is a live-query aggregation over real, permanent
 * records — `Ride`, `RideOffer`, `DriverShift`, `OperationsCase`. No
 * pre-aggregation table, nothing derived from a point-in-time snapshot
 * pretending to be history (fleet-availability/driver-position *trends*
 * are the one thing the reality audit found genuinely unavailable, and
 * this service does not attempt to reconstruct them). Per the founder's
 * explicit architecture decision: build inside the Operations domain, do
 * not reuse or extend the dormant Marketplace/Delivery-scoped
 * `analytics/` module — revisit materialized aggregates later only if
 * production scale requires it.
 *
 * `apps/backend/src/rides/` is never imported — the same cross-module-read
 * pattern every DPX-OPS-001 slice has used since Slice 1.
 */
@Injectable()
export class OperationsAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** The founder's own six-question framing, one query per question,
   * composed. Deliberately reuses the drill-down methods below rather than
   * duplicating their query logic — the modest overfetch this causes is an
   * accepted, documented trade-off for correctness/simplicity at current
   * data scale. */
  public async getOverview(range: AnalyticsRange): Promise<OperationsAnalyticsOverviewDto> {
    const [
      rideOperations,
      driverUtilization,
      dispatchPerformance,
      operationsResponse,
      onlineDriversNow,
      revenue,
    ] = await Promise.all([
      this.getRideOperations(range),
      this.getDriverUtilization(range),
      this.getDispatchPerformance(range),
      this.getOperationsResponse(range),
      this.prisma.driverAvailability.count({ where: { online: true } }),
      this.getRideRevenue(range),
    ]);

    return {
      range: toRangeDto(range),
      ridesRequested: rideOperations.requested,
      ridesCompleted: rideOperations.completed,
      completionRate: rideOperations.completionRate,
      cancellationRate: rideOperations.cancellationRate,
      noDriversFoundRate: rideOperations.noDriversFoundRate,
      onlineDriversNow,
      activeDriversInRange: driverUtilization.driverCount,
      averageUtilizationRate: driverUtilization.averageUtilizationRate,
      averageTimeToAcceptSeconds: dispatchPerformance.averageTimeToAcceptSeconds,
      repeatedOfferRideRate: dispatchPerformance.repeatedOfferRate,
      openCasesCount: operationsResponse.openCasesCount,
      averageTimeToFirstResponseSeconds: operationsResponse.averageTimeToFirstResponseSeconds,
      grossFareRevenue: revenue.grossFareRevenue,
      platformCommissionRevenue: revenue.platformCommissionRevenue,
      driverEarnings: revenue.driverEarnings,
      tipsCollected: revenue.tipsCollected,
      revenueSeries: revenue.revenueSeries,
    };
  }

  /**
   * Money over rides COMPLETED inside the range.
   *
   * The Ops dashboard's "Revenue Today" tile and its "Revenue Over Time" chart
   * had no backend feed at all: the tile was a hardcoded em-dash reading "No
   * feed yet" and the chart drew an empty box. Every figure it needs is
   * already on the ride — `totalFare`, `platformCommission`, `driverEarning`,
   * `tipAmount` are written at settlement — so this aggregates them rather
   * than introducing any new accounting.
   *
   * Cohorted on `completedAt`, exactly like `ridesCompleted`, so the two
   * numbers on the dashboard always describe the same set of rides. Tips are
   * reported separately and excluded from both revenue figures: 100% of a tip
   * goes to the driver and it was never the platform's money.
   */
  public async getRideRevenue(range: AnalyticsRange): Promise<{
    grossFareRevenue: number;
    platformCommissionRevenue: number;
    driverEarnings: number;
    tipsCollected: number;
    revenueSeries: RevenueBucketDto[];
  }> {
    const rides = await this.prisma.ride.findMany({
      where: { status: RideStatus.COMPLETED, completedAt: { gte: range.from, lte: range.to } },
      select: {
        completedAt: true,
        totalFare: true,
        platformCommission: true,
        driverEarning: true,
        tipAmount: true,
      },
    });

    const money = (value: Prisma.Decimal | null): number => (value ? Number(value) : 0);
    const round = (value: number): number => Math.round(value * 100) / 100;

    // Hourly for a day-or-two window (the dashboard's "today"), daily beyond —
    // a month of hourly buckets is 720 points nobody can read.
    const spanMs = Math.max(0, range.to.getTime() - range.from.getTime());
    const bucketMs = spanMs <= TWO_DAYS_MS ? HOUR_MS : DAY_MS;
    const floorToBucket = (at: Date): number => Math.floor(at.getTime() / bucketMs) * bucketMs;

    const buckets = new Map<
      number,
      { grossFare: number; platformCommission: number; ridesCompleted: number }
    >();
    // Seed every bucket in range so a quiet hour plots as zero rather than
    // vanishing and making the line lie about when money came in.
    for (let cursor = floorToBucket(range.from); cursor <= range.to.getTime(); cursor += bucketMs) {
      buckets.set(cursor, { grossFare: 0, platformCommission: 0, ridesCompleted: 0 });
    }

    let grossFareRevenue = 0;
    let platformCommissionRevenue = 0;
    let driverEarnings = 0;
    let tipsCollected = 0;

    for (const ride of rides) {
      const gross = money(ride.totalFare);
      const commission = money(ride.platformCommission);
      grossFareRevenue += gross;
      platformCommissionRevenue += commission;
      driverEarnings += money(ride.driverEarning);
      tipsCollected += money(ride.tipAmount);

      if (!ride.completedAt) continue;
      const key = floorToBucket(ride.completedAt);
      const bucket = buckets.get(key) ?? {
        grossFare: 0,
        platformCommission: 0,
        ridesCompleted: 0,
      };
      bucket.grossFare += gross;
      bucket.platformCommission += commission;
      bucket.ridesCompleted += 1;
      buckets.set(key, bucket);
    }

    return {
      grossFareRevenue: round(grossFareRevenue),
      platformCommissionRevenue: round(platformCommissionRevenue),
      driverEarnings: round(driverEarnings),
      tipsCollected: round(tipsCollected),
      revenueSeries: [...buckets.entries()]
        .sort(([a], [b]) => a - b)
        .map(([start, bucket]) => ({
          bucketStart: new Date(start).toISOString(),
          grossFare: round(bucket.grossFare),
          platformCommission: round(bucket.platformCommission),
          ridesCompleted: bucket.ridesCompleted,
        })),
    };
  }

  /** "Online seconds" is shift time (`DriverShift`), not raw
   * `DriverAvailability.online` time — the two are deliberately independent
   * per `DriverShift`'s own schema doc comment, and shift time is the real,
   * queryable proxy for "time available to drive." A shift counts fully
   * toward the period it *started* in, even if it's still ongoing or ended
   * after `range.to` — the same "cohort by start time" convention every
   * range-scoped query in this service uses. */
  public async getDriverUtilization(range: AnalyticsRange): Promise<DriverUtilizationAnalyticsDto> {
    const [shifts, completedRides] = await Promise.all([
      this.prisma.driverShift.findMany({
        where: { startedAt: { gte: range.from, lte: range.to } },
        select: { driverId: true, startedAt: true, endedAt: true },
      }),
      this.prisma.ride.findMany({
        where: { status: RideStatus.COMPLETED, completedAt: { gte: range.from, lte: range.to } },
        select: { driverId: true, startedAt: true, completedAt: true, driverEarning: true },
      }),
    ]);

    const driverIds = new Set<string>();
    for (const shift of shifts) driverIds.add(shift.driverId);
    for (const ride of completedRides) {
      if (ride.driverId) driverIds.add(ride.driverId);
    }

    const drivers =
      driverIds.size > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: [...driverIds] } },
            select: { id: true, firstName: true, lastName: true },
          })
        : [];
    const driverNameById = new Map(
      drivers.map((driver) => [driver.id, `${driver.firstName} ${driver.lastName}`]),
    );

    interface Accumulator {
      onlineSeconds: number;
      onTripSeconds: number;
      tripsCompleted: number;
      earnings: number;
    }
    const rows = new Map<string, Accumulator>();
    const ensure = (driverId: string): Accumulator => {
      let row = rows.get(driverId);
      if (!row) {
        row = { onlineSeconds: 0, onTripSeconds: 0, tripsCompleted: 0, earnings: 0 };
        rows.set(driverId, row);
      }
      return row;
    };

    for (const shift of shifts) {
      const end = shift.endedAt ?? new Date();
      ensure(shift.driverId).onlineSeconds += Math.max(
        0,
        (end.getTime() - shift.startedAt.getTime()) / 1000,
      );
    }
    for (const ride of completedRides) {
      if (!ride.driverId) continue;
      const row = ensure(ride.driverId);
      row.tripsCompleted += 1;
      row.earnings += ride.driverEarning ? Number(ride.driverEarning) : 0;
      if (ride.startedAt && ride.completedAt) {
        row.onTripSeconds += Math.max(
          0,
          (ride.completedAt.getTime() - ride.startedAt.getTime()) / 1000,
        );
      }
    }

    const topDrivers: DriverUtilizationRowDto[] = [...rows.entries()]
      .map(([driverId, row]) => ({
        driverId,
        driverName: driverNameById.get(driverId) ?? 'Unknown driver',
        tripsCompleted: row.tripsCompleted,
        earnings: row.earnings,
        onlineSeconds: Math.round(row.onlineSeconds),
        onTripSeconds: Math.round(row.onTripSeconds),
        utilizationRate: row.onlineSeconds > 0 ? row.onTripSeconds / row.onlineSeconds : null,
      }))
      .sort((a, b) => b.tripsCompleted - a.tripsCompleted)
      .slice(0, MAX_UTILIZATION_ROWS);

    const totalOnlineSeconds = [...rows.values()].reduce((sum, row) => sum + row.onlineSeconds, 0);
    const totalOnTripSeconds = [...rows.values()].reduce((sum, row) => sum + row.onTripSeconds, 0);

    return {
      range: toRangeDto(range),
      driverCount: rows.size,
      totalOnlineSeconds: Math.round(totalOnlineSeconds),
      totalOnTripSeconds: Math.round(totalOnTripSeconds),
      averageUtilizationRate:
        totalOnlineSeconds > 0 ? totalOnTripSeconds / totalOnlineSeconds : null,
      totalTripsCompleted: completedRides.length,
      totalEarnings: [...rows.values()].reduce((sum, row) => sum + row.earnings, 0),
      topDrivers,
    };
  }

  public async getShiftAnalytics(range: AnalyticsRange): Promise<ShiftAnalyticsDto> {
    const [shiftsInRange, activeShiftsNow, onBreakShiftsNow] = await Promise.all([
      this.prisma.driverShift.findMany({
        where: { startedAt: { gte: range.from, lte: range.to } },
        select: {
          startedAt: true,
          endedAt: true,
          forceEndedBy: true,
          totalBreakSeconds: true,
          breakReminderSentAt: true,
          fatigueWarningSentAt: true,
          dailyLimitNotifiedAt: true,
        },
      }),
      this.prisma.driverShift.count({ where: { status: DriverShiftStatus.ACTIVE } }),
      this.prisma.driverShift.count({ where: { status: DriverShiftStatus.ON_BREAK } }),
    ]);

    const ended = shiftsInRange.filter(
      (shift): shift is typeof shift & { endedAt: Date } => shift.endedAt !== null,
    );
    const durations = ended.map(
      (shift) => (shift.endedAt.getTime() - shift.startedAt.getTime()) / 1000,
    );
    const breaks = shiftsInRange
      .map((shift) => shift.totalBreakSeconds)
      .filter((seconds) => seconds > 0);

    return {
      range: toRangeDto(range),
      shiftsStarted: shiftsInRange.length,
      shiftsEnded: ended.length,
      activeShiftsNow,
      onBreakShiftsNow,
      forceEndedCount: shiftsInRange.filter((shift) => shift.forceEndedBy !== null).length,
      averageShiftDurationSeconds: average(durations),
      averageBreakSeconds: average(breaks),
      breakReminderCount: shiftsInRange.filter((shift) => shift.breakReminderSentAt !== null)
        .length,
      fatigueWarningCount: shiftsInRange.filter((shift) => shift.fatigueWarningSentAt !== null)
        .length,
      dailyLimitNotifiedCount: shiftsInRange.filter((shift) => shift.dailyLimitNotifiedAt !== null)
        .length,
    };
  }

  /** Cohort by `requestedAt` — every metric below describes what happened
   * to the rides *requested* within the range, including ones that
   * completed or were cancelled after `range.to`. */
  public async getRideOperations(range: AnalyticsRange): Promise<RideOperationsAnalyticsDto> {
    const rides = await this.prisma.ride.findMany({
      where: { requestedAt: { gte: range.from, lte: range.to } },
      select: {
        status: true,
        rideType: true,
        requestedAt: true,
        cancelledBy: true,
        cancellationReason: true,
      },
    });

    const requested = rides.length;
    const completed = rides.filter((ride) => ride.status === RideStatus.COMPLETED).length;
    const cancelled = rides.filter((ride) => ride.status === RideStatus.CANCELLED).length;
    const noDriversFound = rides.filter(
      (ride) => ride.status === RideStatus.NO_DRIVERS_FOUND,
    ).length;

    const byTypeMap = new Map<string, RideTypeBreakdownDto>();
    for (const ride of rides) {
      const row = byTypeMap.get(ride.rideType) ?? {
        rideType: ride.rideType,
        requested: 0,
        completed: 0,
        cancelled: 0,
      };
      row.requested += 1;
      if (ride.status === RideStatus.COMPLETED) row.completed += 1;
      if (ride.status === RideStatus.CANCELLED) row.cancelled += 1;
      byTypeMap.set(ride.rideType, row);
    }

    const demandByDay = new Map<string, number>();
    for (const ride of rides) {
      const key = ride.requestedAt.toISOString().slice(0, 10);
      demandByDay.set(key, (demandByDay.get(key) ?? 0) + 1);
    }
    const demandSeries: DemandSeriesPointDto[] = [...demandByDay.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([bucketStart, count]) => ({ bucketStart, count }));

    const reasonCounts = new Map<string, number>();
    for (const ride of rides) {
      if (ride.status !== RideStatus.CANCELLED || !ride.cancellationReason) continue;
      const reason = ride.cancellationReason.trim();
      if (!reason) continue;
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    }
    const topCancellationReasons: CancellationReasonCountDto[] = [...reasonCounts.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, MAX_CANCELLATION_REASONS)
      .map(([reason, count]) => ({ reason, count }));

    return {
      range: toRangeDto(range),
      requested,
      completed,
      cancelled,
      noDriversFound,
      completionRate: rate(completed, requested),
      cancellationRate: rate(cancelled, requested),
      noDriversFoundRate: rate(noDriversFound, requested),
      cancelledByCustomer: rides.filter((ride) => ride.cancelledBy === RideCancelledBy.CUSTOMER)
        .length,
      cancelledByDriver: rides.filter((ride) => ride.cancelledBy === RideCancelledBy.DRIVER).length,
      // Always 0 today, honestly — RideCancelledBy.SYSTEM has zero real
      // call sites anywhere in the codebase (Slice 3 + Slice 4 reality
      // audits both confirmed this). Not a bug in this query.
      cancelledBySystem: rides.filter((ride) => ride.cancelledBy === RideCancelledBy.SYSTEM).length,
      byRideType: [...byTypeMap.values()],
      demandSeries,
      topCancellationReasons,
    };
  }

  /** Cohort by `offeredAt`. `respondedAt` is set for ACCEPTED, DECLINED,
   * and EXPIRED offers alike (`RideDispatchService` stamps it on every
   * outcome) — time-to-accept only uses it for ACCEPTED offers. */
  public async getDispatchPerformance(
    range: AnalyticsRange,
  ): Promise<DispatchPerformanceAnalyticsDto> {
    const offers = await this.prisma.rideOffer.findMany({
      where: { offeredAt: { gte: range.from, lte: range.to } },
      select: { rideId: true, status: true, offeredAt: true, respondedAt: true },
    });

    const totalOffers = offers.length;
    const accepted = offers.filter((offer) => offer.status === RideOfferStatus.ACCEPTED);
    const declined = offers.filter((offer) => offer.status === RideOfferStatus.DECLINED).length;
    const expired = offers.filter((offer) => offer.status === RideOfferStatus.EXPIRED).length;

    const acceptDurations = accepted
      .map((offer) => secondsBetween(offer.offeredAt, offer.respondedAt))
      .filter((value): value is number => value !== null);

    const offersByRide = new Map<string, number>();
    for (const offer of offers) {
      offersByRide.set(offer.rideId, (offersByRide.get(offer.rideId) ?? 0) + 1);
    }
    const ridesWithOffers = offersByRide.size;
    const ridesNeedingRepeatedOffers = [...offersByRide.values()].filter(
      (count) => count > 1,
    ).length;

    return {
      range: toRangeDto(range),
      totalOffers,
      acceptedOffers: accepted.length,
      declinedOffers: declined,
      expiredOffers: expired,
      acceptanceRate: rate(accepted.length, totalOffers),
      averageTimeToAcceptSeconds: average(acceptDurations),
      ridesWithOffers,
      ridesNeedingRepeatedOffers,
      repeatedOfferRate: rate(ridesNeedingRepeatedOffers, ridesWithOffers),
      averageOffersPerRide: ridesWithOffers > 0 ? totalOffers / ridesWithOffers : null,
    };
  }

  /** Cohort by `OperationsCase.createdAt`, uniformly across SOS/Incident/
   * Support — the same fields Slice 2 built as first-class SLA tracking.
   * `openCasesCount` is a live snapshot (not yet RESOLVED/CLOSED right
   * now), independent of the range, the same way Slice 2's dashboard
   * counters already work. */
  public async getOperationsResponse(
    range: AnalyticsRange,
  ): Promise<OperationsResponseAnalyticsDto> {
    const [cases, openCasesCount] = await Promise.all([
      this.prisma.operationsCase.findMany({
        where: { createdAt: { gte: range.from, lte: range.to } },
        select: {
          caseType: true,
          createdAt: true,
          firstRespondedAt: true,
          resolvedAt: true,
          closedAt: true,
        },
      }),
      this.prisma.operationsCase.count({
        where: {
          status: { notIn: [OperationsLifecycleStatus.RESOLVED, OperationsLifecycleStatus.CLOSED] },
        },
      }),
    ]);

    const byType: OperationsResponseByTypeDto[] = (
      [
        PrismaOperationsCaseType.SOS,
        PrismaOperationsCaseType.INCIDENT,
        PrismaOperationsCaseType.SUPPORT,
      ] as const
    ).map((caseType) => {
      const rows = cases.filter((row) => row.caseType === caseType);
      return {
        caseType,
        totalCases: rows.length,
        ...summarizeResponseTimes(rows),
      };
    });

    return {
      range: toRangeDto(range),
      totalCases: cases.length,
      byType,
      ...summarizeResponseTimes(cases),
      openCasesCount,
    };
  }

  /** Cohort by `requestedAt`. Grid-binned coordinates, not named zones —
   * see the module doc comment. All aggregation happens in application
   * code over a scoped `select` (coordinates only), not a raw SQL grouping
   * query — simplest correct option at current data scale; revisit if a
   * production-scale range ever makes the row count impractical to bin in
   * memory. */
  public async getGeographicDemand(
    range: AnalyticsRange,
    cellSizeDegrees: number = DEFAULT_GEOGRAPHIC_CELL_SIZE_DEGREES,
  ): Promise<GeographicDemandAnalyticsDto> {
    const rides = await this.prisma.ride.findMany({
      where: { requestedAt: { gte: range.from, lte: range.to } },
      select: {
        pickupLatitude: true,
        pickupLongitude: true,
        dropoffLatitude: true,
        dropoffLongitude: true,
      },
    });

    const cells = new Map<string, GeographicDemandCellDto>();
    const cellOrigin = (value: number): number =>
      Math.floor(value / cellSizeDegrees) * cellSizeDegrees;
    const ensureCell = (lat: number, lng: number): GeographicDemandCellDto => {
      const cellLat = cellOrigin(lat);
      const cellLng = cellOrigin(lng);
      const key = `${cellLat.toFixed(6)}:${cellLng.toFixed(6)}`;
      let cell = cells.get(key);
      if (!cell) {
        cell = { latitude: cellLat, longitude: cellLng, pickupCount: 0, dropoffCount: 0 };
        cells.set(key, cell);
      }
      return cell;
    };

    for (const ride of rides) {
      ensureCell(Number(ride.pickupLatitude), Number(ride.pickupLongitude)).pickupCount += 1;
      ensureCell(Number(ride.dropoffLatitude), Number(ride.dropoffLongitude)).dropoffCount += 1;
    }

    const rankedCells = [...cells.values()]
      .sort((a, b) => b.pickupCount + b.dropoffCount - (a.pickupCount + a.dropoffCount))
      .slice(0, MAX_GEOGRAPHIC_CELLS);

    return {
      range: toRangeDto(range),
      cellSizeDegrees,
      cells: rankedCells,
      totalPickups: rides.length,
      totalDropoffs: rides.length,
    };
  }
}
