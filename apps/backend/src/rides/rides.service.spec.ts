import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import { RideFareService } from './ride-fare.service';
import { RidesService } from './rides.service';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

describe('RidesService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: RidesService;
  let customerId: string;
  let otherCustomerId: string;
  const context = {};

  const pickup = { pickupLatitude: 6.6018, pickupLongitude: 3.3515 };
  const dropoff = { dropoffLatitude: 6.605, dropoffLongitude: 3.355 };

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
    service = new RidesService(prisma, new RideFareService(), auditService);

    const customer = await prisma.user.create({
      data: {
        email: `ride-service-test-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Customer',
      },
    });
    customerId = customer.id;

    const other = await prisma.user.create({
      data: {
        email: `ride-service-other-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Other',
        lastName: 'Customer',
      },
    });
    otherCustomerId = other.id;
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.ride.deleteMany({
        where: { customerId: { in: [customerId, otherCustomerId] } },
      });
      await prisma.user.delete({ where: { id: customerId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: otherCustomerId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it('creates a ride request with an estimated fare and REQUESTED status', async () => {
    if (!databaseAvailable) return;

    const ride = await service.requestRide(
      customerId,
      { rideType: 'ECONOMY', ...pickup, ...dropoff },
      context,
    );

    expect(ride.status).toBe('REQUESTED');
    expect(ride.driverId).toBeNull();
    expect(ride.totalFare).toBeGreaterThan(0);
    expect(ride.estimatedDistanceMeters).toBeGreaterThan(0);
  });

  it("lists only the requesting customer's own rides", async () => {
    if (!databaseAvailable) return;

    await service.requestRide(
      otherCustomerId,
      { rideType: 'TRICYCLE', ...pickup, ...dropoff },
      context,
    );

    const mine = await service.listOwnRides(customerId, { page: 1, limit: 20 });
    expect(mine.items.every((ride) => ride.customerId === customerId)).toBe(true);
  });

  it('rejects reading a ride that belongs to a different customer', async () => {
    if (!databaseAvailable) return;

    const ride = await service.requestRide(
      otherCustomerId,
      { rideType: 'ECONOMY', ...pickup, ...dropoff },
      context,
    );

    await expect(service.getOwnRide(customerId, ride.id)).rejects.toThrow('Ride not found');
  });

  it('cancels a requested ride', async () => {
    if (!databaseAvailable) return;

    const ride = await service.requestRide(
      customerId,
      { rideType: 'ECONOMY', ...pickup, ...dropoff },
      context,
    );

    const cancelled = await service.cancelRide(
      customerId,
      ride.id,
      { reason: 'Changed my mind' },
      context,
    );

    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancelledBy).toBe('CUSTOMER');
    expect(cancelled.cancellationReason).toBe('Changed my mind');
  });

  it('rejects cancelling a ride that is already cancelled', async () => {
    if (!databaseAvailable) return;

    const ride = await service.requestRide(
      customerId,
      { rideType: 'ECONOMY', ...pickup, ...dropoff },
      context,
    );
    await service.cancelRide(customerId, ride.id, {}, context);

    await expect(service.cancelRide(customerId, ride.id, {}, context)).rejects.toThrow(
      'Ride cannot be cancelled from status CANCELLED',
    );
  });

  it('throws for an unknown ride id', async () => {
    if (!databaseAvailable) return;

    await expect(service.getOwnRide(customerId, randomUUID())).rejects.toThrow('Ride not found');
  });
});
