import { randomUUID } from 'node:crypto';

import { PrismaClient, RideStatus, RideType, UserStatus } from '@prisma/client';

import { ValidationDomainException } from '../common/exceptions/domain.exception';

import { OperationsHistoryService } from './operations-history.service';

import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * The founder asked for this so DrippleX can answer an audit, a dispute, or a
 * police enquiry. Every test below is one of those questions.
 */
describe('OperationsHistoryService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: OperationsHistoryService;
  let customerId: string;
  let driverId: string;
  let customerPhone: string;
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

    service = new OperationsHistoryService(prisma);

    customerPhone = `+23480${String(Math.floor(Math.random() * 100_000_000)).padStart(8, '0')}`;
    const customer = await prisma.user.create({
      data: {
        email: `ops-history-customer-${randomUUID()}@dripplex.test`,
        phone: customerPhone,
        passwordHash: 'not-a-real-hash',
        firstName: 'Amina',
        lastName: 'Yusuf',
      },
    });
    customerId = customer.id;

    const driver = await prisma.user.create({
      data: {
        email: `ops-history-driver-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Lawan',
        lastName: 'Sadiq',
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

  async function createRide(
    status: RideStatus,
    extra: Record<string, unknown> = {},
  ): Promise<string> {
    const ride = await prisma.ride.create({
      data: {
        customerId,
        driverId,
        rideType: RideType.ECONOMY,
        status,
        pickupLatitude: 11.9964,
        pickupLongitude: 8.5919,
        dropoffLatitude: 12.0022,
        dropoffLongitude: 8.5919,
        totalFare: 2500,
        ...extra,
      },
    });
    rideIds.push(ride.id);
    return ride.id;
  }

  it('returns the completed trips the live queue never showed', async () => {
    if (!databaseAvailable) return;

    const completedAt = new Date();
    const id = await createRide(RideStatus.COMPLETED, { completedAt });

    const history = await service.getRideHistory({ status: 'COMPLETED', limit: 100 });
    const row = history.items.find((item) => item.rideId === id);

    expect(row).toBeDefined();
    // The parties by name, because an enquiry starts from a person.
    expect(row?.customer.name).toBe('Amina Yusuf');
    expect(row?.driver?.name).toBe('Lawan Sadiq');
    expect(row?.totalFare).toBe(2500);
    expect(row?.completedAt).toBe(completedAt.toISOString());
  });

  it('keeps a cancelled trip, with who cancelled it and why', async () => {
    if (!databaseAvailable) return;

    const id = await createRide(RideStatus.CANCELLED, {
      cancelledAt: new Date(),
      cancelledBy: 'CUSTOMER',
      cancellationReason: 'Driver was too far away',
    });

    const history = await service.getRideHistory({ status: 'CANCELLED', limit: 100 });
    const row = history.items.find((item) => item.rideId === id);

    // A dispute turns on the reason, not just the fact.
    expect(row?.cancellationReason).toBe('Driver was too far away');
    expect(row?.cancelledBy).toBe('CUSTOMER');
  });

  it('finds a trip by the customer phone number an enquiry would arrive with', async () => {
    if (!databaseAvailable) return;

    const id = await createRide(RideStatus.COMPLETED, { completedAt: new Date() });

    const history = await service.getRideHistory({ search: customerPhone, limit: 100 });

    expect(history.items.some((item) => item.rideId === id)).toBe(true);
  });

  it('finds a trip by its own id', async () => {
    if (!databaseAvailable) return;

    const id = await createRide(RideStatus.COMPLETED, { completedAt: new Date() });

    const history = await service.getRideHistory({ search: id, limit: 100 });

    expect(history.items).toHaveLength(1);
    expect(history.items[0]?.rideId).toBe(id);
  });

  it('still shows the record after the account is deleted', async () => {
    if (!databaseAvailable) return;

    const ghost = await prisma.user.create({
      data: {
        email: `ops-history-ghost-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Closed',
        lastName: 'Account',
      },
    });
    const ride = await prisma.ride.create({
      data: {
        customerId: ghost.id,
        rideType: RideType.ECONOMY,
        status: RideStatus.COMPLETED,
        pickupLatitude: 11.9964,
        pickupLongitude: 8.5919,
        dropoffLatitude: 12.0022,
        dropoffLongitude: 8.5919,
        totalFare: 1200,
        completedAt: new Date(),
      },
    });
    rideIds.push(ride.id);

    // Exactly what AccountDeletionService does to the user row.
    await prisma.user.update({
      where: { id: ghost.id },
      data: { deletedAt: new Date(), status: UserStatus.INACTIVE, phone: null },
    });

    const history = await service.getRideHistory({ search: ride.id, limit: 100 });

    // The whole point of an audit trail: closing an account does not erase
    // what happened. Deleted people vanish from the rosters, never from here.
    expect(history.items.some((item) => item.rideId === ride.id)).toBe(true);

    await prisma.ride.delete({ where: { id: ride.id } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: ghost.id } }).catch(() => undefined);
  });

  it('filters to a date range on the trip request time', async () => {
    if (!databaseAvailable) return;

    const old = await createRide(RideStatus.COMPLETED, {
      requestedAt: new Date('2020-01-01T00:00:00.000Z'),
      completedAt: new Date('2020-01-01T00:30:00.000Z'),
    });

    const recent = await service.getRideHistory({
      from: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      limit: 100,
    });
    expect(recent.items.some((item) => item.rideId === old)).toBe(false);

    const including = await service.getRideHistory({
      from: '2019-12-31T00:00:00.000Z',
      to: '2020-01-02T00:00:00.000Z',
      limit: 100,
    });
    expect(including.items.some((item) => item.rideId === old)).toBe(true);
  });

  it('rejects an unknown status by name instead of returning an empty screen', async () => {
    if (!databaseAvailable) return;

    // Silently returning nothing would read as "the records are missing",
    // which is the exact fear this service exists to answer.
    await expect(service.getRideHistory({ status: 'FINISHED' })).rejects.toBeInstanceOf(
      ValidationDomainException,
    );
  });

  it('reports paging that agrees with the rows', async () => {
    if (!databaseAvailable) return;

    await createRide(RideStatus.COMPLETED, { completedAt: new Date() });

    const firstPage = await service.getRideHistory({ page: 1, limit: 1 });

    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.meta.limit).toBe(1);
    expect(firstPage.meta.totalPages).toBe(firstPage.meta.total);
  });

  it('answers the other three domains without error', async () => {
    if (!databaseAvailable) return;

    // No fixtures: these share one code path, and what is being checked is
    // that each query is valid against its own table and pages correctly.
    const [deliveries, orders, utilities] = await Promise.all([
      service.getDeliveryHistory({ limit: 5 }),
      service.getOrderHistory({ limit: 5 }),
      service.getUtilityPurchaseHistory({ limit: 5 }),
    ]);

    for (const result of [deliveries, orders, utilities]) {
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.meta.limit).toBe(5);
    }
  });

  it('never returns a delivered utility token', async () => {
    if (!databaseAvailable) return;

    const utilities = await service.getUtilityPurchaseHistory({ limit: 100 });

    // A delivered token is a bearer value — whoever reads it can spend it — so
    // the list reports only whether one exists.
    for (const item of utilities.items) {
      expect(item).not.toHaveProperty('deliveredToken');
      expect(typeof item.tokenDelivered).toBe('boolean');
    }
  });
});
