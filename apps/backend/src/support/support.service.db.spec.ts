import { randomUUID } from 'node:crypto';

import {
  NotificationType,
  PrismaClient,
  RideType,
  SupportCategory,
  SupportPersona,
  SupportTicketStatus,
} from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import {
  ForbiddenDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';

import { SupportService } from './support.service';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { NotificationCenterService } from '../notification-center/notification-center.service';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

function sessionFor(id: string, portal: string, roles: string[] = []): AuthenticatedUser {
  return {
    id,
    sid: randomUUID(),
    email: `${id}@dripplex.test`,
    role: roles[0] ?? portal,
    portal,
    roles,
    permissions: [],
  };
}

/**
 * DPX-SUPPORT-001 Phase 1 — against a real database, because every guarantee
 * worth testing here is about what is on the row afterwards: who owns it, what
 * the server decided rather than the caller, and whether one persona can reach
 * another's ticket.
 */
describe('SupportService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: SupportService;
  let notificationCenter: jest.Mocked<Pick<NotificationCenterService, 'send'>>;
  let auditLogRepository: jest.Mocked<AuditLogRepository>;

  let customerId: string;
  let driverId: string;
  let merchantUserId: string;
  let adminId: string;
  const createdUserIds: string[] = [];

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

    auditLogRepository = { create: jest.fn().mockResolvedValue(undefined) };
    notificationCenter = {
      send: jest.fn().mockResolvedValue({ notification: null, skipped: false }),
    };
    service = new SupportService(
      prisma,
      new AuditService(auditLogRepository),
      notificationCenter as unknown as NotificationCenterService,
    );

    const make = async (label: string, phone: string | null): Promise<string> => {
      const user = await prisma.user.create({
        data: {
          email: `support-${label}-${randomUUID()}@dripplex.test`,
          passwordHash: 'not-a-real-hash',
          firstName: 'Support',
          lastName: label,
          ...(phone !== null ? { phone } : {}),
        },
      });
      createdUserIds.push(user.id);
      return user.id;
    };

    // `phone` is unique on User, so each fixture needs its own. Derived from a
    // uuid rather than Math.random so a collision cannot make this flaky.
    const phone = (): string => `+234${randomUUID().replace(/\D/g, '').slice(0, 10)}`;
    customerId = await make('customer', phone());
    driverId = await make('driver', phone());
    merchantUserId = await make('merchant', null);
    adminId = await make('admin', null);
  });

  afterEach(async () => {
    if (!databaseAvailable) return;
    notificationCenter.send.mockClear();
    auditLogRepository.create.mockClear();
    await prisma.supportTicket
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(() => undefined);
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.supportTicket
        .deleteMany({ where: { userId: { in: createdUserIds } } })
        .catch(() => undefined);
      for (const id of createdUserIds) {
        await prisma.user.delete({ where: { id } }).catch(() => undefined);
      }
    }
    await prisma.$disconnect();
  });

  // --- what the server decides, not the caller ---------------------------

  it('takes the persona from the session and not from anything the caller sent', async () => {
    if (!databaseAvailable) return;

    const ticket = await service.createTicket(
      // A driver's session. If persona came from the body, a caller could file
      // as anyone and land in a filter no operator is watching.
      sessionFor(driverId, 'driver', ['driver', 'customer']),
      // CreateSupportTicketDto has no persona field at all, so there is nothing
      // here for a caller to state — which is the design, not an omission.
      {
        category: SupportCategory.OTHER,
        subject: 'Question about my account',
        description: 'I cannot see last week’s trips in the app.',
      },
      {},
    );

    expect(ticket.persona).toBe(SupportPersona.DRIVER);
    expect(ticket.userId).toBe(driverId);
  });

  it('files the same human under a different persona depending on the portal', async () => {
    if (!databaseAvailable) return;

    const asDriver = await service.createTicket(
      sessionFor(driverId, 'driver', ['driver', 'customer']),
      {
        category: SupportCategory.RIDE,
        subject: 'Trip not paid',
        description: 'A trip is missing.',
      },
      {},
    );
    const asCustomer = await service.createTicket(
      sessionFor(driverId, 'customer', ['driver', 'customer']),
      {
        category: SupportCategory.FOOD_ORDER,
        subject: 'Order late',
        description: 'My order never came.',
      },
      {},
    );

    expect(asDriver.persona).toBe(SupportPersona.DRIVER);
    expect(asCustomer.persona).toBe(SupportPersona.CUSTOMER);
  });

  it.each([
    [SupportCategory.PAYMENT, true],
    [SupportCategory.WALLET, true],
    [SupportCategory.SAFETY, true],
    [SupportCategory.TECHNICAL, false],
  ])(
    'stores requiresHumanHandling for %s as %s, from the category alone',
    async (category, expected) => {
      if (!databaseAvailable) return;

      const ticket = await service.createTicket(
        sessionFor(customerId, 'customer'),
        { category, subject: 'Needs attention', description: 'Describing the problem at length.' },
        {},
      );

      expect(ticket.requiresHumanHandling).toBe(expected);
      const row = await prisma.supportTicket.findUnique({ where: { id: ticket.id } });
      expect(row?.requiresHumanHandling).toBe(expected);
    },
  );

  it('falls back to the account’s own contact details, and lets the caller override them', async () => {
    if (!databaseAvailable) return;

    const account = await prisma.user.findUniqueOrThrow({
      where: { id: customerId },
      select: { email: true, phone: true },
    });

    const inherited = await service.createTicket(
      sessionFor(customerId, 'customer'),
      {
        category: SupportCategory.ACCOUNT,
        subject: 'Name is wrong',
        description: 'My surname is misspelt.',
      },
      {},
    );
    expect(inherited.contactEmail).toBe(account.email);
    expect(inherited.contactPhone).toBe(account.phone);

    const overridden = await service.createTicket(
      sessionFor(customerId, 'customer'),
      {
        category: SupportCategory.ACCOUNT,
        subject: 'Reach me elsewhere',
        description: 'Please use my work address instead.',
        contactEmail: 'work@example.test',
        contactPhone: '+2349000000001',
      },
      {},
    );
    expect(overridden.contactEmail).toBe('work@example.test');
    expect(overridden.contactPhone).toBe('+2349000000001');
  });

  it('records an audit entry naming the persona, category and human-handling decision', async () => {
    if (!databaseAvailable) return;

    const ticket = await service.createTicket(
      sessionFor(customerId, 'customer'),
      {
        category: SupportCategory.WALLET,
        subject: 'Money missing',
        description: 'My wallet balance dropped.',
      },
      { ipAddress: '10.0.0.1' },
    );

    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'support.ticket.created',
        resource: 'support_ticket',
        resourceId: ticket.id,
        userId: customerId,
        metadata: expect.objectContaining({
          persona: SupportPersona.CUSTOMER,
          category: SupportCategory.WALLET,
          requiresHumanHandling: true,
        }),
      }),
    );
  });

  // --- ownership isolation, across personas ------------------------------

  it('refuses to show one persona another persona’s ticket', async () => {
    if (!databaseAvailable) return;

    const mine = await service.createTicket(
      sessionFor(customerId, 'customer'),
      {
        category: SupportCategory.FOOD_ORDER,
        subject: 'Cold food',
        description: 'The order arrived cold.',
      },
      {},
    );

    // A driver — a different persona and a different person — with the id in
    // hand. The id is a UUID, but "they could not guess it" is not access
    // control.
    await expect(service.getOwnTicket(driverId, mine.id)).rejects.toBeInstanceOf(
      ForbiddenDomainException,
    );
    await expect(service.getOwnTicket(merchantUserId, mine.id)).rejects.toBeInstanceOf(
      ForbiddenDomainException,
    );
  });

  it('lists only your own tickets, never a queue-wide view', async () => {
    if (!databaseAvailable) return;

    await service.createTicket(
      sessionFor(customerId, 'customer'),
      {
        category: SupportCategory.OTHER,
        subject: 'Customer ticket',
        description: 'A customer problem.',
      },
      {},
    );
    await service.createTicket(
      sessionFor(driverId, 'driver'),
      {
        category: SupportCategory.OTHER,
        subject: 'Driver ticket',
        description: 'A driver problem.',
      },
      {},
    );

    const customerTickets = await service.listOwnTickets(customerId);
    expect(customerTickets).toHaveLength(1);
    expect(customerTickets[0]?.subject).toBe('Customer ticket');

    const driverTickets = await service.listOwnTickets(driverId);
    expect(driverTickets).toHaveLength(1);
    expect(driverTickets[0]?.subject).toBe('Driver ticket');
  });

  it('distinguishes a ticket that does not exist from one that is not yours', async () => {
    if (!databaseAvailable) return;
    // Both are refusals, but only one of them is a bug report.
    await expect(service.getOwnTicket(customerId, randomUUID())).rejects.toBeInstanceOf(
      NotFoundDomainException,
    );
  });

  // --- attached context has to be yours ----------------------------------

  it('refuses a ride reference the filer is not a party to', async () => {
    if (!databaseAvailable) return;

    const ride = await prisma.ride.create({
      data: {
        customerId: driverId,
        rideType: RideType.ECONOMY,
        pickupAddress: '1 Test Road',
        pickupLatitude: 6.5,
        pickupLongitude: 3.3,
        dropoffAddress: '2 Test Road',
        dropoffLatitude: 6.6,
        dropoffLongitude: 3.4,
      },
    });

    try {
      // Operations reads an attached ride as context about the person in front
      // of them, so an unowned reference points staff at a stranger's trip.
      await expect(
        service.createTicket(
          sessionFor(customerId, 'customer'),
          {
            category: SupportCategory.RIDE,
            subject: 'About this trip',
            description: 'Asking about a trip that is not mine.',
            rideId: ride.id,
          },
          {},
        ),
      ).rejects.toBeInstanceOf(ForbiddenDomainException);

      // ...and accepts it from the person who took it.
      const ok = await service.createTicket(
        sessionFor(driverId, 'customer'),
        {
          category: SupportCategory.RIDE,
          subject: 'About my trip',
          description: 'Asking about a trip that is mine.',
          rideId: ride.id,
        },
        {},
      );
      expect(ok.rideId).toBe(ride.id);
    } finally {
      await prisma.supportTicket.deleteMany({ where: { rideId: ride.id } }).catch(() => undefined);
      await prisma.ride.delete({ where: { id: ride.id } }).catch(() => undefined);
    }
  });

  it('rejects a reference to something that does not exist at all', async () => {
    if (!databaseAvailable) return;

    await expect(
      service.createTicket(
        sessionFor(customerId, 'customer'),
        {
          category: SupportCategory.RIDE,
          subject: 'Phantom trip',
          description: 'Referring to a ride id that was never real.',
          rideId: randomUUID(),
        },
        {},
      ),
    ).rejects.toBeInstanceOf(ValidationDomainException);
  });

  // --- the Operations side -----------------------------------------------

  it('stamps the resolver and notifies the filer when Operations resolves a ticket', async () => {
    if (!databaseAvailable) return;

    const ticket = await service.createTicket(
      sessionFor(merchantUserId, 'merchant'),
      {
        category: SupportCategory.MERCHANT,
        subject: 'Menu not saving',
        description: 'My menu edits vanish.',
      },
      {},
    );

    const updated = await service.updateTicket(
      ticket.id,
      adminId,
      { status: SupportTicketStatus.RESOLVED, adminResponse: 'Fixed — please try again.' },
      {},
    );

    expect(updated.status).toBe(SupportTicketStatus.RESOLVED);
    expect(updated.resolvedBy).toBe(adminId);
    expect(updated.resolvedAt).not.toBeNull();
    expect(updated.adminResponse).toBe('Fixed — please try again.');

    // A ticket nobody hears back on is worse than no ticket system, because it
    // also spends the trust that made them file it.
    expect(notificationCenter.send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: merchantUserId,
        type: NotificationType.SUPPORT_TICKET_UPDATED,
        body: 'Fixed — please try again.',
      }),
    );
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'support.ticket.resolved', userId: adminId }),
    );
  });

  it('audits a non-resolving change as an update and leaves the resolver unset', async () => {
    if (!databaseAvailable) return;

    const ticket = await service.createTicket(
      sessionFor(customerId, 'customer'),
      {
        category: SupportCategory.TECHNICAL,
        subject: 'App slow',
        description: 'The app takes a minute to open.',
      },
      {},
    );

    const updated = await service.updateTicket(
      ticket.id,
      adminId,
      { status: SupportTicketStatus.IN_PROGRESS },
      {},
    );

    expect(updated.resolvedBy).toBeNull();
    expect(updated.resolvedAt).toBeNull();
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'support.ticket.updated' }),
    );
  });

  it('filters the Operations list by persona, category and status', async () => {
    if (!databaseAvailable) return;

    await service.createTicket(
      sessionFor(driverId, 'driver'),
      {
        category: SupportCategory.PAYMENT,
        subject: 'Payout missing',
        description: 'Last week’s payout never came.',
      },
      {},
    );
    await service.createTicket(
      sessionFor(customerId, 'customer'),
      {
        category: SupportCategory.FOOD_ORDER,
        subject: 'Wrong order',
        description: 'I received someone else’s food.',
      },
      {},
    );

    const byPersona = await service.listTickets({
      page: 1,
      limit: 50,
      persona: SupportPersona.DRIVER,
    });
    expect(byPersona.items.every((item) => item.persona === SupportPersona.DRIVER)).toBe(true);
    expect(byPersona.items.some((item) => item.subject === 'Payout missing')).toBe(true);
    expect(byPersona.items.some((item) => item.subject === 'Wrong order')).toBe(false);

    const byCategory = await service.listTickets({
      page: 1,
      limit: 50,
      category: SupportCategory.FOOD_ORDER,
    });
    expect(byCategory.items.every((item) => item.category === SupportCategory.FOOD_ORDER)).toBe(
      true,
    );

    const byStatus = await service.listTickets({
      page: 1,
      limit: 50,
      status: SupportTicketStatus.RESOLVED,
    });
    expect(byStatus.items.some((item) => item.subject === 'Payout missing')).toBe(false);
  });

  it('refuses to update a ticket that does not exist', async () => {
    if (!databaseAvailable) return;
    await expect(
      service.updateTicket(randomUUID(), adminId, { status: SupportTicketStatus.CLOSED }, {}),
    ).rejects.toBeInstanceOf(NotFoundDomainException);
  });
});
