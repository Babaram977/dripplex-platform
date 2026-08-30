import { randomUUID } from 'node:crypto';

import { FleetMemberRole, FleetMemberStatus, FleetStatus, PrismaClient } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';

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

  /**
   * Self-registration, and the two waiting states that keep money from moving
   * on a claim nobody has checked. Founder decision, 2026-08-30.
   */
  describe('registering online', () => {
    /** A rider with a real rider profile, so join requests are legitimate. */
    async function makeRider(): Promise<string> {
      const user = await prisma.user.create({
        data: {
          email: `fleet-rider-${randomUUID()}@dripplex.test`,
          passwordHash: 'not-a-real-hash',
          firstName: 'Nasir',
          lastName: 'Rider',
          riderProfile: { create: {} },
        },
      });
      createdUserIds.push(user.id);
      return user.id;
    }

    it('issues the DX number at once but leaves the fleet awaiting approval', async () => {
      if (!databaseAvailable) return;

      const ownerId = await makeOwner();
      const fleet = await service.registerFleet({
        ownerUserId: ownerId,
        name: 'Self Registered Ltd',
        context,
      });
      createdFleetIds.push(fleet.id);

      // The number is the whole point — the owner needs it for their riders.
      expect(fleet.fleetNumber).toMatch(/^DX-FL-\d{4,}$/);
      expect(fleet.status).toBe(FleetStatus.PENDING_APPROVAL);

      // ...and they can still open their own console to watch it.
      const grant = await prisma.userRole.findUnique({
        where: { userId_roleId: { userId: ownerId, roleId } },
      });
      expect(grant).not.toBeNull();
    });

    it('does not treat a rider who only quoted the number as a fleet member', async () => {
      if (!databaseAvailable) return;

      const ownerId = await makeOwner();
      const fleet = await service.registerFleet({
        ownerUserId: ownerId,
        name: 'Unconfirmed Riders Ltd',
        context,
      });
      createdFleetIds.push(fleet.id);
      const riderId = await makeRider();

      await service.requestToJoin({
        fleetNumber: fleet.fleetNumber,
        userId: riderId,
        context,
      });

      // This is the money path: it decides whether the rider skips the
      // platform's 10% and whether their jobs are billed to this fleet.
      // An unconfirmed claim must not reach it.
      expect(await service.fleetForUser(riderId)).toBeNull();
    });

    it('makes them a member only once the owner confirms, and not before approval matters', async () => {
      if (!databaseAvailable) return;

      const ownerId = await makeOwner();
      const fleet = await service.registerFleet({
        ownerUserId: ownerId,
        name: 'Confirmed Riders Ltd',
        context,
      });
      createdFleetIds.push(fleet.id);
      const riderId = await makeRider();

      const { member } = await service.requestToJoin({
        fleetNumber: fleet.fleetNumber,
        userId: riderId,
        context,
      });
      await service.approveJoinRequest({
        fleetId: fleet.id,
        memberId: member.id,
        ownerUserId: ownerId,
        context,
      });

      // Confirmed by the owner, but DrippleX has not approved the fleet, so
      // it still is not trading.
      expect(await service.fleetForUser(riderId)).toBeNull();

      await service.approveFleet({ fleetId: fleet.id, adminUserId: ownerId, context });

      const membership = await service.fleetForUser(riderId);
      expect(membership?.fleet.id).toBe(fleet.id);
      expect(membership?.member.status).toBe(FleetMemberStatus.ACTIVE);
    });

    it('lets a rider who mistyped a number ask a different fleet', async () => {
      if (!databaseAvailable) return;

      const firstOwner = await makeOwner();
      const wrong = await service.registerFleet({
        ownerUserId: firstOwner,
        name: 'Wrong Fleet Ltd',
        context,
      });
      createdFleetIds.push(wrong.id);

      const secondOwner = await makeOwner();
      const right = await service.registerFleet({
        ownerUserId: secondOwner,
        name: 'Right Fleet Ltd',
        context,
      });
      createdFleetIds.push(right.id);

      const riderId = await makeRider();
      const { member } = await service.requestToJoin({
        fleetNumber: wrong.fleetNumber,
        userId: riderId,
        context,
      });

      // A pending request holds no `activeUserId`, so the rider is not locked
      // into the fleet they typed by mistake.
      await service.rejectJoinRequest({
        fleetId: wrong.id,
        memberId: member.id,
        ownerUserId: firstOwner,
        context,
      });

      const second = await service.requestToJoin({
        fleetNumber: right.fleetNumber,
        userId: riderId,
        context,
      });
      expect(second.fleet.id).toBe(right.id);
    });

    it('refuses to attach anyone to a fleet DrippleX has not approved', async () => {
      if (!databaseAvailable) return;

      const ownerId = await makeOwner();
      const fleet = await service.registerFleet({
        ownerUserId: ownerId,
        name: 'Not Yet Approved Ltd',
        context,
      });
      createdFleetIds.push(fleet.id);
      const riderId = await makeRider();

      await expect(
        service.addMember({
          fleetNumber: fleet.fleetNumber,
          userId: riderId,
          role: FleetMemberRole.RIDER,
          context,
        }),
      ).rejects.toBeInstanceOf(ConflictDomainException);
    });

    it('refuses a join request from someone who is neither a rider nor a driver', async () => {
      if (!databaseAvailable) return;

      const ownerId = await makeOwner();
      const fleet = await service.registerFleet({
        ownerUserId: ownerId,
        name: 'Customers Not Welcome Ltd',
        context,
      });
      createdFleetIds.push(fleet.id);
      // makeOwner creates a plain user with no rider or driver profile.
      const customerId = await makeOwner();

      await expect(
        service.requestToJoin({
          fleetNumber: fleet.fleetNumber,
          userId: customerId,
          context,
        }),
      ).rejects.toBeInstanceOf(ValidationDomainException);
    });
  });
});
