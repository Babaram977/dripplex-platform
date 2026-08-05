import { randomUUID } from 'node:crypto';

import { PrismaClient, RideStatus, RideType, SosAlertStatus } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { IncidentReportService } from '../drivers/incidents/incident-report.service';
import { SosAlertService } from '../drivers/sos/sos-alert.service';
import { DriverSupportService } from '../drivers/support/driver-support.service';

import { OperationsCasesService } from './operations-cases.service';
import { OperationsDashboardService } from './operations-dashboard.service';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { NotificationCenterService } from '../notification-center/notification-center.service';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

describe('OperationsDashboardService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: OperationsDashboardService;
  let driverId: string;
  let customerId: string;

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
    const notificationCenter = {
      send: jest.fn().mockResolvedValue({ notification: null, skipped: false }),
      broadcast: jest.fn().mockResolvedValue({ notificationIds: [], requested: 0, sent: 0 }),
    } as unknown as NotificationCenterService;

    const casesService = new OperationsCasesService(
      prisma,
      auditService,
      new SosAlertService(prisma, auditService, notificationCenter),
      new IncidentReportService(prisma, auditService, notificationCenter),
      new DriverSupportService(prisma, auditService, notificationCenter),
    );
    service = new OperationsDashboardService(prisma, casesService);

    const driver = await prisma.user.create({
      data: {
        email: `ops-dashboard-driver-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Dash',
        lastName: 'Driver',
      },
    });
    driverId = driver.id;

    const customer = await prisma.user.create({
      data: {
        email: `ops-dashboard-customer-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Dash',
        lastName: 'Customer',
      },
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.sosAlert.deleteMany({ where: { driverId } }).catch(() => undefined);
      await prisma.ride.deleteMany({ where: { driverId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: driverId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: customerId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it('surfaces active SOS count in the queue counters', async () => {
    if (!databaseAvailable) return;

    const alert = await prisma.sosAlert.create({
      data: { driverId, status: SosAlertStatus.OPEN },
    });

    try {
      const counters = await service.getQueueCounters();
      expect(counters.activeSosCount).toBeGreaterThanOrEqual(1);
    } finally {
      await prisma.sosAlert.delete({ where: { id: alert.id } }).catch(() => undefined);
    }
  });

  it('composes a live activity feed from an SOS trigger and a cancelled ride, newest first', async () => {
    if (!databaseAvailable) return;

    const olderAlert = await prisma.sosAlert.create({
      data: { driverId, status: SosAlertStatus.OPEN, createdAt: new Date(Date.now() - 60_000) },
    });
    const ride = await prisma.ride.create({
      data: {
        customerId,
        driverId,
        rideType: RideType.ECONOMY,
        status: RideStatus.CANCELLED,
        pickupLatitude: 6.5,
        pickupLongitude: 3.3,
        dropoffLatitude: 6.6,
        dropoffLongitude: 3.4,
        cancelledAt: new Date(),
      },
    });

    try {
      const feed = await service.getActivityFeed();

      const sosItem = feed.items.find((item) => item.id === `sos:${olderAlert.id}`);
      expect(sosItem?.type).toBe('SOS_TRIGGERED');
      expect(sosItem?.driverId).toBe(driverId);

      const rideItem = feed.items.find((item) => item.id === `ride-cancelled:${ride.id}`);
      expect(rideItem?.type).toBe('RIDE_CANCELLED');
      expect(rideItem?.driverName).toContain('Dash');

      const rideIndex = feed.items.findIndex((item) => item.id === `ride-cancelled:${ride.id}`);
      const sosIndex = feed.items.findIndex((item) => item.id === `sos:${olderAlert.id}`);
      // The ride was cancelled after the SOS alert was created, so it
      // should sort earlier (newest first) in the merged feed.
      expect(rideIndex).toBeLessThan(sosIndex);
    } finally {
      await prisma.sosAlert.delete({ where: { id: olderAlert.id } }).catch(() => undefined);
      await prisma.ride.delete({ where: { id: ride.id } }).catch(() => undefined);
    }
  });
});
