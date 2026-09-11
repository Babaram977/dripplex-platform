import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  DriverSupportCategory,
  DriverSupportTicketStatus,
  PrismaClient,
  SupportCategory,
  SupportPersona,
  SupportTicketStatus,
} from '@prisma/client';

import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

const MIGRATION_SQL_PATH = join(
  __dirname,
  '..',
  '..',
  'prisma',
  'migrations',
  '20260913060000_universal_support_tickets',
  'migration.sql',
);

/** The backfill statement, read out of the migration itself rather than
 *  restated here. A copy would let the two drift, and the copy is not what runs
 *  against production. */
function backfillStatement(): string {
  const sql = readFileSync(MIGRATION_SQL_PATH, 'utf8');
  const start = sql.indexOf('INSERT INTO "support_tickets"');
  expect(start).toBeGreaterThan(-1);
  const end = sql.indexOf(';', start);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end + 1);
}

/**
 * DPX-SUPPORT-001 — existing driver tickets must survive the move.
 *
 * "Migrated without losing history" is a claim about rows, and the only way to
 * check it is to run the statement that makes the claim. The statement is
 * idempotent (`WHERE NOT EXISTS`), which is what makes re-running it here safe
 * on a database it has already been applied to.
 */
describe('support ticket backfill — 20260913060000', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let driverId: string;
  let resolverId: string;
  const ticketIds: string[] = [];

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

    const driver = await prisma.user.create({
      data: {
        email: `backfill-driver-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Backfill',
        lastName: 'Driver',
      },
    });
    driverId = driver.id;

    const resolver = await prisma.user.create({
      data: {
        email: `backfill-ops-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Backfill',
        lastName: 'Ops',
      },
    });
    resolverId = resolver.id;
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.supportTicket
        .deleteMany({ where: { id: { in: ticketIds } } })
        .catch(() => undefined);
      await prisma.driverSupportTicket.deleteMany({ where: { driverId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: driverId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: resolverId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it('copies every legacy ticket across, mapping the old five categories onto the new ten', async () => {
    if (!databaseAvailable) return;

    const resolvedAt = new Date('2026-09-01T10:00:00.000Z');
    const legacy = await Promise.all(
      (
        [
          [DriverSupportCategory.PAYOUT, DriverSupportTicketStatus.RESOLVED],
          [DriverSupportCategory.ACCOUNT, DriverSupportTicketStatus.OPEN],
          [DriverSupportCategory.APP_BUG, DriverSupportTicketStatus.IN_PROGRESS],
          [DriverSupportCategory.KYC, DriverSupportTicketStatus.CLOSED],
          [DriverSupportCategory.OTHER, DriverSupportTicketStatus.OPEN],
        ] as const
      ).map(
        async ([category, status]) =>
          await prisma.driverSupportTicket.create({
            data: {
              driverId,
              category,
              status,
              subject: `Legacy ${category}`,
              description: `A driver ticket about ${category}.`,
              ...(status === DriverSupportTicketStatus.RESOLVED
                ? { adminResponse: 'Sorted.', resolvedBy: resolverId, resolvedAt }
                : {}),
            },
          }),
      ),
    );
    ticketIds.push(...legacy.map((ticket) => ticket.id));

    await prisma.$executeRawUnsafe(backfillStatement());

    const migrated = await prisma.supportTicket.findMany({
      where: { id: { in: ticketIds } },
      orderBy: { subject: 'asc' },
    });
    expect(migrated).toHaveLength(5);

    const bySubject = new Map(migrated.map((ticket) => [ticket.subject, ticket]));

    // The id is preserved, which is what keeps the operations_cases rows
    // already keyed to these tickets from being orphaned.
    for (const original of legacy) {
      expect(bySubject.get(`Legacy ${original.category}`)?.id).toBe(original.id);
    }

    expect(bySubject.get('Legacy PAYOUT')?.category).toBe(SupportCategory.PAYMENT);
    expect(bySubject.get('Legacy ACCOUNT')?.category).toBe(SupportCategory.ACCOUNT);
    expect(bySubject.get('Legacy APP_BUG')?.category).toBe(SupportCategory.TECHNICAL);
    // KYC is account verification; there is no KYC category in the new ten.
    expect(bySubject.get('Legacy KYC')?.category).toBe(SupportCategory.ACCOUNT);
    expect(bySubject.get('Legacy OTHER')?.category).toBe(SupportCategory.OTHER);

    // A driver's payout question is a money question, so it acquires mandatory
    // human handling — and it is the only legacy category that does.
    expect(bySubject.get('Legacy PAYOUT')?.requiresHumanHandling).toBe(true);
    for (const subject of ['Legacy ACCOUNT', 'Legacy APP_BUG', 'Legacy KYC', 'Legacy OTHER']) {
      expect(bySubject.get(subject)?.requiresHumanHandling).toBe(false);
    }

    for (const ticket of migrated) {
      expect(ticket.persona).toBe(SupportPersona.DRIVER);
      expect(ticket.userId).toBe(driverId);
    }
  });

  it('preserves status, response, resolver and timestamps', async () => {
    if (!databaseAvailable) return;

    const original = await prisma.driverSupportTicket.findFirst({
      where: { driverId, category: DriverSupportCategory.PAYOUT },
    });
    const migrated = await prisma.supportTicket.findUnique({
      where: { id: original?.id ?? randomUUID() },
    });

    expect(migrated?.status).toBe(SupportTicketStatus.RESOLVED);
    expect(migrated?.adminResponse).toBe('Sorted.');
    expect(migrated?.resolvedBy).toBe(resolverId);
    expect(migrated?.resolvedAt?.toISOString()).toBe(original?.resolvedAt?.toISOString());
    expect(migrated?.createdAt.toISOString()).toBe(original?.createdAt.toISOString());

    const open = await prisma.supportTicket.findUnique({
      where: {
        id:
          (
            await prisma.driverSupportTicket.findFirst({
              where: { driverId, category: DriverSupportCategory.KYC },
            })
          )?.id ?? randomUUID(),
      },
    });
    expect(open?.status).toBe(SupportTicketStatus.CLOSED);
  });

  it('is idempotent, so a re-run cannot duplicate a ticket', async () => {
    if (!databaseAvailable) return;

    await prisma.$executeRawUnsafe(backfillStatement());
    const count = await prisma.supportTicket.count({ where: { id: { in: ticketIds } } });
    expect(count).toBe(5);
  });

  it('leaves the legacy table in place, so the move is reversible', async () => {
    if (!databaseAvailable) return;

    // driver_support_tickets is copied, not moved. If anything about the new
    // queue is wrong, every original row is still exactly where it was.
    const remaining = await prisma.driverSupportTicket.count({ where: { driverId } });
    expect(remaining).toBe(5);
  });
});
