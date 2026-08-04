import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import {
  ForbiddenDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../../common/exceptions/domain.exception';

import { DriverPlannedAvailabilityService } from './driver-planned-availability.service';

import type { AuditLogRepository } from '../../audit/repositories/audit-log.repository';
import type { PrismaService } from '../../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

describe('DriverPlannedAvailabilityService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: DriverPlannedAvailabilityService;
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
    service = new DriverPlannedAvailabilityService(prisma, auditService);

    const driver = await prisma.user.create({
      data: {
        email: `planned-availability-driver-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Driver',
      },
    });
    driverId = driver.id;
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.driverPlannedAvailability
        .deleteMany({ where: { driverId } })
        .catch(() => undefined);
      await prisma.user.delete({ where: { id: driverId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  afterEach(async () => {
    if (databaseAvailable) {
      await prisma.driverPlannedAvailability
        .deleteMany({ where: { driverId } })
        .catch(() => undefined);
    }
  });

  it('creates an entry', async () => {
    if (!databaseAvailable) return;

    const entry = await service.setEntry(
      driverId,
      { dayOfWeek: 1, startMinute: 480, endMinute: 1020 },
      {},
    );

    expect(entry.driverId).toBe(driverId);
    expect(entry.dayOfWeek).toBe(1);
    expect(entry.startMinute).toBe(480);
    expect(entry.endMinute).toBe(1020);
  });

  it('rejects endMinute at or before startMinute', async () => {
    if (!databaseAvailable) return;

    await expect(
      service.setEntry(driverId, { dayOfWeek: 1, startMinute: 500, endMinute: 500 }, {}),
    ).rejects.toThrow(ValidationDomainException);
  });

  it('lists own entries ordered by day then start time', async () => {
    if (!databaseAvailable) return;

    await service.setEntry(driverId, { dayOfWeek: 2, startMinute: 600, endMinute: 900 }, {});
    await service.setEntry(driverId, { dayOfWeek: 1, startMinute: 480, endMinute: 720 }, {});

    const entries = await service.listOwn(driverId);
    expect(entries.map((e) => e.dayOfWeek)).toEqual([1, 2]);
  });

  it('deletes an owned entry', async () => {
    if (!databaseAvailable) return;

    const entry = await service.setEntry(
      driverId,
      { dayOfWeek: 3, startMinute: 480, endMinute: 720 },
      {},
    );

    await service.deleteOwn(driverId, entry.id, {});

    const entries = await service.listOwn(driverId);
    expect(entries).toHaveLength(0);
  });

  it('rejects deleting an entry that belongs to another driver', async () => {
    if (!databaseAvailable) return;

    const other = await prisma.user.create({
      data: {
        email: `planned-availability-other-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Other',
        lastName: 'Driver',
      },
    });

    const entry = await service.setEntry(
      other.id,
      { dayOfWeek: 4, startMinute: 480, endMinute: 720 },
      {},
    );

    await expect(service.deleteOwn(driverId, entry.id, {})).rejects.toThrow(
      ForbiddenDomainException,
    );

    await prisma.driverPlannedAvailability.delete({ where: { id: entry.id } });
    await prisma.user.delete({ where: { id: other.id } });
  });

  it('throws NotFoundDomainException deleting an unknown entry', async () => {
    if (!databaseAvailable) return;

    await expect(service.deleteOwn(driverId, randomUUID(), {})).rejects.toThrow(
      NotFoundDomainException,
    );
  });

  it('admin can list a specific driver’s planned availability', async () => {
    if (!databaseAvailable) return;

    await service.setEntry(driverId, { dayOfWeek: 5, startMinute: 480, endMinute: 720 }, {});

    const entries = await service.listForDriver(driverId);
    expect(entries.every((e) => e.driverId === driverId)).toBe(true);
  });
});
