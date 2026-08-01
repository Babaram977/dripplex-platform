import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import { RideProblemReportService } from './ride-problem-report.service';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { PrismaService } from '../prisma/prisma.service';
import type { Ride } from '@prisma/client';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

describe('RideProblemReportService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: RideProblemReportService;
  let customerId: string;
  const createdUserIds: string[] = [];
  const createdRideIds: string[] = [];

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
    service = new RideProblemReportService(prisma, auditService);

    const customer = await prisma.user.create({
      data: {
        email: `ride-report-customer-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Customer',
      },
    });
    customerId = customer.id;
    createdUserIds.push(customerId);
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.rideProblemReport.deleteMany({ where: { rideId: { in: createdRideIds } } });
      await prisma.ride.deleteMany({ where: { id: { in: createdRideIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  async function createRide(): Promise<Ride> {
    const ride = await prisma.ride.create({
      data: {
        customerId,
        rideType: 'ECONOMY',
        status: 'IN_PROGRESS',
        pickupLatitude: 6.6,
        pickupLongitude: 3.35,
        dropoffLatitude: 6.62,
        dropoffLongitude: 3.37,
        totalFare: 1000,
      },
    });
    createdRideIds.push(ride.id);
    return ride;
  }

  it('lets a passenger report a problem on their own ride', async () => {
    if (!databaseAvailable) return;

    const ride = await createRide();
    const report = await service.reportProblem(
      customerId,
      ride.id,
      { category: 'UNSAFE_DRIVING', description: 'Driver was speeding' },
      {},
    );

    expect(report.rideId).toBe(ride.id);
    expect(report.reporterId).toBe(customerId);
    expect(report.category).toBe('UNSAFE_DRIVING');
    expect(report.status).toBe('OPEN');
  });

  it('rejects reporting a problem on a ride not owned by the caller', async () => {
    if (!databaseAvailable) return;

    const ride = await createRide();

    await expect(
      service.reportProblem(randomUUID(), ride.id, { category: 'WRONG_FARE' }, {}),
    ).rejects.toThrow('Ride not found');
  });

  it('lists reports filtered by status and resolves an open one', async () => {
    if (!databaseAvailable) return;

    const ride = await createRide();
    const report = await service.reportProblem(customerId, ride.id, { category: 'LOST_ITEM' }, {});

    const openReports = await service.listReports('OPEN');
    expect(openReports.some((entry) => entry.id === report.id)).toBe(true);

    const resolved = await service.resolveReport(report.id, randomUUID(), {});
    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.resolvedAt).not.toBeNull();

    const resolvedReports = await service.listReports('RESOLVED');
    expect(resolvedReports.some((entry) => entry.id === report.id)).toBe(true);
  });

  it('rejects resolving a report that is already resolved', async () => {
    if (!databaseAvailable) return;

    const ride = await createRide();
    const report = await service.reportProblem(
      customerId,
      ride.id,
      { category: 'VEHICLE_ISSUE' },
      {},
    );
    await service.resolveReport(report.id, randomUUID(), {});

    await expect(service.resolveReport(report.id, randomUUID(), {})).rejects.toThrow(
      'Problem report is already resolved',
    );
  });

  it('rejects resolving a report that does not exist', async () => {
    if (!databaseAvailable) return;

    await expect(service.resolveReport(randomUUID(), randomUUID(), {})).rejects.toThrow(
      'Problem report not found',
    );
  });
});
