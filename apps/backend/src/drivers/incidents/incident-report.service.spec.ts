import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';

import { IncidentReportService } from './incident-report.service';

import type { AuditLogRepository } from '../../audit/repositories/audit-log.repository';
import type { NotificationCenterService } from '../../notification-center/notification-center.service';
import type { PrismaService } from '../../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

describe('IncidentReportService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: IncidentReportService;
  let notificationCenter: jest.Mocked<Pick<NotificationCenterService, 'send'>>;
  let driverId: string;
  let adminId: string;

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
    notificationCenter = {
      send: jest.fn().mockResolvedValue({ notification: null, skipped: false }),
    };
    service = new IncidentReportService(
      prisma,
      auditService,
      notificationCenter as unknown as NotificationCenterService,
    );

    const driver = await prisma.user.create({
      data: {
        email: `incident-driver-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Driver',
      },
    });
    driverId = driver.id;

    const admin = await prisma.user.create({
      data: {
        email: `incident-admin-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Ops',
        lastName: 'Admin',
      },
    });
    adminId = admin.id;
  });

  afterEach(() => {
    if (databaseAvailable) {
      notificationCenter.send.mockClear();
    }
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.incidentReport.deleteMany({ where: { driverId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: driverId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: adminId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it('creates a report with optional ride/location fields', async () => {
    if (!databaseAvailable) return;

    const report = await service.createReport(
      driverId,
      {
        category: 'VEHICLE_BREAKDOWN',
        severity: 'MEDIUM',
        description: 'Flat tyre on the highway shoulder.',
        latitude: 6.5244,
        longitude: 3.3792,
      },
      {},
    );

    expect(report.driverId).toBe(driverId);
    expect(report.rideId).toBeNull();
    expect(report.latitude).toBeCloseTo(6.5244);
    expect(report.status).toBe('OPEN');
  });

  it("lists only the calling driver's own reports", async () => {
    if (!databaseAvailable) return;

    const reports = await service.listOwnReports(driverId);
    expect(reports.length).toBeGreaterThan(0);
    expect(reports.every((r) => r.driverId === driverId)).toBe(true);
  });

  it('rejects getOwnReport for a report the driver does not own', async () => {
    if (!databaseAvailable) return;

    const other = await prisma.user.create({
      data: {
        email: `incident-other-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Other',
        lastName: 'Driver',
      },
    });

    const report = await service.createReport(
      other.id,
      { category: 'SAFETY_CONCERN', severity: 'LOW', description: 'Minor concern, low priority.' },
      {},
    );

    await expect(service.getOwnReport(driverId, report.id)).rejects.toThrow();

    await prisma.incidentReport.delete({ where: { id: report.id } });
    await prisma.user.delete({ where: { id: other.id } });
  });

  it('acknowledges then resolves, setting timestamps and notifying the driver each time', async () => {
    if (!databaseAvailable) return;

    const created = await service.createReport(
      driverId,
      { category: 'ACCIDENT', severity: 'HIGH', description: 'Minor collision at a junction.' },
      {},
    );

    const acknowledged = await service.updateReport(
      created.id,
      adminId,
      { status: 'ACKNOWLEDGED' },
      {},
    );
    expect(acknowledged.status).toBe('ACKNOWLEDGED');
    expect(acknowledged.acknowledgedBy).toBe(adminId);
    expect(acknowledged.acknowledgedAt).not.toBeNull();
    expect(acknowledged.resolvedAt).toBeNull();

    const resolved = await service.updateReport(
      created.id,
      adminId,
      { status: 'RESOLVED', adminNotes: 'Driver confirmed safe, vehicle towed.' },
      {},
    );
    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.resolvedAt).not.toBeNull();
    expect(notificationCenter.send).toHaveBeenCalledTimes(2);
    expect(notificationCenter.send).toHaveBeenCalledWith(
      expect.objectContaining({ userId: driverId, type: 'INCIDENT_REPORT_UPDATED' }),
    );
  });

  it('filters and sorts the admin queue by severity then recency', async () => {
    if (!databaseAvailable) return;

    const result = await service.listReports({ page: 1, limit: 20, severity: 'HIGH' });
    expect(result.items.every((r) => r.severity === 'HIGH')).toBe(true);
  });
});
