import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { DomainEventBus } from '../events/domain-event-bus';

import { RideDispatchService } from './ride-dispatch.service';

import type { RideEventsPublisher } from './ride-events.publisher';
import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { NotificationService } from '../notifications/notification.service';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

// Deliberately far from every other spec's fixture coordinates — these tests
// share one live database with the rest of the suite, and a foreign fixture
// drifting in as the "nearest" candidate would make them lie.
const PICKUP = { lat: 31.0, lng: 29.0 };
const NEARBY_A = { lat: 31.001, lng: 29.0005 };
const NEARBY_B = { lat: 31.0015, lng: 29.001 };

/**
 * A single green run proves nothing about a race (CLAUDE.md §5), so each
 * invariant is driven repeatedly and the violations are counted. Before the
 * atomic claim in `acceptOffer` these counters sat at 10/10, not at some
 * occasional flake.
 */
const RUNS = 10;

jest.setTimeout(120_000);

describe('RideDispatchService — concurrent offer claims', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: RideDispatchService;
  let customerId: string;
  const driverIds: string[] = [];
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

    const auditLogRepository: jest.Mocked<AuditLogRepository> = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    const notifications = {
      notifyRideLifecycle: jest.fn().mockResolvedValue(undefined),
      notifyRideEarning: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<NotificationService>;
    const events = {
      publishToRide: jest.fn(),
      publishToDriver: jest.fn(),
    } as unknown as jest.Mocked<RideEventsPublisher>;

    service = new RideDispatchService(
      prisma,
      new AuditService(auditLogRepository),
      notifications,
      events,
      new DomainEventBus(),
    );

    const customer = await prisma.user.create({
      data: {
        email: `offer-claim-customer-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Claim',
        lastName: 'Customer',
      },
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.rideOffer.deleteMany({ where: { rideId: { in: rideIds } } });
      await prisma.ride.deleteMany({ where: { id: { in: rideIds } } });
      await prisma.driverAvailability
        .deleteMany({ where: { driverId: { in: driverIds } } })
        .catch(() => undefined);
      await prisma.driverProfile
        .deleteMany({ where: { userId: { in: driverIds } } })
        .catch(() => undefined);
      await prisma.user.deleteMany({ where: { id: { in: driverIds } } });
      await prisma.user.delete({ where: { id: customerId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  async function createDriver(location: { lat: number; lng: number }): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `offer-claim-driver-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Claim',
        lastName: 'Driver',
      },
    });
    driverIds.push(user.id);
    await prisma.driverProfile.create({
      data: { userId: user.id, status: 'APPROVED', isApproved: true },
    });
    await prisma.driverAvailability.create({
      data: {
        driverId: user.id,
        online: true,
        acceptingRides: true,
        vehicleType: 'ECONOMY',
        latitude: location.lat,
        longitude: location.lng,
        locationUpdatedAt: new Date(),
      },
    });
    return user.id;
  }

  /** Later runs must not see earlier runs' drivers as candidates. */
  async function retire(ids: string[]): Promise<void> {
    await prisma.driverAvailability.updateMany({
      where: { driverId: { in: ids } },
      data: { acceptingRides: false },
    });
  }

  async function createRide(): Promise<string> {
    const ride = await prisma.ride.create({
      data: {
        customerId,
        rideType: 'ECONOMY',
        pickupLatitude: PICKUP.lat,
        pickupLongitude: PICKUP.lng,
        dropoffLatitude: PICKUP.lat + 0.02,
        dropoffLongitude: PICKUP.lng + 0.02,
        estimatedDistanceMeters: 2000,
        estimatedDurationSeconds: 300,
        baseFare: 300,
        distanceFare: 200,
        timeFare: 50,
        totalFare: 550,
      },
    });
    rideIds.push(ride.id);
    return ride.id;
  }

  /**
   * A driver tapping Accept twice — or an app retrying over a flaky mobile
   * connection — used to be accepted twice. The second increment is never
   * decremented, and `activeRideCount` above zero is what makes dispatch skip a
   * driver (see OPERATIONS_CANCELLABLE_RIDE_STATUSES), so the driver quietly
   * stopped being offered work.
   */
  it('accepts one ride once when the same offer is claimed twice at once', async () => {
    if (!databaseAvailable) return;

    let bothSucceeded = 0;
    let overCounted = 0;

    for (let run = 0; run < RUNS; run += 1) {
      const driverId = await createDriver(NEARBY_A);
      const rideId = await createRide();
      await service.dispatchRide(rideId);
      const offer = await prisma.rideOffer.findFirstOrThrow({ where: { rideId } });

      const results = await Promise.allSettled([
        service.acceptOffer(driverId, offer.id, {}),
        service.acceptOffer(driverId, offer.id, {}),
      ]);
      if (results.filter((r) => r.status === 'fulfilled').length > 1) {
        bothSucceeded += 1;
      }

      const availability = await prisma.driverAvailability.findFirstOrThrow({
        where: { driverId },
      });
      if (availability.activeRideCount > 1) {
        overCounted += 1;
      }

      await retire([driverId]);
    }

    expect({ bothSucceeded, overCounted }).toEqual({ bothSucceeded: 0, overCounted: 0 });
  });

  /**
   * Guarding the offer alone is not enough to make this pass. `dispatchRide`
   * reads a ride's existing offers before creating its own, so two dispatches
   * racing on one ride each believe they are the first and two *different*
   * live offers exist — and two different offers both satisfy a per-offer
   * check. The ride itself has to be the thing that gets claimed.
   */
  it('assigns one driver when two live offers for one ride are accepted at once', async () => {
    if (!databaseAvailable) return;

    let bothAssigned = 0;
    let strandedDrivers = 0;

    for (let run = 0; run < RUNS; run += 1) {
      const driverA = await createDriver(NEARBY_A);
      const driverB = await createDriver(NEARBY_B);
      const rideId = await createRide();

      await Promise.allSettled([service.dispatchRide(rideId), service.dispatchRide(rideId)]);

      const offers = await prisma.rideOffer.findMany({
        where: { rideId, status: 'PENDING' },
      });

      const accepted = await Promise.allSettled(
        offers.map(async (offer) => await service.acceptOffer(offer.driverId, offer.id, {})),
      );
      if (accepted.filter((r) => r.status === 'fulfilled').length > 1) {
        bothAssigned += 1;
      }

      const ride = await prisma.ride.findFirstOrThrow({ where: { id: rideId } });
      for (const offer of offers) {
        const availability = await prisma.driverAvailability.findFirstOrThrow({
          where: { driverId: offer.driverId },
        });
        // Holding a ride count for a ride that went to somebody else is the
        // state dispatch never recovers from on its own.
        if (availability.activeRideCount > 0 && ride.driverId !== offer.driverId) {
          strandedDrivers += 1;
        }
      }

      await retire([driverA, driverB]);
    }

    expect({ bothAssigned, strandedDrivers }).toEqual({ bothAssigned: 0, strandedDrivers: 0 });
  });
});
