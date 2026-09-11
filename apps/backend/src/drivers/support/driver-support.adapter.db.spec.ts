import { randomUUID } from 'node:crypto';

import { PrismaClient, SupportCategory, SupportPersona } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import { ForbiddenDomainException } from '../../common/exceptions/domain.exception';
import { SupportService } from '../../support/support.service';

import { toDriverSupportCategory, toSupportCategory } from './driver-support.mapper';
import { DriverSupportService } from './driver-support.service';

import type { AuditLogRepository } from '../../audit/repositories/audit-log.repository';
import type { AuthenticatedUser } from '../../auth/auth.types';
import type { NotificationCenterService } from '../../notification-center/notification-center.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { DriverSupportCategory } from '@prisma/client';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * DPX-SUPPORT-001 — `/driver/support-tickets` after the move.
 *
 * DrippleX is on the Play Store, so driver builds already installed keep
 * calling these routes. The contract they were built against has to keep
 * holding, and — the part that would fail silently — what they file has to land
 * where Operations is now looking.
 */
describe('DriverSupportService — the legacy driver route, adapted', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: DriverSupportService;
  let driverId: string;
  let otherId: string;

  const session = (id: string): AuthenticatedUser => ({
    id,
    sid: randomUUID(),
    email: `${id}@dripplex.test`,
    role: 'driver',
    portal: 'driver',
    roles: ['driver'],
    permissions: [],
  });

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
    const notificationCenter = {
      send: jest.fn().mockResolvedValue({ notification: null, skipped: false }),
    } as unknown as NotificationCenterService;

    service = new DriverSupportService(
      new SupportService(prisma, new AuditService(auditLogRepository), notificationCenter),
    );

    const make = async (label: string): Promise<string> => {
      const user = await prisma.user.create({
        data: {
          email: `legacy-support-${label}-${randomUUID()}@dripplex.test`,
          passwordHash: 'not-a-real-hash',
          firstName: 'Legacy',
          lastName: label,
        },
      });
      return user.id;
    };
    driverId = await make('driver');
    otherId = await make('other');
  });

  afterEach(async () => {
    if (!databaseAvailable) return;
    await prisma.supportTicket
      .deleteMany({ where: { userId: { in: [driverId, otherId] } } })
      .catch(() => undefined);
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.supportTicket
        .deleteMany({ where: { userId: { in: [driverId, otherId] } } })
        .catch(() => undefined);
      await prisma.user.delete({ where: { id: driverId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: otherId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it('files into support_tickets, where Operations is looking, and not into the old table', async () => {
    if (!databaseAvailable) return;

    const before = await prisma.driverSupportTicket.count({ where: { driverId } });

    const ticket = await service.createTicket(
      session(driverId),
      {
        category: 'PAYOUT',
        subject: 'Missing payout',
        description: 'Last week’s payout never came.',
      },
      {},
    );

    // This is the regression the adapter exists to prevent. A write to
    // driver_support_tickets still returns a perfectly valid ticket to the
    // driver's app, and is a ticket no operator will ever see — the failure
    // would be invisible from both ends.
    const row = await prisma.supportTicket.findUnique({ where: { id: ticket.id } });
    expect(row).not.toBeNull();
    expect(row?.persona).toBe(SupportPersona.DRIVER);
    expect(row?.userId).toBe(driverId);
    expect(await prisma.driverSupportTicket.count({ where: { driverId } })).toBe(before);
  });

  it('keeps the response shape deployed driver builds were written against', async () => {
    if (!databaseAvailable) return;

    const ticket = await service.createTicket(
      session(driverId),
      {
        category: 'PAYOUT',
        subject: 'Missing payout',
        description: 'Last week’s payout never came.',
      },
      {},
    );

    expect(ticket.driverId).toBe(driverId);
    expect(ticket.category).toBe('PAYOUT');
    expect(ticket.status).toBe('OPEN');
    expect(ticket.resolvedAt).toBeNull();
    expect(typeof ticket.createdAt).toBe('string');
  });

  it('applies the server-side human-handling rule to a driver’s payout question', async () => {
    if (!databaseAvailable) return;

    const ticket = await service.createTicket(
      session(driverId),
      {
        category: 'PAYOUT',
        subject: 'Payout short',
        description: 'I was paid less than I earned.',
      },
      {},
    );

    // PAYOUT maps to PAYMENT, which is money, which is never automated — the
    // legacy route inherits the rule rather than bypassing it.
    const row = await prisma.supportTicket.findUnique({ where: { id: ticket.id } });
    expect(row?.category).toBe(SupportCategory.PAYMENT);
    expect(row?.requiresHumanHandling).toBe(true);
  });

  it('maps the legacy five categories the same way the backfill mapped history', () => {
    // Pure mapping — no database needed, and it must hold even where one is
    // unavailable, because this is the rule the migration also applied.
    //
    // A driver's ticket must not land in a different category depending on
    // whether they filed it before or after the migration.
    expect(toSupportCategory('PAYOUT')).toBe(SupportCategory.PAYMENT);
    expect(toSupportCategory('ACCOUNT')).toBe(SupportCategory.ACCOUNT);
    expect(toSupportCategory('APP_BUG')).toBe(SupportCategory.TECHNICAL);
    expect(toSupportCategory('KYC')).toBe(SupportCategory.ACCOUNT);
    expect(toSupportCategory('OTHER')).toBe(SupportCategory.OTHER);

    // Every one of the ten maps back to something the old app can render.
    const legacy: DriverSupportCategory[] = ['PAYOUT', 'ACCOUNT', 'APP_BUG', 'KYC', 'OTHER'];
    for (const category of Object.values(SupportCategory)) {
      expect(legacy).toContain(toDriverSupportCategory(category));
    }
  });

  it('lists only the calling driver’s own DRIVER-persona tickets', async () => {
    if (!databaseAvailable) return;

    await service.createTicket(
      session(driverId),
      { category: 'ACCOUNT', subject: 'Driver ticket', description: 'A question about driving.' },
      {},
    );
    // The same human, filing from the customer app. Their customer support
    // history is not what the driver app's list is for.
    await new SupportService(
      prisma,
      new AuditService({ create: jest.fn().mockResolvedValue(undefined) }),
      {
        send: jest.fn().mockResolvedValue({ notification: null, skipped: false }),
      } as unknown as NotificationCenterService,
    ).createTicket(
      { ...session(driverId), portal: 'customer', roles: ['driver', 'customer'] },
      {
        category: SupportCategory.FOOD_ORDER,
        subject: 'Customer ticket',
        description: 'A question about an order.',
      },
      {},
    );

    const tickets = await service.listOwnTickets(driverId);
    expect(tickets).toHaveLength(1);
    expect(tickets[0]?.subject).toBe('Driver ticket');
    expect(tickets.every((ticket) => ticket.driverId === driverId)).toBe(true);
  });

  it('refuses getOwnTicket for a ticket the driver does not own', async () => {
    if (!databaseAvailable) return;

    const theirs = await service.createTicket(
      session(otherId),
      { category: 'ACCOUNT', subject: 'Locked out', description: 'I cannot log in any more.' },
      {},
    );

    await expect(service.getOwnTicket(driverId, theirs.id)).rejects.toBeInstanceOf(
      ForbiddenDomainException,
    );
  });
});
