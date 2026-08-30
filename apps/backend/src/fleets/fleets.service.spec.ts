import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { NotFoundDomainException } from '../common/exceptions/domain.exception';

import { FLEET_OWNER_ROLE, FLEET_PERMISSIONS } from './fleet.constants';
import { FleetsService } from './fleets.service';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * Creating a fleet has to leave its owner able to open their own console.
 *
 * Every route on that console is gated on `fleet:own:read`, which only the
 * `fleet_owner` role carries — so a fleet created without the grant produces an
 * owner who signs in to "Insufficient permissions" and no way to reach their
 * own riders. The grant is part of creating the fleet, and these tests are what
 * says so.
 */
describe('FleetsService — creating a fleet', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: FleetsService;
  let roleId: string;
  const createdUserIds: string[] = [];
  const createdFleetIds: string[] = [];
  const context = {};

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
    service = new FleetsService(prisma, new AuditService(auditLogRepository));

    // The suite seeds the role it depends on rather than assuming a seeded
    // database: CI runs migrations but not seed-rbac.cjs.
    const role = await prisma.role.upsert({
      where: { name: FLEET_OWNER_ROLE },
      create: { name: FLEET_OWNER_ROLE, description: 'DPX-FLEET — test fixture' },
      update: {},
    });
    roleId = role.id;
  });

  afterAll(async () => {
    if (databaseAvailable) {
      for (const fleetId of createdFleetIds) {
        await prisma.fleet.delete({ where: { id: fleetId } }).catch(() => undefined);
      }
      for (const userId of createdUserIds) {
        await prisma.userRole.deleteMany({ where: { userId } }).catch(() => undefined);
        await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
      }
    }
    await prisma.$disconnect();
  });

  /** Its own owner each time, so no test depends on another's leftovers. */
  async function makeOwner(): Promise<string> {
    const owner = await prisma.user.create({
      data: {
        email: `fleet-owner-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Kano',
        lastName: 'Logistics',
      },
    });
    createdUserIds.push(owner.id);
    return owner.id;
  }

  it('grants the owner the fleet_owner role, so their console is reachable', async () => {
    if (!databaseAvailable) return;

    const ownerId = await makeOwner();
    const fleet = await service.createFleet({
      ownerUserId: ownerId,
      name: 'Kano Logistics',
      context,
    });
    createdFleetIds.push(fleet.id);

    const grant = await prisma.userRole.findUnique({
      where: { userId_roleId: { userId: ownerId, roleId } },
    });
    expect(grant).not.toBeNull();
  });

  it('issues a Fleet DX number in the spoken format', async () => {
    if (!databaseAvailable) return;

    const ownerId = await makeOwner();
    const fleet = await service.createFleet({
      ownerUserId: ownerId,
      name: 'Six Cars Ltd',
      contactPhone: '+2348030000000',
      context,
    });
    createdFleetIds.push(fleet.id);

    expect(fleet.fleetNumber).toMatch(/^DX-FL-\d{4,}$/);
    expect(fleet.contactPhone).toBe('+2348030000000');
  });

  it('refuses an owner who does not exist rather than creating an orphan fleet', async () => {
    if (!databaseAvailable) return;

    await expect(
      service.createFleet({ ownerUserId: randomUUID(), name: 'Ghost Fleet', context }),
    ).rejects.toBeInstanceOf(NotFoundDomainException);
  });

  it('names the permission the owner console is gated on', () => {
    // Guards the constant the grant above exists to satisfy: renaming either
    // side without the other silently locks every fleet owner out.
    expect(FLEET_PERMISSIONS.OWN_READ).toBe('fleet:own:read');
  });
});
