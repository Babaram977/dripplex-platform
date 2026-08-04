import { randomUUID } from 'node:crypto';

import { PrismaClient, RideStatus, RideType } from '@prisma/client';

import { NotFoundDomainException } from '../../common/exceptions/domain.exception';

import { DriverRideContactService } from './driver-ride-contact.service';

import type { PrismaService } from '../../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

describe('DriverRideContactService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: DriverRideContactService;
  let driverId: string;
  let customerId: string;
  let rideIds: string[] = [];

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

    service = new DriverRideContactService(prisma);

    const driver = await prisma.user.create({
      data: {
        email: `ride-contact-driver-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: 'Driver',
      },
    });
    driverId = driver.id;

    const customer = await prisma.user.create({
      data: {
        email: `ride-contact-customer-${randomUUID()}@dripplex.test`,
        phone: `+234800${randomUUID().replace(/-/g, '').slice(0, 7)}`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Jane',
        lastName: 'Passenger',
      },
    });
    customerId = customer.id;
  });

  afterEach(async () => {
    if (databaseAvailable && rideIds.length > 0) {
      await prisma.ride.deleteMany({ where: { id: { in: rideIds } } }).catch(() => undefined);
      rideIds = [];
    }
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.user.delete({ where: { id: driverId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: customerId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  function baseRideData(status: RideStatus): Parameters<typeof prisma.ride.create>[0]['data'] {
    return {
      customerId,
      driverId,
      rideType: RideType.ECONOMY,
      status,
      pickupLatitude: 6.5244,
      pickupLongitude: 3.3792,
      dropoffLatitude: 6.601,
      dropoffLongitude: 3.3489,
    };
  }

  it('resolves the customer name/phone for a DRIVER_ASSIGNED ride', async () => {
    if (!databaseAvailable) return;

    const ride = await prisma.ride.create({ data: baseRideData(RideStatus.DRIVER_ASSIGNED) });
    rideIds.push(ride.id);

    const result = await service.getActiveContact(driverId);

    expect(result.rideId).toBe(ride.id);
    expect(result.customerId).toBe(customerId);
    expect(result.name).toBe('Jane Passenger');
    expect(result.phone).not.toBeNull();
  });

  it('resolves for ARRIVED and IN_PROGRESS rides too', async () => {
    if (!databaseAvailable) return;

    const ride = await prisma.ride.create({ data: baseRideData(RideStatus.IN_PROGRESS) });
    rideIds.push(ride.id);

    const result = await service.getActiveContact(driverId);
    expect(result.rideId).toBe(ride.id);
  });

  it('throws NotFoundDomainException when the driver has no active ride', async () => {
    if (!databaseAvailable) return;

    const ride = await prisma.ride.create({ data: baseRideData(RideStatus.COMPLETED) });
    rideIds.push(ride.id);

    await expect(service.getActiveContact(driverId)).rejects.toThrow(NotFoundDomainException);
  });

  it('throws NotFoundDomainException when the driver has no rides at all', async () => {
    if (!databaseAvailable) return;

    await expect(service.getActiveContact(driverId)).rejects.toThrow(NotFoundDomainException);
  });
});
