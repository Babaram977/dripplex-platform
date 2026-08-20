import { randomUUID } from 'node:crypto';

import {
  DriverStatus,
  InspectionStatus,
  PrismaClient,
  RideStatus,
  RideType,
  SosAlertStatus,
  VehicleApprovalStatus,
} from '@prisma/client';

import { DRIVER_LOCATION_MAX_AGE_MS } from '../rides/ride.constants';

import {
  computeFleetDriverStatus,
  isReachable,
  OperationsFleetService,
} from './operations-fleet.service';

import type { PrismaService } from '../prisma/prisma.service';

describe('computeFleetDriverStatus', () => {
  const baseline = {
    driverId: 'driver-1',
    driverStatus: DriverStatus.APPROVED,
    hasOpenSos: false,
    reachable: true,
    acceptingRides: true,
    activeRideCount: 0,
    hasActiveRide: false,
    shiftStatus: null,
    vehicleApprovalStatus: VehicleApprovalStatus.APPROVED,
    latestDecidedInspectionStatus: InspectionStatus.PASSED,
  } as const;

  it('returns AVAILABLE for an online, accepting, fully-cleared driver', () => {
    expect(computeFleetDriverStatus(baseline)).toBe('AVAILABLE');
  });

  it('returns OFFLINE when not reachable, everything else clear', () => {
    expect(computeFleetDriverStatus({ ...baseline, reachable: false })).toBe('OFFLINE');
  });

  it('returns BUSY when the driver has an active ride, even while online/accepting', () => {
    expect(computeFleetDriverStatus({ ...baseline, hasActiveRide: true })).toBe('BUSY');
  });

  it('returns BUSY from a nonzero activeRideCount even without a matched active-ride row', () => {
    expect(computeFleetDriverStatus({ ...baseline, activeRideCount: 1 })).toBe('BUSY');
  });

  it('returns NEEDS_INSPECTION when there is no approved vehicle on file', () => {
    expect(computeFleetDriverStatus({ ...baseline, vehicleApprovalStatus: null })).toBe(
      'NEEDS_INSPECTION',
    );
  });

  it('returns NEEDS_INSPECTION when the vehicle is still PENDING approval', () => {
    expect(
      computeFleetDriverStatus({
        ...baseline,
        vehicleApprovalStatus: VehicleApprovalStatus.PENDING,
      }),
    ).toBe('NEEDS_INSPECTION');
  });

  it('returns NEEDS_INSPECTION when no inspection has ever been decided', () => {
    expect(computeFleetDriverStatus({ ...baseline, latestDecidedInspectionStatus: null })).toBe(
      'NEEDS_INSPECTION',
    );
  });

  it('returns NEEDS_INSPECTION when the latest decided inspection FAILED', () => {
    expect(
      computeFleetDriverStatus({
        ...baseline,
        latestDecidedInspectionStatus: InspectionStatus.FAILED,
      }),
    ).toBe('NEEDS_INSPECTION');
  });

  it('returns SUSPENDED even when everything else is clear', () => {
    expect(computeFleetDriverStatus({ ...baseline, driverStatus: DriverStatus.SUSPENDED })).toBe(
      'SUSPENDED',
    );
  });

  it('SUSPENDED outranks NEEDS_INSPECTION', () => {
    expect(
      computeFleetDriverStatus({
        ...baseline,
        driverStatus: DriverStatus.SUSPENDED,
        vehicleApprovalStatus: null,
      }),
    ).toBe('SUSPENDED');
  });

  it('returns SOS regardless of every other condition — highest priority', () => {
    expect(
      computeFleetDriverStatus({
        ...baseline,
        hasOpenSos: true,
        driverStatus: DriverStatus.SUSPENDED,
        vehicleApprovalStatus: null,
        reachable: false,
      }),
    ).toBe('SOS');
  });
});

describe('isReachable', () => {
  const now = new Date('2026-08-20T12:00:00.000Z');
  const ago = (ms: number): Date => new Date(now.getTime() - ms);

  it('is true for an online driver who pinged just now', () => {
    expect(isReachable(true, ago(0), now)).toBe(true);
  });

  it('is true right up to the dispatch cut-off', () => {
    expect(isReachable(true, ago(DRIVER_LOCATION_MAX_AGE_MS), now)).toBe(true);
  });

  it('is false one millisecond past the cut-off', () => {
    expect(isReachable(true, ago(DRIVER_LOCATION_MAX_AGE_MS + 1), now)).toBe(false);
  });

  /* The Tunde case: the app still shows "Online" because nothing clears the
     flag when a phone dies. Ops must not read that as a driver ready for work. */
  it('is false for a driver whose flag says online but who went quiet an hour ago', () => {
    expect(isReachable(true, ago(60 * 60_000), now)).toBe(false);
  });

  it('is false when a location has never been reported at all', () => {
    expect(isReachable(true, null, now)).toBe(false);
  });

  it('is false when the driver signed off, however fresh the last ping', () => {
    expect(isReachable(false, ago(0), now)).toBe(false);
  });
});

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

describe('OperationsFleetService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: OperationsFleetService;
  let availableDriverId: string;
  let staleDriverId: string;
  let suspendedDriverId: string;
  let centreId: string;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    }) as unknown as PrismaService;

    try {
      await prisma.$connect();
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
      return;
    }

    service = new OperationsFleetService(prisma);

    const availableDriver = await prisma.user.create({
      data: {
        email: `ops-fleet-available-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Ada',
        lastName: 'Driver',
      },
    });
    availableDriverId = availableDriver.id;
    await prisma.driverProfile.create({
      data: { userId: availableDriverId, status: DriverStatus.APPROVED, isApproved: true },
    });
    await prisma.driverAvailability.create({
      data: {
        driverId: availableDriverId,
        online: true,
        acceptingRides: true,
        vehicleType: RideType.ECONOMY,
        latitude: 6.5244,
        longitude: 3.3792,
        // Dispatch ignores a driver whose position is older than
        // DRIVER_LOCATION_MAX_AGE_MS, so a fixture that omits this is
        // a driver who has not reported in — not an available one.
        locationUpdatedAt: new Date(),
      },
    });
    const vehicle = await prisma.vehicle.create({
      data: {
        driverId: availableDriverId,
        plateNumber: `ofs-${randomUUID().slice(0, 6)}`.toUpperCase(),
        make: 'Toyota',
        model: 'Camry',
        color: 'Blue',
        year: 2020,
        rideCategory: RideType.ECONOMY,
        approvalStatus: VehicleApprovalStatus.APPROVED,
      },
    });
    const centre = await prisma.inspectionCentre.create({
      data: {
        name: `Ops Fleet Test Centre ${randomUUID().slice(0, 6)}`,
        address: '1 Rd',
        city: 'Lagos',
      },
    });
    centreId = centre.id;
    await prisma.inspection.create({
      data: {
        driverId: availableDriverId,
        vehicleId: vehicle.id,
        centreId,
        status: InspectionStatus.PASSED,
        scheduledAt: new Date(Date.now() - 3_600_000),
        completedAt: new Date(),
      },
    });

    // A driver whose app still says "Online" but who stopped reporting an
    // hour ago — force-quit, dead battery, no signal. Nothing clears the
    // flag, so this is the ordinary end state of a driver's day, not an
    // edge case.
    const staleDriver = await prisma.user.create({
      data: {
        email: `ops-fleet-stale-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Gone',
        lastName: 'Quiet',
      },
    });
    staleDriverId = staleDriver.id;
    await prisma.driverProfile.create({
      data: { userId: staleDriverId, status: DriverStatus.APPROVED, isApproved: true },
    });
    await prisma.driverAvailability.create({
      data: {
        driverId: staleDriverId,
        online: true,
        acceptingRides: true,
        vehicleType: RideType.ECONOMY,
        latitude: 6.5244,
        longitude: 3.3792,
        locationUpdatedAt: new Date(Date.now() - 60 * 60_000),
      },
    });
    // Fully cleared to work — approved vehicle, passed inspection — so the
    // ONLY thing standing between this driver and AVAILABLE is the stale
    // ping. Without this the driver falls to NEEDS_INSPECTION, which
    // outranks reachability, and the test would pass for the wrong reason.
    const staleVehicle = await prisma.vehicle.create({
      data: {
        driverId: staleDriverId,
        plateNumber: `ofq-${randomUUID().slice(0, 6)}`.toUpperCase(),
        make: 'Toyota',
        model: 'Corolla',
        color: 'Silver',
        year: 2019,
        rideCategory: RideType.ECONOMY,
        approvalStatus: VehicleApprovalStatus.APPROVED,
      },
    });
    await prisma.inspection.create({
      data: {
        driverId: staleDriverId,
        vehicleId: staleVehicle.id,
        centreId,
        status: InspectionStatus.PASSED,
        scheduledAt: new Date(Date.now() - 3_600_000),
        completedAt: new Date(),
      },
    });

    const suspendedDriver = await prisma.user.create({
      data: {
        email: `ops-fleet-suspended-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Suspended',
        lastName: 'Driver',
      },
    });
    suspendedDriverId = suspendedDriver.id;
    await prisma.driverProfile.create({
      data: { userId: suspendedDriverId, status: DriverStatus.SUSPENDED, isApproved: false },
    });
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.inspection
        .deleteMany({ where: { driverId: { in: [availableDriverId, staleDriverId] } } })
        .catch(() => undefined);
      await prisma.vehicle
        .deleteMany({ where: { driverId: { in: [availableDriverId, staleDriverId] } } })
        .catch(() => undefined);
      await prisma.inspectionCentre.delete({ where: { id: centreId } }).catch(() => undefined);
      await prisma.driverAvailability
        .deleteMany({ where: { driverId: { in: [availableDriverId, staleDriverId] } } })
        .catch(() => undefined);
      await prisma.user.delete({ where: { id: availableDriverId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: staleDriverId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: suspendedDriverId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it('composes a real fleet snapshot from Driver Slice 1/2 tables, read-only', async () => {
    if (!databaseAvailable) return;

    const snapshot = await service.getFleetSnapshot();

    const available = snapshot.drivers.find((d) => d.driverId === availableDriverId);
    expect(available).toBeDefined();
    expect(available?.status).toBe('AVAILABLE');
    expect(available?.online).toBe(true);
    expect(available?.latitude).toBeCloseTo(6.5244);
    expect(available?.longitude).toBeCloseTo(3.3792);

    const suspended = snapshot.drivers.find((d) => d.driverId === suspendedDriverId);
    expect(suspended).toBeDefined();
    expect(suspended?.status).toBe('SUSPENDED');
    expect(suspended?.isSuspended).toBe(true);

    expect(snapshot.summary.totalDrivers).toBeGreaterThanOrEqual(2);
    expect(snapshot.summary.availableCount).toBeGreaterThanOrEqual(1);
    expect(snapshot.summary.suspendedCount).toBeGreaterThanOrEqual(1);
  });

  it('does not count a driver whose app says online but who went quiet as online', async () => {
    if (!databaseAvailable) return;

    const snapshot = await service.getFleetSnapshot();
    const stale = snapshot.drivers.find((d) => d.driverId === staleDriverId);

    expect(stale).toBeDefined();
    // Their own toggle is reported untouched — that discrepancy is the
    // signal, and hiding it would just move the lie somewhere else.
    expect(stale?.online).toBe(true);
    expect(stale?.reachable).toBe(false);
    expect(stale?.lastLocationAt).not.toBeNull();
    // Dispatch would skip them, so the fleet view must not show them ready.
    expect(stale?.status).toBe('OFFLINE');
    expect(snapshot.summary.staleCount).toBeGreaterThanOrEqual(1);
  });

  it('keeps online + stale + offline summing to the fleet size', async () => {
    if (!databaseAvailable) return;

    const { summary } = await service.getFleetSnapshot();

    // The invariant the dashboard depends on: these three tiles are a
    // partition. Previously onlineCount read the raw flag while offlineCount
    // read the computed status, so a driver could land in both or neither
    // and the two tiles could not be reconciled by anyone looking at them.
    expect(summary.onlineCount + summary.staleCount + summary.offlineCount).toBe(
      summary.totalDrivers,
    );
  });

  it('flags an open SOS alert as the highest-priority status, overriding availability', async () => {
    if (!databaseAvailable) return;

    const ride = await prisma.ride.create({
      data: {
        customerId: availableDriverId, // reused only as a distinct existing user id for FK purposes
        driverId: availableDriverId,
        rideType: RideType.ECONOMY,
        status: RideStatus.IN_PROGRESS,
        pickupLatitude: 6.5,
        pickupLongitude: 3.3,
        dropoffLatitude: 6.6,
        dropoffLongitude: 3.4,
      },
    });
    const alert = await prisma.sosAlert.create({
      data: {
        driverId: availableDriverId,
        status: SosAlertStatus.OPEN,
        latitude: 6.5244,
        longitude: 3.3792,
      },
    });

    try {
      const snapshot = await service.getFleetSnapshot();
      const flagged = snapshot.drivers.find((d) => d.driverId === availableDriverId);
      expect(flagged?.status).toBe('SOS');
      expect(flagged?.hasOpenSos).toBe(true);
      expect(snapshot.summary.sosCount).toBeGreaterThanOrEqual(1);
    } finally {
      await prisma.sosAlert.delete({ where: { id: alert.id } }).catch(() => undefined);
      await prisma.ride.delete({ where: { id: ride.id } }).catch(() => undefined);
    }
  });
});
