import { OperationsAnalyticsService } from './operations-analytics.service';

import type { PrismaService } from '../prisma/prisma.service';

/**
 * DPX-OPS — the six Operations Analytics reads must not write.
 *
 * WRITTEN BEFORE THE UI PORT, deliberately. "Analytics" sounds inert, and that
 * is exactly the assumption worth refusing: an analytics path that caches a
 * computed roll-up, stamps a "last viewed" marker, or materialises a summary
 * row would be writing on a GET, and nothing about the word would warn anyone.
 * This spec is what makes that fail loudly instead.
 *
 * Structural half: OperationsAnalyticsService takes PrismaService as its ONLY
 * constructor dependency, so it has nothing injected to cause an effect with —
 * no notifier, no queue, no cache client, no HTTP. Pinned by an arity test,
 * because a Prisma stub cannot see effects that do not travel through Prisma.
 *
 * Behavioural half: every service method runs against a stub whose write verbs
 * throw and which also refuses a read nobody declared, so a NEW query appearing
 * in an analytics path has to be acknowledged in the fixture rather than
 * slipping in unnoticed.
 *
 * NOTE FOR WHOEVER MERGES THIS AFTER #434: that branch carries an identical
 * `readOnlyPrisma` helper in operations-rides-read-only.spec.ts. They are
 * duplicated only because the two branches are independent; once both are on
 * main, factor them into one shared test helper rather than letting the two
 * drift.
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
    super(`A read-only analytics path attempted a WRITE: ${what}`);
    this.name = 'WriteAttempted';
  }
}

type StubProbe = Record<string, Record<string, (arg?: unknown) => unknown>> & {
  $transaction: (arg?: unknown) => unknown;
};

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
                `${modelName}.${method} — not a fixture; a new database call appeared in a read-only analytics path`,
              );
            }
            return () => Promise.resolve(supplied);
          },
        },
      );
    },
  }) as unknown as PrismaService;
}

/** Every model/verb the analytics service reads, all answering empty. */
const ALL_READS: Record<string, Record<string, unknown>> = {
  ride: { findMany: [] },
  rideOffer: { findMany: [] },
  driverShift: { findMany: [], count: 0 },
  driverAvailability: { count: 0 },
  operationsCase: { findMany: [], count: 0 },
  orderSettlement: { findMany: [] },
  user: { findMany: [] },
};

const range = {
  from: new Date('2026-09-01T00:00:00.000Z'),
  to: new Date('2026-09-17T00:00:00.000Z'),
};

describe('Operations Analytics reads perform no writes', () => {
  let service: OperationsAnalyticsService;

  beforeEach(() => {
    service = new OperationsAnalyticsService(readOnlyPrisma(ALL_READS));
  });

  describe('the stub itself refuses writes — otherwise every test below is vacuous', () => {
    it('throws when a write verb is called', () => {
      expect(() => probe(readOnlyPrisma({}))['ride']?.['create']?.({})).toThrow(
        /attempted a WRITE: ride\.create/,
      );
    });

    it('throws on an interactive transaction', () => {
      expect(() => probe(readOnlyPrisma({})).$transaction([])).toThrow(
        /attempted a WRITE: \$transaction/,
      );
    });

    it('throws on a read nobody declared', () => {
      expect(() => probe(readOnlyPrisma({}))['ride']?.['aggregate']?.({})).toThrow(/not a fixture/);
    });
  });

  // The six the migration is porting. `overview` is already reachable from
  // ops.dripplex.com and is included because it shares the drill-down methods.
  describe.each([
    ['overview', 'getOverview'],
    ['driver-utilization', 'getDriverUtilization'],
    ['shifts', 'getShiftAnalytics'],
    ['rides', 'getRideOperations'],
    ['dispatch', 'getDispatchPerformance'],
    ['response', 'getOperationsResponse'],
    ['geography', 'getGeographicDemand'],
  ])('GET /operations/analytics/%s', (_route, method) => {
    it('answers without writing anything', async () => {
      const methods = service as unknown as Record<
        string,
        ((r: unknown) => Promise<unknown>) | undefined
      >;
      const fn = methods[method];
      // Asserted rather than assumed: a renamed service method must fail here
      // as a missing method, not silently stop being covered.
      if (fn === undefined) {
        throw new Error(`OperationsAnalyticsService has no method ${method}`);
      }
      await expect(fn.call(service, range)).resolves.toBeDefined();
    });
  });

  describe('the dependency list is what bounds non-Prisma effects', () => {
    it('OperationsAnalyticsService takes exactly one constructor dependency', () => {
      // A Prisma stub cannot catch a cache write, a queue publish or an HTTP
      // call. Nothing else is injected to make one WITH — that is the part
      // worth pinning. The day a cache client is added here to "memoise the
      // expensive roll-up", this goes red and the read-only claim gets
      // re-examined rather than quietly lapsing.
      expect(OperationsAnalyticsService.length).toBe(1);
    });
  });
});
