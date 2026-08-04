import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';

import { DriverShiftReminderSweepService } from './driver-shift-reminder-sweep.service';
import { DriverShiftService } from './driver-shift.service';

import type { AuditLogRepository } from '../../audit/repositories/audit-log.repository';
import type { NotificationCenterService } from '../../notification-center/notification-center.service';
import type { PrismaService } from '../../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

describe('DriverShiftReminderSweepService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let shiftService: DriverShiftService;
  let sweepService: DriverShiftReminderSweepService;
  let notificationCenter: jest.Mocked<Pick<NotificationCenterService, 'send'>>;
  let driverId: string;

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
    shiftService = new DriverShiftService(prisma, auditService);
    notificationCenter = {
      send: jest.fn().mockResolvedValue({ notification: null, skipped: false }),
    };
    sweepService = new DriverShiftReminderSweepService(
      prisma,
      shiftService,
      notificationCenter as unknown as NotificationCenterService,
    );

    const driver = await prisma.user.create({
      data: {
        email: `shift-sweep-driver-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Driver',
      },
    });
    driverId = driver.id;
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.driverShift.deleteMany({ where: { driverId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: driverId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  afterEach(async () => {
    if (databaseAvailable) {
      notificationCenter.send.mockClear();
      await prisma.driverShift.deleteMany({ where: { driverId } }).catch(() => undefined);
    }
  });

  it('does nothing for a freshly-started shift (no threshold crossed)', async () => {
    if (!databaseAvailable) return;

    await shiftService.startShift(driverId, {});

    const notified = await sweepService.runSweep();

    expect(notified).toBe(0);
    expect(notificationCenter.send).not.toHaveBeenCalled();
  });

  it('sends a break reminder once continuous driving crosses the threshold, and only once', async () => {
    if (!databaseAvailable) return;

    const shift = await shiftService.startShift(driverId, {});
    await prisma.driverShift.update({
      where: { id: shift.id },
      data: { continuousSince: new Date(Date.now() - 241 * 60 * 1000) },
    });

    const firstSweep = await sweepService.runSweep();
    expect(firstSweep).toBe(1);
    expect(notificationCenter.send).toHaveBeenCalledWith(
      expect.objectContaining({ userId: driverId, type: 'SHIFT_BREAK_REMINDER' }),
    );

    notificationCenter.send.mockClear();
    const secondSweep = await sweepService.runSweep();
    expect(secondSweep).toBe(0);
    expect(notificationCenter.send).not.toHaveBeenCalled();
  });

  it('sends a fatigue warning once continuous driving crosses the higher threshold', async () => {
    if (!databaseAvailable) return;

    const shift = await shiftService.startShift(driverId, {});
    await prisma.driverShift.update({
      where: { id: shift.id },
      data: { continuousSince: new Date(Date.now() - 301 * 60 * 1000) },
    });

    const notified = await sweepService.runSweep();

    expect(notified).toBe(2); // both break reminder and fatigue warning cross at once
    expect(notificationCenter.send).toHaveBeenCalledWith(
      expect.objectContaining({ userId: driverId, type: 'SHIFT_FATIGUE_WARNING' }),
    );
  });

  it('re-arms the break reminder after a break resets continuousSince', async () => {
    if (!databaseAvailable) return;

    const shift = await shiftService.startShift(driverId, {});
    await prisma.driverShift.update({
      where: { id: shift.id },
      data: { continuousSince: new Date(Date.now() - 241 * 60 * 1000) },
    });
    await sweepService.runSweep();
    notificationCenter.send.mockClear();

    await shiftService.startBreak(driverId, {});
    await shiftService.endBreak(driverId, {});

    await prisma.driverShift.update({
      where: { id: shift.id },
      data: { continuousSince: new Date(Date.now() - 241 * 60 * 1000) },
    });

    const notified = await sweepService.runSweep();
    expect(notified).toBe(1);
    expect(notificationCenter.send).toHaveBeenCalledWith(
      expect.objectContaining({ userId: driverId, type: 'SHIFT_BREAK_REMINDER' }),
    );
  });
});
