import { OperationsPayoutsService } from './operations-payouts.service';

import type { PrismaService } from '../prisma/prisma.service';

/**
 * DPX-OPS — the payout queue reads must not write.
 *
 * WRITTEN BEFORE THE UI PORT. This slice is money-adjacent: the queue is a
 * list of people waiting to be paid, and `PayoutRequestDto` carries an
 * `actionPath` — the endpoint where each request is approved. A payload whose
 * own field points at a mutation is the strongest invitation in this migration
 * to let a read quietly become a write, so the read is pinned as a read first.
 *
 * WHAT IT DOES NOT CLAIM: that approving a payout is safe or unsafe. Approval
 * lives behind different endpoints and different permissions, is NOT part of
 * this capability, and is not ported. The standalone console renders
 * `actionPath` as monospace text and offers no approve or reject control
 * anywhere on that page — so a read-only port is capability parity, not an
 * under-port.
 *
 * Structural half: OperationsPayoutsService takes PrismaService as its ONLY
 * constructor dependency, so nothing is injected that could move money,
 * notify a payee or enqueue a transfer. Pinned by an arity test, because a
 * Prisma stub cannot see effects that do not travel through Prisma.
 *
 * Behavioural half: both methods run against a stub whose write verbs throw
 * and which refuses a read nobody declared.
 *
 * NOTE FOR WHOEVER MERGES AFTER #434/#435: both carry an identical
 * `readOnlyPrisma`. Three copies now. They are duplicated only because the
 * branches are independent; factor them into one shared test helper once they
 * are all on main.
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
    super(`A read-only payout path attempted a WRITE: ${what}`);
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
                `${modelName}.${method} — not a fixture; a new database call appeared in a read-only payout path`,
              );
            }
            return () => Promise.resolve(supplied);
          },
        },
      );
    },
  }) as unknown as PrismaService;
}

/** Every model/verb the payout service reads, all answering empty. */
const EMPTY_READS: Record<string, Record<string, unknown>> = {
  withdrawalRequest: { findMany: [] },
  fleetSettlementRequest: { findMany: [] },
  wallet: { findMany: [] },
};

describe('Payout queue reads perform no writes', () => {
  let service: OperationsPayoutsService;

  beforeEach(() => {
    service = new OperationsPayoutsService(readOnlyPrisma(EMPTY_READS));
  });

  describe('the stub itself refuses writes — otherwise every test below is vacuous', () => {
    it('throws when a write verb is called', () => {
      expect(() => probe(readOnlyPrisma({}))['withdrawalRequest']?.['update']?.({})).toThrow(
        /attempted a WRITE: withdrawalRequest\.update/,
      );
    });

    it('throws on an interactive transaction — how a payout WOULD be written', () => {
      expect(() => probe(readOnlyPrisma({})).$transaction([])).toThrow(
        /attempted a WRITE: \$transaction/,
      );
    });

    it('throws on a read nobody declared', () => {
      expect(() => probe(readOnlyPrisma({}))['wallet']?.['aggregate']?.({})).toThrow(
        /not a fixture/,
      );
    });
  });

  describe('GET /operations/finance/payout-requests', () => {
    it('lists without writing anything', async () => {
      await expect(service.list({ page: 1, pageSize: 25 })).resolves.toBeDefined();
    });

    it('writes nothing when filtered by requester or status either', async () => {
      await expect(
        service.list({ page: 1, pageSize: 25, requesterType: 'FLEET_OWNER', status: 'PENDING' }),
      ).resolves.toBeDefined();
    });
  });

  describe('GET /operations/finance/payout-requests/summary', () => {
    it('summarises without writing anything', async () => {
      await expect(service.summary()).resolves.toBeDefined();
    });
  });

  describe('the dependency list is what bounds non-Prisma effects', () => {
    it('OperationsPayoutsService takes exactly one constructor dependency', () => {
      // Money-adjacent, so this matters more here than anywhere else in the
      // migration: nothing is injected that could initiate a transfer, notify
      // a payee or enqueue a job. The day a payments client is added to this
      // constructor, this goes red and the read-only claim is re-examined
      // rather than quietly lapsing.
      expect(OperationsPayoutsService.length).toBe(1);
    });
  });
});
