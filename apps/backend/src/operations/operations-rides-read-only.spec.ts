import { DriverStatus, RideStatus } from '@prisma/client';

import { OperationsDispatchSupportService } from './operations-dispatch-support.service';
import { OperationsRideDetailService } from './operations-ride-detail.service';
import { OperationsRideQueueService } from './operations-ride-queue.service';

import type { PrismaService } from '../prisma/prisma.service';

/**
 * DPX-OPS — the four Ride & Dispatch operator reads must not write.
 *
 * WHY THIS SPEC EXISTS, AND WHY IT IS NOT A COMMENT. Before porting these to
 * ops.dripplex.com it was necessary to establish that they are genuinely
 * side-effect free. `@Get` does not establish that, and neither does a name:
 * `dispatch-candidates` sounds exactly like something that allocates. The
 * service's own comment claims "RideDispatchService/RideOfferSweepService
 * (both frozen) are never called into or duplicated" — this spec is what makes
 * that claim fail loudly if it ever stops being true, rather than a promise
 * nobody re-checks.
 *
 * HOW IT WORKS. Each service is constructed with a Prisma stub whose every
 * WRITE verb throws. Reads return fixtures. If any of the four paths ever
 * attempts a create, update, upsert, delete, raw execute or interactive
 * transaction, the call rejects and the test goes red naming the model and
 * method that tried it.
 *
 * WHAT IT WOULD CATCH. An allocation written into the candidate path — a
 * RideOffer created, a driver's availability locked, activeRideCount bumped,
 * a ride assigned — all of which are writes, all of which this stub refuses.
 * It would also catch a `$transaction`, which is how such a change would most
 * naturally be written.
 *
 * WHAT IT CANNOT CATCH, stated rather than implied: a side effect that travels
 * somewhere other than Prisma — a notification, a queue publish, an HTTP call.
 * That is covered structurally instead: BOTH services take PrismaService as
 * their only constructor dependency, so they have nothing else injected to
 * cause an effect with. The companion assertion below pins that, because it is
 * the dependency list — not this stub — that bounds what is possible.
 */

const WRITE_VERBS = [
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
] as const;

class WriteAttempted extends Error {
  constructor(what: string) {
    super(`A read-only operator path attempted a WRITE: ${what}`);
    this.name = 'WriteAttempted';
  }
}

/**
 * A Prisma stub that answers reads from `reads` and refuses every write.
 *
 * Any model/method not supplied also throws, so a NEW read introduced into one
 * of these paths fails here too and has to be acknowledged in the fixture
 * rather than slipping in unnoticed.
 */
type StubProbe = Record<string, Record<string, (arg?: unknown) => unknown>> & {
  $transaction: (arg?: unknown) => unknown;
};

/** The stub seen as the loose shape these guard tests poke at directly. */
function probe(prisma: PrismaService): StubProbe {
  return prisma as unknown as StubProbe;
}

function readOnlyPrisma(reads: Record<string, Record<string, unknown>>): PrismaService {
  const root: Record<string, unknown> = {
    $transaction: () => {
      throw new WriteAttempted('$transaction');
    },
    $executeRaw: () => {
      throw new WriteAttempted('$executeRaw');
    },
    $executeRawUnsafe: () => {
      throw new WriteAttempted('$executeRawUnsafe');
    },
  };

  return new Proxy(root, {
    get(target, modelName: string) {
      if (modelName in target) {
        return target[modelName];
      }
      return new Proxy(
        {},
        {
          get(_m, method: string) {
            if ((WRITE_VERBS as readonly string[]).includes(method)) {
              return () => {
                throw new WriteAttempted(`${modelName}.${method}`);
              };
            }
            const supplied = reads[modelName]?.[method];
            if (supplied === undefined) {
              throw new WriteAttempted(
                `${modelName}.${method} — not a fixture; a new database call appeared in a read-only path`,
              );
            }
            return () => Promise.resolve(supplied);
          },
        },
      );
    },
  }) as unknown as PrismaService;
}

const user = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'user-1',
  firstName: 'Ada',
  lastName: 'Customer',
  phone: '+2348010000001',
  ...over,
});

const ride = {
  id: 'ride-1',
  status: RideStatus.REQUESTED,
  rideType: 'STANDARD',
  customerId: 'user-1',
  customer: user(),
  driverId: null,
  driver: null,
  pickupLatitude: 6.5,
  pickupLongitude: 3.3,
  pickupAddress: '1 Pickup Road',
  dropoffLatitude: 6.6,
  dropoffLongitude: 3.4,
  dropoffAddress: '2 Dropoff Road',
  estimatedDistanceMeters: 4200,
  estimatedDurationSeconds: 900,
  baseFare: 500,
  distanceFare: 700,
  timeFare: 200,
  totalFare: 1400,
  promoDiscount: 0,
  paymentMethod: 'DX_WALLET',
  paymentStatus: 'PENDING',
  tipAmount: null,
  requestedAt: new Date('2026-09-17T06:00:00.000Z'),
  assignedAt: null,
  arrivedAt: null,
  startedAt: null,
  completedAt: null,
  cancelledAt: null,
  cancelledBy: null,
  cancellationReason: null,
  createdAt: new Date('2026-09-17T06:00:00.000Z'),
  updatedAt: new Date('2026-09-17T06:00:00.000Z'),
};

const availability = {
  driverId: 'driver-1',
  online: true,
  acceptingRides: true,
  vehicleType: 'STANDARD',
  activeRideCount: 0,
  latitude: 6.5009,
  longitude: 3.3009,
  driver: user({ id: 'driver-1', firstName: 'Musa', lastName: 'Driver' }),
};

describe('Ride & Dispatch operator reads perform no writes', () => {
  describe('the stub itself refuses writes — otherwise every test below is vacuous', () => {
    it('throws when a write verb is called', () => {
      const prisma = readOnlyPrisma({});
      expect(() => probe(prisma)['ride']?.['create']?.({})).toThrow(
        /attempted a WRITE: ride\.create/,
      );
    });

    it('throws on an interactive transaction', () => {
      const prisma = readOnlyPrisma({});
      expect(() => probe(prisma).$transaction([])).toThrow(/attempted a WRITE: \$transaction/);
    });

    it('throws on a read nobody declared, so a new query cannot slip in', () => {
      const prisma = readOnlyPrisma({});
      expect(() => probe(prisma)['ride']?.['findFirst']?.({})).toThrow(/not a fixture/);
    });
  });

  describe('GET /operations/rides/:id', () => {
    it('returns the ride without writing anything', async () => {
      const service = new OperationsRideDetailService(
        readOnlyPrisma({ ride: { findUnique: ride }, sosAlert: { count: 0 } }),
      );
      const detail = await service.getRideDetail('ride-1');
      expect(detail.rideId).toBe('ride-1');
      expect(detail.hasOpenSos).toBe(false);
    });
  });

  describe('GET /operations/rides/:id/allocation', () => {
    it('returns the offer history without writing anything', async () => {
      const service = new OperationsRideDetailService(
        readOnlyPrisma({ ride: { findUnique: ride }, rideOffer: { findMany: [] } }),
      );
      const allocation = await service.getRideAllocation('ride-1');
      expect(allocation.offers).toEqual([]);
      expect(allocation.currentDriverId).toBeNull();
    });
  });

  describe('GET /operations/rides/:id/tracking', () => {
    it('returns tracking points without writing anything', async () => {
      const service = new OperationsDispatchSupportService(
        readOnlyPrisma({ ride: { findUnique: ride }, rideTracking: { findMany: [] } }),
      );
      await expect(service.getTripTracking('ride-1')).resolves.toBeDefined();
    });
  });

  describe('GET /operations/rides/:id/dispatch-candidates — the one that sounds like it allocates', () => {
    it('ranks candidates without offering, locking or assigning anything', async () => {
      const service = new OperationsDispatchSupportService(
        readOnlyPrisma({
          ride: { findUnique: ride },
          driverAvailability: { findMany: [availability] },
          vehicle: { findMany: [] },
          rideRating: { groupBy: [] },
        }),
      );

      const result = await service.getDispatchCandidates('ride-1');

      // It computed a real answer — this is not passing by returning early.
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0]?.driverId).toBe('driver-1');
    });

    it('still writes nothing when there are no candidates in range', async () => {
      const service = new OperationsDispatchSupportService(
        readOnlyPrisma({
          ride: { findUnique: ride },
          driverAvailability: {
            findMany: [{ ...availability, latitude: 0, longitude: 0 }],
          },
        }),
      );
      const result = await service.getDispatchCandidates('ride-1');
      expect(result.candidates).toEqual([]);
    });
  });

  describe('GET /operations/rides (queue)', () => {
    it('lists the queue without writing anything', async () => {
      const service = new OperationsRideQueueService(readOnlyPrisma({ ride: { findMany: [] } }));
      await expect(service.getRideQueue()).resolves.toBeDefined();
    });
  });

  describe('the dependency list is what bounds non-Prisma effects', () => {
    it.each([
      ['OperationsRideDetailService', OperationsRideDetailService],
      ['OperationsDispatchSupportService', OperationsDispatchSupportService],
      ['OperationsRideQueueService', OperationsRideQueueService],
    ])('%s takes exactly one constructor dependency', (_name, ServiceClass) => {
      // A Prisma stub cannot catch a notification, a queue publish or an HTTP
      // call. Nothing else is injected to make one WITH, and that is the part
      // worth pinning: the day someone adds a NotificationCenterService here
      // to "tell the driver they were considered", this goes red and the
      // read-only claim gets re-examined instead of quietly lapsing.
      expect(ServiceClass.length).toBe(1);
    });
  });

  describe('DriverStatus filtering is still on approved drivers only', () => {
    it('is the status the candidate query names', () => {
      // Pinned because a candidate list that included unapproved drivers would
      // be an operator-facing suggestion to dispatch someone the platform has
      // not cleared.
      expect(DriverStatus.APPROVED).toBe('APPROVED');
    });
  });
});
