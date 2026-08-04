import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
} from '../../common/exceptions/domain.exception';

import { DriverShiftService } from './driver-shift.service';

import type { AuditLogRepository } from '../../audit/repositories/audit-log.repository';
import type { PrismaService } from '../../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

describe('DriverShiftService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: DriverShiftService;
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
    service = new DriverShiftService(prisma, auditService);

    const driver = await prisma.user.create({
      data: {
        email: `shift-driver-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Driver',
      },
    });
    driverId = driver.id;

    const admin = await prisma.user.create({
      data: {
        email: `shift-admin-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Ops',
        lastName: 'Admin',
      },
    });
    adminId = admin.id;
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.driverShift.deleteMany({ where: { driverId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: driverId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: adminId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  afterEach(async () => {
    if (databaseAvailable) {
      await prisma.driverShift.deleteMany({ where: { driverId } }).catch(() => undefined);
    }
  });

  it('starts a shift ACTIVE with continuousSince set to startedAt', async () => {
    if (!databaseAvailable) return;

    const shift = await service.startShift(driverId, {});

    expect(shift.status).toBe('ACTIVE');
    expect(shift.endedAt).toBeNull();
    expect(shift.continuousSince).toBe(shift.startedAt);
  });

  it('rejects starting a second shift while one is already open', async () => {
    if (!databaseAvailable) return;

    await service.startShift(driverId, {});

    await expect(service.startShift(driverId, {})).rejects.toThrow(ConflictDomainException);
  });

  it('break lifecycle: start -> end resets continuousSince and accumulates totalBreakSeconds', async () => {
    if (!databaseAvailable) return;

    await service.startShift(driverId, {});
    const onBreak = await service.startBreak(driverId, {});
    expect(onBreak.status).toBe('ON_BREAK');
    expect(onBreak.breakStartedAt).not.toBeNull();

    const resumed = await service.endBreak(driverId, {});
    expect(resumed.status).toBe('ACTIVE');
    expect(resumed.breakStartedAt).toBeNull();
    expect(resumed.totalBreakSeconds).toBeGreaterThanOrEqual(0);
    expect(new Date(resumed.continuousSince).getTime()).toBeGreaterThanOrEqual(
      new Date(onBreak.continuousSince).getTime(),
    );
  });

  it('rejects ending a break that was never started', async () => {
    if (!databaseAvailable) return;

    await service.startShift(driverId, {});
    await expect(service.endBreak(driverId, {})).rejects.toThrow(ConflictDomainException);
  });

  it('ends a shift, folding in any in-progress break time', async () => {
    if (!databaseAvailable) return;

    await service.startShift(driverId, {});
    await service.startBreak(driverId, {});
    const ended = await service.endShift(driverId, {});

    expect(ended.status).toBe('ENDED');
    expect(ended.endedAt).not.toBeNull();
    expect(ended.breakStartedAt).toBeNull();
  });

  it('throws NotFoundDomainException for shift actions with no open shift', async () => {
    if (!databaseAvailable) return;

    await expect(service.endShift(driverId, {})).rejects.toThrow(NotFoundDomainException);
    await expect(service.startBreak(driverId, {})).rejects.toThrow(NotFoundDomainException);
  });

  it("lists only the calling driver's own shifts, most recent first", async () => {
    if (!databaseAvailable) return;

    const first = await service.startShift(driverId, {});
    await service.endShift(driverId, {});
    const second = await service.startShift(driverId, {});

    const shifts = await service.listOwnShifts(driverId);
    expect(shifts.map((s) => s.id)).toEqual([second.id, first.id]);
  });

  it('getSummary reports no active shift and zero minutes when nothing has started', async () => {
    if (!databaseAvailable) return;

    const summary = await service.getSummary(driverId);
    expect(summary.activeShift).toBeNull();
    expect(summary.continuousDrivingMinutes).toBe(0);
    expect(summary.totalMinutesToday).toBe(0);
    expect(summary.breakReminderDue).toBe(false);
    expect(summary.dailyLimitExceeded).toBe(false);
    expect(summary.fatigueWarning).toBe(false);
  });

  it('getSummary reflects an active shift with zero elapsed time as advisory-only, non-blocking flags', async () => {
    if (!databaseAvailable) return;

    const shift = await service.startShift(driverId, {});

    const summary = await service.getSummary(driverId);
    expect(summary.activeShift?.id).toBe(shift.id);
    expect(summary.continuousDrivingMinutes).toBe(0);
    expect(summary.breakReminderDue).toBe(false);
    expect(summary.fatigueWarning).toBe(false);
  });

  it('admin lists shifts filtered by status and driverId', async () => {
    if (!databaseAvailable) return;

    await service.startShift(driverId, {});

    const result = await service.listShifts({ page: 1, limit: 20, status: 'ACTIVE', driverId });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((s) => s.status === 'ACTIVE' && s.driverId === driverId)).toBe(true);
  });

  it('admin force-ends an open shift and records who did it', async () => {
    if (!databaseAvailable) return;

    const shift = await service.startShift(driverId, {});

    const forceEnded = await service.forceEndShift(
      shift.id,
      adminId,
      { adminNotes: 'Driver left the app open overnight.' },
      {},
    );

    expect(forceEnded.status).toBe('ENDED');
    expect(forceEnded.forceEndedBy).toBe(adminId);
    expect(forceEnded.adminNotes).toBe('Driver left the app open overnight.');
  });

  it('rejects force-ending an already-ended shift', async () => {
    if (!databaseAvailable) return;

    const shift = await service.startShift(driverId, {});
    await service.endShift(driverId, {});

    await expect(service.forceEndShift(shift.id, adminId, {}, {})).rejects.toThrow(
      ConflictDomainException,
    );
  });

  it('throws NotFoundDomainException force-ending an unknown shift id', async () => {
    if (!databaseAvailable) return;

    await expect(service.forceEndShift(randomUUID(), adminId, {}, {})).rejects.toThrow(
      NotFoundDomainException,
    );
  });
});
