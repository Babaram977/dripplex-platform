import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';

import { DriverSupportService } from './driver-support.service';

import type { AuditLogRepository } from '../../audit/repositories/audit-log.repository';
import type { NotificationCenterService } from '../../notification-center/notification-center.service';
import type { PrismaService } from '../../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

describe('DriverSupportService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: DriverSupportService;
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
    service = new DriverSupportService(
      prisma,
      auditService,
      notificationCenter as unknown as NotificationCenterService,
    );

    const driver = await prisma.user.create({
      data: {
        email: `support-driver-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Driver',
      },
    });
    driverId = driver.id;

    const admin = await prisma.user.create({
      data: {
        email: `support-admin-${randomUUID()}@dripplex.test`,
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
      await prisma.driverSupportTicket.deleteMany({ where: { driverId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: driverId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: adminId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it('creates a ticket owned by the driver', async () => {
    if (!databaseAvailable) return;

    const ticket = await service.createTicket(
      driverId,
      {
        category: 'PAYOUT',
        subject: 'Missing payout',
        description: 'My payout from last week never arrived.',
      },
      {},
    );

    expect(ticket.driverId).toBe(driverId);
    expect(ticket.category).toBe('PAYOUT');
    expect(ticket.status).toBe('OPEN');
    expect(ticket.resolvedAt).toBeNull();
  });

  it("lists only the calling driver's own tickets", async () => {
    if (!databaseAvailable) return;

    const tickets = await service.listOwnTickets(driverId);
    expect(tickets.length).toBeGreaterThan(0);
    expect(tickets.every((t) => t.driverId === driverId)).toBe(true);
  });

  it('rejects getOwnTicket for a ticket the driver does not own', async () => {
    if (!databaseAvailable) return;

    const other = await prisma.user.create({
      data: {
        email: `support-other-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Other',
        lastName: 'Driver',
      },
    });

    const ticket = await service.createTicket(
      other.id,
      {
        category: 'ACCOUNT',
        subject: 'Locked out',
        description: 'Cannot log in to my account anymore.',
      },
      {},
    );

    await expect(service.getOwnTicket(driverId, ticket.id)).rejects.toThrow();

    await prisma.driverSupportTicket.delete({ where: { id: ticket.id } });
    await prisma.user.delete({ where: { id: other.id } });
  });

  it('updates a ticket, sets resolvedBy/resolvedAt on resolution, and notifies the driver', async () => {
    if (!databaseAvailable) return;

    const created = await service.createTicket(
      driverId,
      {
        category: 'APP_BUG',
        subject: 'Crash on trip end',
        description: 'The app crashes when I end a trip.',
      },
      {},
    );

    const updated = await service.updateTicket(
      created.id,
      adminId,
      { status: 'RESOLVED', adminResponse: 'Fixed in the latest app update.' },
      {},
    );

    expect(updated.status).toBe('RESOLVED');
    expect(updated.resolvedBy).toBe(adminId);
    expect(updated.resolvedAt).not.toBeNull();
    expect(updated.adminResponse).toBe('Fixed in the latest app update.');
    expect(notificationCenter.send).toHaveBeenCalledWith(
      expect.objectContaining({ userId: driverId, type: 'DRIVER_SUPPORT_TICKET_UPDATED' }),
    );
  });

  it('filters the admin queue by status', async () => {
    if (!databaseAvailable) return;

    const result = await service.listTickets({ page: 1, limit: 20, status: 'OPEN' });
    expect(result.items.every((t) => t.status === 'OPEN')).toBe(true);
  });
});
