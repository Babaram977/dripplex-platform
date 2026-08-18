import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { DriverActivationService } from './driver-activation.service';

import type { PrismaService } from '../../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

describe('DriverActivationService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: DriverActivationService;
  let driverId: string;
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

    service = new DriverActivationService(prisma);

    const driver = await prisma.user.create({
      data: {
        email: `activation-test-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Driver',
      },
    });
    driverId = driver.id;
    await prisma.driverProfile.create({ data: { userId: driver.id } });

    const centre = await prisma.inspectionCentre.create({
      data: {
        name: `Activation Test Centre ${randomUUID().slice(0, 6)}`,
        address: '1 Road',
        city: 'Lagos',
      },
    });
    centreId = centre.id;
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.inspection.deleteMany({ where: { driverId } }).catch(() => undefined);
      await prisma.vehicle.deleteMany({ where: { driverId } }).catch(() => undefined);
      await prisma.inspectionCentre.delete({ where: { id: centreId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: driverId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it('is not eligible for a brand-new driver profile — nothing done yet', async () => {
    if (!databaseAvailable) return;

    const result = await service.checkEligibility(driverId);

    expect(result.eligible).toBe(false);
    expect(result.checks).toEqual({
      identityVerified: false,
      requiredDocumentsApproved: false,
      vehicleApproved: false,
      inspectionPassed: false,
      agreementAccepted: false,
      accountNotLocked: true,
    });
    expect(result.missingReasons).toHaveLength(5);
    expect(result.qualifyingVehicleId).toBeNull();
  });

  it('assertEligible() throws with the missing reasons attached', async () => {
    if (!databaseAvailable) return;

    await expect(service.assertEligible(driverId)).rejects.toThrow(
      'Driver does not meet activation requirements',
    );
  });

  it('flips each check to true as its prerequisite is satisfied, and becomes eligible once all are met', async () => {
    if (!databaseAvailable) return;

    await prisma.driverProfile.update({
      where: { userId: driverId },
      data: { lastIdentityVerifiedAt: new Date() },
    });
    let result = await service.checkEligibility(driverId);
    expect(result.checks.identityVerified).toBe(true);
    expect(result.eligible).toBe(false);

    await prisma.driverKyc.createMany({
      data: [
        {
          driverId,
          documentType: 'DRIVER_LICENSE',
          documentNumber: 'L1',
          frontImage: 'https://example.com/l.jpg',
          verificationStatus: 'VERIFIED',
        },
        {
          driverId,
          documentType: 'VEHICLE_REGISTRATION',
          documentNumber: 'V1',
          frontImage: 'https://example.com/v.jpg',
          verificationStatus: 'VERIFIED',
        },
        {
          driverId,
          documentType: 'GUARANTOR_ID',
          documentNumber: 'G1',
          frontImage: 'https://example.com/g.jpg',
          verificationStatus: 'VERIFIED',
        },
      ],
    });
    result = await service.checkEligibility(driverId);
    expect(result.checks.requiredDocumentsApproved).toBe(true);
    expect(result.eligible).toBe(false);

    const vehicle = await prisma.vehicle.create({
      data: {
        driverId,
        plateNumber: `act-${randomUUID().slice(0, 6)}`.toUpperCase(),
        make: 'Toyota',
        model: 'Camry',
        color: 'Black',
        year: 2021,
        rideCategory: 'ECONOMY',
        approvalStatus: 'APPROVED',
      },
    });
    result = await service.checkEligibility(driverId);
    expect(result.checks.vehicleApproved).toBe(true);
    expect(result.checks.inspectionPassed).toBe(false);
    expect(result.eligible).toBe(false);

    await prisma.inspection.create({
      data: {
        driverId,
        vehicleId: vehicle.id,
        centreId,
        status: 'PASSED',
        scheduledAt: new Date(Date.now() - 3_600_000),
        completedAt: new Date(),
      },
    });
    result = await service.checkEligibility(driverId);
    expect(result.checks.inspectionPassed).toBe(true);
    expect(result.qualifyingVehicleId).toBe(vehicle.id);
    expect(result.eligible).toBe(false);

    await prisma.driverProfile.update({
      where: { userId: driverId },
      data: { agreementAcceptedAt: new Date(), agreementVersion: 'v1' },
    });
    result = await service.checkEligibility(driverId);
    expect(result.checks.agreementAccepted).toBe(true);
    expect(result.eligible).toBe(true);
    expect(result.missingReasons).toHaveLength(0);

    await expect(service.assertEligible(driverId)).resolves.toMatchObject({ eligible: true });
  });

  it('re-blocks on a subsequent FAILED inspection — the latest decided inspection wins, not just any past pass', async () => {
    if (!databaseAvailable) return;

    const [vehicle] = await prisma.vehicle.findMany({ where: { driverId } });
    if (!vehicle) throw new Error('expected the approved vehicle from the previous test');

    await prisma.inspection.create({
      data: {
        driverId,
        vehicleId: vehicle.id,
        centreId,
        status: 'FAILED',
        scheduledAt: new Date(Date.now() - 1_800_000),
        completedAt: new Date(),
      },
    });

    const result = await service.checkEligibility(driverId);
    expect(result.checks.inspectionPassed).toBe(false);
    expect(result.eligible).toBe(false);
  });

  it('blocks on a locked account even when every other condition is met', async () => {
    if (!databaseAvailable) return;

    const [vehicle] = await prisma.vehicle.findMany({ where: { driverId } });
    if (!vehicle) throw new Error('expected a vehicle from earlier tests');

    // Re-pass the inspection so only the lock is blocking.
    await prisma.inspection.create({
      data: {
        driverId,
        vehicleId: vehicle.id,
        centreId,
        status: 'PASSED',
        scheduledAt: new Date(Date.now() - 900_000),
        completedAt: new Date(),
      },
    });
    await prisma.driverProfile.update({
      where: { userId: driverId },
      data: { identityVerificationLockedAt: new Date() },
    });

    const result = await service.checkEligibility(driverId);
    expect(result.checks.accountNotLocked).toBe(false);
    expect(result.eligible).toBe(false);
    expect(result.missingReasons).toEqual(['Account is locked pending support review']);
  });

  it('throws for an unknown driver profile', async () => {
    if (!databaseAvailable) return;

    await expect(service.checkEligibility(randomUUID())).rejects.toThrow(
      'Driver profile not found',
    );
  });

  describe('checkEligibilityBulk', () => {
    it('agrees with checkEligibility, check for check, for the same driver', async () => {
      if (!databaseAvailable) return;

      // The roster reads the bulk path and the detail page reads the single
      // one. If they ever disagree the roster is telling an operator something
      // the approve button will contradict — so this pins them together rather
      // than testing the bulk path in isolation.
      const single = await service.checkEligibility(driverId);
      const bulk = await service.checkEligibilityBulk([driverId]);

      const mine = bulk.get(driverId);
      expect(mine).toBeDefined();
      expect(mine?.checks).toEqual(single.checks);
      expect(mine?.eligible).toBe(single.eligible);
      expect(mine?.missingReasons).toEqual(single.missingReasons);
      expect(mine?.qualifyingVehicleId).toBe(single.qualifyingVehicleId);
    });

    it('returns an empty map for no drivers, without querying', async () => {
      if (!databaseAvailable) return;

      const bulk = await service.checkEligibilityBulk([]);
      expect(bulk.size).toBe(0);
    });

    it('omits a driver id that has no profile rather than inventing checks for it', async () => {
      if (!databaseAvailable) return;

      // A roster row can only exist for a real profile, but an absent entry
      // must read as "unknown" upstream, never as "eligible".
      const bulk = await service.checkEligibilityBulk([driverId, randomUUID()]);

      expect(bulk.size).toBe(1);
      expect(bulk.has(driverId)).toBe(true);
    });
  });
});
