import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { RideShareService } from './ride-share.service';
import { SHARE_LINK_GRACE_MS } from './ride.constants';

import type { PrismaService } from '../prisma/prisma.service';
import type { Ride, RideStatus } from '@prisma/client';

/** Ten letters, never a digit — see the note at its call site. */
function uniquePlateSuffix(): string {
  const letters = (randomUUID() + randomUUID()).replace(/[^a-f]/g, '').toUpperCase();
  return letters.slice(0, 10).padEnd(10, 'F');
}

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

describe('RideShareService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: RideShareService;
  let customerId: string;
  let driverId: string;
  const createdUserIds: string[] = [];
  const createdRideIds: string[] = [];
  const createdVehicleIds: string[] = [];

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

    service = new RideShareService(prisma);

    const customer = await prisma.user.create({
      data: {
        email: `ride-share-customer-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Abdullahi',
        lastName: 'Musa',
      },
    });
    customerId = customer.id;
    createdUserIds.push(customerId);

    const driver = await prisma.user.create({
      data: {
        email: `ride-share-driver-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Ado',
        lastName: 'Isa',
        // Salted rather than clock-derived: two suites starting in the same
        // millisecond would otherwise collide on the unique phone column.
        phone: `+234${randomUUID().replace(/\D/g, '').padEnd(9, '0').slice(0, 9)}`,
      },
    });
    driverId = driver.id;
    createdUserIds.push(driverId);

    const vehicle = await prisma.vehicle.create({
      data: {
        driverId,
        // Letters only, and that is load-bearing rather than cosmetic. This
        // was six digits of the clock, and the leak assertion below searches
        // the serialised payload for the trip code '4729' — so any run whose
        // millisecond happened to contain those digits failed the test for a
        // leak that had not occurred. It fired in CI on 2026-08-27 with plate
        // KN-424729. A fixture must never be able to spell the needle a test
        // is looking for.
        //
        // plateNumber is @@unique, so it still has to differ per run: ~6^10
        // combinations from the hex letters of two UUIDs.
        plateNumber: `KN-${uniquePlateSuffix()}`,
        make: 'Toyota',
        model: 'Corolla',
        color: 'Silver',
        year: 2016,
        rideCategory: 'ECONOMY',
        approvalStatus: 'APPROVED',
      },
    });
    createdVehicleIds.push(vehicle.id);

    await prisma.driverAvailability.create({
      data: {
        driverId,
        online: true,
        acceptingRides: true,
        vehicleType: 'ECONOMY',
        latitude: 12.0,
        longitude: 8.5,
        locationUpdatedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.ride.deleteMany({ where: { id: { in: createdRideIds } } });
      await prisma.driverAvailability.delete({ where: { driverId } }).catch(() => undefined);
      await prisma.vehicle.deleteMany({ where: { id: { in: createdVehicleIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  async function createRide(status: RideStatus, extra: Partial<Ride> = {}): Promise<Ride> {
    const ride = await prisma.ride.create({
      data: {
        customerId,
        driverId,
        rideType: 'ECONOMY',
        status,
        pickupLatitude: 12.0,
        pickupLongitude: 8.5,
        pickupAddress: 'Zoo Road, Kano',
        dropoffLatitude: 12.02,
        dropoffLongitude: 8.52,
        dropoffAddress: 'Sabon Gari, Kano',
        estimatedDistanceMeters: 5800,
        estimatedDurationSeconds: 720,
        baseFare: 300,
        distanceFare: 200,
        timeFare: 50,
        totalFare: 550,
        verificationCode: '4729',
        ...extra,
      },
    });
    createdRideIds.push(ride.id);
    return ride;
  }

  it('mints one link per ride and hands the same one back on a second share', async () => {
    if (!databaseAvailable) return;

    const ride = await createRide('IN_PROGRESS');

    const first = await service.createShareLink(customerId, ride.id);
    const second = await service.createShareLink(customerId, ride.id);

    expect(first.token).toHaveLength(32);
    expect(second.token).toBe(first.token);
    expect(first.path).toBe(`/t/${first.token}`);
  });

  it('refuses to share a ride that belongs to someone else', async () => {
    if (!databaseAvailable) return;

    const ride = await createRide('IN_PROGRESS');

    await expect(service.createShareLink(randomUUID(), ride.id)).rejects.toThrow('Ride not found');
  });

  it('refuses to share a trip that is already over', async () => {
    if (!databaseAvailable) return;

    const ride = await createRide('COMPLETED', { completedAt: new Date() });

    await expect(service.createShareLink(customerId, ride.id)).rejects.toThrow('This trip is over');
  });

  it('serves the driver, the car and a live position — and never the trip code', async () => {
    if (!databaseAvailable) return;

    const ride = await createRide('IN_PROGRESS', { startedAt: new Date() });
    const { token } = await service.createShareLink(customerId, ride.id);

    const shared = await service.getSharedRide(token);

    expect(shared.status).toBe('IN_PROGRESS');
    // First names only: a follower gets enough to recognise a driver, not to
    // identify one.
    expect(shared.driverFirstName).toBe('Ado');
    expect(shared.passengerFirstName).toBe('Abdullahi');
    expect(shared.vehicle).toEqual({
      plateNumber: expect.stringContaining('KN-') as string,
      make: 'Toyota',
      model: 'Corolla',
      color: 'Silver',
    });
    expect(shared.driverPosition).not.toBeNull();
    // The code must not be in the payload under any key — asserted
    // structurally, because a shape check cannot be defeated by a value that
    // merely looks like the code.
    expect(shared).not.toHaveProperty('verificationCode');
    // And not anywhere in the serialised body either, which catches it
    // reaching a follower inside some field nobody thought to name.
    expect(JSON.stringify(shared)).not.toContain('4729');
  });

  it('drops the driver position once the trip has ended, and expires after the grace window', async () => {
    if (!databaseAvailable) return;

    const ride = await createRide('COMPLETED', { completedAt: new Date() });
    // Minted while live, then completed — the passenger's family should still
    // be able to see it arrived.
    const token = randomUUID().replace(/-/g, '');
    await prisma.ride.update({ where: { id: ride.id }, data: { shareToken: token } });

    const justFinished = await service.getSharedRide(token);
    expect(justFinished.status).toBe('COMPLETED');
    expect(justFinished.driverPosition).toBeNull();

    await prisma.ride.update({
      where: { id: ride.id },
      data: { completedAt: new Date(Date.now() - SHARE_LINK_GRACE_MS - 60_000) },
    });
    await expect(service.getSharedRide(token)).rejects.toThrow('expired');
  });

  it('rejects an unknown token', async () => {
    if (!databaseAvailable) return;

    await expect(service.getSharedRide('not-a-real-token')).rejects.toThrow('not valid');
  });
});
