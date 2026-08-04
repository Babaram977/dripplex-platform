import { randomUUID } from 'node:crypto';

import { PrismaClient, RideStatus, RideType } from '@prisma/client';

import { OperationsRideQueueService } from './operations-ride-queue.service';

import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

describe('OperationsRideQueueService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: OperationsRideQueueService;
  let customerId: string;
  let driverId: string;
  const rideIds: string[] = [];

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

    service = new OperationsRideQueueService(prisma);

    const customer = await prisma.user.create({
      data: {
        email: `ops-queue-customer-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Customer',
      },
    });
    customerId = customer.id;

    const driver = await prisma.user.create({
      data: {
        email: `ops-queue-driver-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Driver',
      },
    });
    driverId = driver.id;
  });

  afterAll(async () => {
    if (databaseAvailable) {
      if (rideIds.length > 0) {
        await prisma.ride.deleteMany({ where: { id: { in: rideIds } } }).catch(() => undefined);
      }
      await prisma.user.delete({ where: { id: customerId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: driverId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  function baseRideData(
    status: RideStatus,
    withDriver: boolean,
  ): Parameters<typeof prisma.ride.create>[0]['data'] {
    return {
      customerId,
      ...(withDriver ? { driverId } : {}),
      rideType: RideType.ECONOMY,
      status,
      pickupLatitude: 6.5244,
      pickupLongitude: 3.3792,
      dropoffLatitude: 6.601,
      dropoffLongitude: 3.3489,
    };
  }

  it('lists every live-status ride, grouped into pending/assigned/in-progress, excluding settled rides', async () => {
    if (!databaseAvailable) return;

    const requested = await prisma.ride.create({ data: baseRideData(RideStatus.REQUESTED, false) });
    const assigned = await prisma.ride.create({
      data: baseRideData(RideStatus.DRIVER_ASSIGNED, true),
    });
    const inProgress = await prisma.ride.create({
      data: baseRideData(RideStatus.IN_PROGRESS, true),
    });
    const completed = await prisma.ride.create({
      data: baseRideData(RideStatus.COMPLETED, true),
    });
    rideIds.push(requested.id, assigned.id, inProgress.id, completed.id);

    const queue = await service.getRideQueue();
    const ids = queue.rides.map((r) => r.rideId);

    expect(ids).toContain(requested.id);
    expect(ids).toContain(assigned.id);
    expect(ids).toContain(inProgress.id);
    expect(ids).not.toContain(completed.id);

    const requestedDto = queue.rides.find((r) => r.rideId === requested.id);
    expect(requestedDto?.driverId).toBeNull();
    expect(requestedDto?.driverName).toBeNull();

    const assignedDto = queue.rides.find((r) => r.rideId === assigned.id);
    expect(assignedDto?.driverId).toBe(driverId);
    expect(assignedDto?.customerId).toBe(customerId);

    expect(queue.summary.pendingCount).toBeGreaterThanOrEqual(1);
    expect(queue.summary.assignedCount).toBeGreaterThanOrEqual(1);
    expect(queue.summary.inProgressCount).toBeGreaterThanOrEqual(1);
  });
});
