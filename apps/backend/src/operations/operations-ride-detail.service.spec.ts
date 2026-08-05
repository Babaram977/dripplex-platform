import { randomUUID } from 'node:crypto';

import {
  PrismaClient,
  RideCancelledBy,
  RideOfferStatus,
  RideStatus,
  RideType,
  SosAlertStatus,
} from '@prisma/client';

import { OperationsRideDetailService } from './operations-ride-detail.service';

import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

describe('OperationsRideDetailService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: OperationsRideDetailService;
  let customerId: string;
  let driverId: string;
  let otherDriverId: string;
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

    service = new OperationsRideDetailService(prisma);

    const customer = await prisma.user.create({
      data: {
        email: `ops-ride-detail-customer-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Detail',
        lastName: 'Customer',
        phone: '+2348010000001',
      },
    });
    customerId = customer.id;

    const driver = await prisma.user.create({
      data: {
        email: `ops-ride-detail-driver-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Detail',
        lastName: 'Driver',
        phone: '+2348010000002',
      },
    });
    driverId = driver.id;

    const otherDriver = await prisma.user.create({
      data: {
        email: `ops-ride-detail-other-driver-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Other',
        lastName: 'Driver',
      },
    });
    otherDriverId = otherDriver.id;
  });

  afterAll(async () => {
    if (databaseAvailable) {
      if (rideIds.length > 0) {
        await prisma.rideOffer
          .deleteMany({ where: { rideId: { in: rideIds } } })
          .catch(() => undefined);
        await prisma.sosAlert
          .deleteMany({ where: { rideId: { in: rideIds } } })
          .catch(() => undefined);
        await prisma.ride.deleteMany({ where: { id: { in: rideIds } } }).catch(() => undefined);
      }
      await prisma.user.delete({ where: { id: customerId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: driverId } }).catch(() => undefined);
      await prisma.user.delete({ where: { id: otherDriverId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  function baseRideData(
    overrides: {
      driverId?: string;
      status?: RideStatus;
      cancelledAt?: Date;
      cancelledBy?: RideCancelledBy;
      cancellationReason?: string;
      tipAmount?: number;
    } = {},
  ): Parameters<typeof prisma.ride.create>[0]['data'] {
    return {
      customerId,
      rideType: RideType.ECONOMY,
      status: overrides.status ?? RideStatus.IN_PROGRESS,
      pickupLatitude: 6.5244,
      pickupLongitude: 3.3792,
      dropoffLatitude: 6.601,
      dropoffLongitude: 3.3489,
      totalFare: 1500,
      baseFare: 500,
      distanceFare: 700,
      timeFare: 300,
      ...(overrides.driverId !== undefined ? { driverId: overrides.driverId } : {}),
      ...(overrides.cancelledAt !== undefined ? { cancelledAt: overrides.cancelledAt } : {}),
      ...(overrides.cancelledBy !== undefined ? { cancelledBy: overrides.cancelledBy } : {}),
      ...(overrides.cancellationReason !== undefined
        ? { cancellationReason: overrides.cancellationReason }
        : {}),
      ...(overrides.tipAmount !== undefined ? { tipAmount: overrides.tipAmount } : {}),
    };
  }

  it('composes full ride detail with resolved customer/driver identity', async () => {
    if (!databaseAvailable) return;

    const ride = await prisma.ride.create({
      data: baseRideData({ driverId, tipAmount: 200 }),
    });
    rideIds.push(ride.id);

    const detail = await service.getRideDetail(ride.id);

    expect(detail.rideId).toBe(ride.id);
    expect(detail.customerId).toBe(customerId);
    expect(detail.customerName).toBe('Detail Customer');
    expect(detail.customerPhone).toBe('+2348010000001');
    expect(detail.driverId).toBe(driverId);
    expect(detail.driverName).toBe('Detail Driver');
    expect(detail.totalFare).toBe(1500);
    expect(detail.tipAmount).toBe(200);
    expect(detail.cancelledAt).toBeNull();
    expect(detail.noDriversFound).toBe(false);
    expect(detail.hasOpenSos).toBe(false);
  });

  it('flags hasOpenSos when an open SOS alert references this ride', async () => {
    if (!databaseAvailable) return;

    const ride = await prisma.ride.create({ data: baseRideData({ driverId }) });
    rideIds.push(ride.id);
    const alert = await prisma.sosAlert.create({
      data: { driverId, rideId: ride.id, status: SosAlertStatus.OPEN },
    });

    const detail = await service.getRideDetail(ride.id);
    expect(detail.hasOpenSos).toBe(true);

    // Resolving the alert should clear the flag on the next read.
    await prisma.sosAlert.update({
      where: { id: alert.id },
      data: { status: SosAlertStatus.RESOLVED },
    });
    const detailAfterResolve = await service.getRideDetail(ride.id);
    expect(detailAfterResolve.hasOpenSos).toBe(false);
  });

  it('has a null driver identity for an unassigned ride', async () => {
    if (!databaseAvailable) return;

    const ride = await prisma.ride.create({ data: baseRideData({ status: RideStatus.SEARCHING }) });
    rideIds.push(ride.id);

    const detail = await service.getRideDetail(ride.id);
    expect(detail.driverId).toBeNull();
    expect(detail.driverName).toBeNull();
    expect(detail.driverPhone).toBeNull();
  });

  it('surfaces a real cancellation truthfully', async () => {
    if (!databaseAvailable) return;

    const ride = await prisma.ride.create({
      data: baseRideData({
        status: RideStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledBy: RideCancelledBy.CUSTOMER,
        cancellationReason: 'Changed my mind',
      }),
    });
    rideIds.push(ride.id);

    const detail = await service.getRideDetail(ride.id);
    expect(detail.cancelledAt).not.toBeNull();
    expect(detail.cancelledBy).toBe('CUSTOMER');
    expect(detail.cancellationReason).toBe('Changed my mind');
    expect(detail.noDriversFound).toBe(false);
  });

  it('distinguishes NO_DRIVERS_FOUND from a cancellation — does not fabricate cancelledBy: SYSTEM', async () => {
    if (!databaseAvailable) return;

    const ride = await prisma.ride.create({
      data: baseRideData({ status: RideStatus.NO_DRIVERS_FOUND }),
    });
    rideIds.push(ride.id);

    const detail = await service.getRideDetail(ride.id);
    expect(detail.noDriversFound).toBe(true);
    expect(detail.cancelledAt).toBeNull();
    expect(detail.cancelledBy).toBeNull();
  });

  it('throws NotFoundDomainException for an unknown ride id', async () => {
    if (!databaseAvailable) return;

    await expect(service.getRideDetail(randomUUID())).rejects.toThrow('Ride not found');
  });

  it('lists driver allocation history ordered by offer sequence, with the current driver resolved', async () => {
    if (!databaseAvailable) return;

    const ride = await prisma.ride.create({
      data: baseRideData({ driverId, status: RideStatus.DRIVER_ASSIGNED }),
    });
    rideIds.push(ride.id);

    const now = Date.now();
    await prisma.rideOffer.create({
      data: {
        rideId: ride.id,
        driverId: otherDriverId,
        status: RideOfferStatus.DECLINED,
        offeredAt: new Date(now - 60_000),
        expiresAt: new Date(now - 30_000),
        respondedAt: new Date(now - 45_000),
      },
    });
    await prisma.rideOffer.create({
      data: {
        rideId: ride.id,
        driverId,
        status: RideOfferStatus.ACCEPTED,
        offeredAt: new Date(now),
        expiresAt: new Date(now + 30_000),
        respondedAt: new Date(now + 5_000),
      },
    });

    const allocation = await service.getRideAllocation(ride.id);

    expect(allocation.offers).toHaveLength(2);
    expect(allocation.offers[0]?.driverId).toBe(otherDriverId);
    expect(allocation.offers[0]?.status).toBe('DECLINED');
    expect(allocation.offers[1]?.driverId).toBe(driverId);
    expect(allocation.offers[1]?.status).toBe('ACCEPTED');
    expect(allocation.offers[1]?.driverName).toBe('Detail Driver');
    expect(allocation.currentDriverId).toBe(driverId);
    expect(allocation.currentDriverName).toBe('Detail Driver');
  });
});
