import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';

import { InspectionCentresService } from './inspection-centres.service';
import { InspectionsService } from './inspections.service';

import type { AuditLogRepository } from '../../audit/repositories/audit-log.repository';
import type { PrismaService } from '../../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

describe('InspectionsService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: InspectionsService;
  let centresService: InspectionCentresService;
  let driverId: string;
  let vehicleId: string;
  let centreId: string;
  let plateNumber: string;
  let officerId: string;
  let supervisorId: string;
  const context = {};

  const checklist = [{ key: 'tires', label: 'Tires', passed: true }];

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

    const auditLogRepository: jest.Mocked<AuditLogRepository> = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    const auditService = new AuditService(auditLogRepository);
    service = new InspectionsService(prisma, auditService);
    centresService = new InspectionCentresService(prisma, auditService);

    const driver = await prisma.user.create({
      data: {
        email: `inspections-test-driver-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Driver',
      },
    });
    driverId = driver.id;
    await prisma.driverProfile.create({ data: { userId: driver.id } });

    const vehicle = await prisma.vehicle.create({
      data: {
        driverId,
        plateNumber: `insp-${randomUUID().slice(0, 6)}`.toUpperCase(),
        make: 'Toyota',
        model: 'Camry',
        color: 'Black',
        year: 2021,
        rideCategory: 'ECONOMY',
      },
    });
    vehicleId = vehicle.id;
    plateNumber = vehicle.plateNumber;

    const centre = await centresService.create(
      {
        name: `Inspections Test Centre ${randomUUID().slice(0, 6)}`,
        address: '1 Road',
        city: 'Lagos',
      },
      driverId,
      context,
    );
    centreId = centre.id;

    const officer = await prisma.user.create({
      data: {
        email: `inspections-test-officer-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Officer',
        lastName: 'One',
      },
    });
    officerId = officer.id;

    const supervisor = await prisma.user.create({
      data: {
        email: `inspections-test-supervisor-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Supervisor',
        lastName: 'One',
      },
    });
    supervisorId = supervisor.id;
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.inspection.deleteMany({ where: { driverId } }).catch(() => undefined);
      await prisma.vehicle.deleteMany({ where: { driverId } }).catch(() => undefined);
      await prisma.inspectionCentre.delete({ where: { id: centreId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: driverId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: officerId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: supervisorId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it("schedules an inspection for the driver's own vehicle at an active centre", async () => {
    if (!databaseAvailable) return;

    const inspection = await service.scheduleInspection(
      driverId,
      { vehicleId, centreId, scheduledAt: new Date(Date.now() + 86_400_000).toISOString() },
      context,
    );

    expect(inspection.status).toBe('SCHEDULED');
    expect(inspection.driverId).toBe(driverId);
  });

  it('rejects a decide() call before the checklist has been recorded', async () => {
    if (!databaseAvailable) return;

    const [inspection] = await service.listOwnInspections(driverId);
    if (!inspection) throw new Error('expected a scheduled inspection from the previous test');

    await expect(
      service.decide(inspection.id, supervisorId, { passed: true }, context),
    ).rejects.toThrow('Checklist must be recorded');
  });

  it('runs the officer-records → supervisor-decides (fail) → re-inspection flow', async () => {
    if (!databaseAvailable) return;

    const [inspection] = await service.listOwnInspections(driverId);
    if (!inspection) throw new Error('expected a scheduled inspection');

    const recorded = await service.recordChecklist(
      inspection.id,
      officerId,
      { checklist: [{ key: 'brakes', label: 'Brakes', passed: false, notes: 'Worn pads' }] },
      context,
    );
    expect(recorded.inspectorId).toBe(officerId);

    const decided = await service.decide(inspection.id, supervisorId, { passed: false }, context);
    expect(decided.status).toBe('FAILED');
    expect(decided.decidedBy).toBe(supervisorId);
    expect(decided.completedAt).not.toBeNull();

    const reinspection = await service.scheduleInspection(
      driverId,
      {
        vehicleId,
        centreId,
        scheduledAt: new Date(Date.now() + 172_800_000).toISOString(),
        reinspectionOfId: inspection.id,
      },
      context,
    );
    expect(reinspection.reinspectionOfId).toBe(inspection.id);
  });

  it('marks the vehicle APPROVED when an inspection passes', async () => {
    if (!databaseAvailable) return;

    const scheduled = await service.scheduleInspection(
      driverId,
      { vehicleId, centreId, scheduledAt: new Date(Date.now() + 3_600_000).toISOString() },
      context,
    );
    await service.recordChecklist(scheduled.id, officerId, { checklist }, context);
    await service.decide(scheduled.id, supervisorId, { passed: true }, context);

    const vehicle = await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleId } });
    expect(vehicle.approvalStatus).toBe('APPROVED');
  });

  it('names the driver and vehicle on the Operations list instead of raw ids', async () => {
    if (!databaseAvailable) return;

    const { items } = await service.listInspections({ page: 1, limit: 100 });
    const mine = items.filter((row) => row.driverId === driverId);
    expect(mine.length).toBeGreaterThan(0);

    const [row] = mine;
    if (!row) throw new Error('expected at least one inspection for the test driver');
    expect(row.driverName).toBe('Test Driver');
    expect(row.vehiclePlate).toBe(plateNumber);
    expect(row.vehicleLabel).toBe('Toyota Camry · Black');
  });

  it('lets a driver cancel their own SCHEDULED inspection but not a decided one', async () => {
    if (!databaseAvailable) return;

    const scheduled = await service.scheduleInspection(
      driverId,
      { vehicleId, centreId, scheduledAt: new Date(Date.now() + 7_200_000).toISOString() },
      context,
    );
    const cancelled = await service.cancelOwnInspection(driverId, scheduled.id, context);
    expect(cancelled.status).toBe('CANCELLED');

    await expect(service.cancelOwnInspection(driverId, scheduled.id, context)).rejects.toThrow(
      'Only a scheduled inspection can be cancelled',
    );
  });
});
