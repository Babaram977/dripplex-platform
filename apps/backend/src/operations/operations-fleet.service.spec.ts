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

import { computeFleetDriverStatus, OperationsFleetService } from './operations-fleet.service';

import type { PrismaService } from '../prisma/prisma.service';

describe('computeFleetDriverStatus', () => {
  const baseline = {
    driverId: 'driver-1',
    driverStatus: DriverStatus.APPROVED,
    hasOpenSos: false,
    online: true,
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

  it('returns OFFLINE when not online, everything else clear', () => {
    expect(computeFleetDriverStatus({ ...baseline, online: false })).toBe('OFFLINE');
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
        online: false,
      }),
    ).toBe('SOS');
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
        .deleteMany({ where: { driverId: availableDriverId } })
        .catch(() => undefined);
      await prisma.vehicle
        .deleteMany({ where: { driverId: availableDriverId } })
        .catch(() => undefined);
      await prisma.inspectionCentre.delete({ where: { id: centreId } }).catch(() => undefined);
      await prisma.driverAvailability
        .deleteMany({ where: { driverId: availableDriverId } })
        .catch(() => undefined);
      await prisma.user.delete({ where: { id: availableDriverId } }).catch(() => undefined);
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
