import { randomUUID } from 'node:crypto';

import { AuditSegmentLifecycle, PrismaClient } from '@prisma/client';

import { GENESIS_HASH, GENESIS_SEGMENT_ID, STREAM_STATE_ID } from './audit.constants';
import { PrismaAuditSegmentRepository } from './repositories/prisma-audit-segment.repository';
import { SegmentAuthorityService } from './segment-authority.service';

import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * P1-B2 — the audit stream's foundation, against a real database.
 *
 * Every property worth asserting here is a database property: a partial unique
 * index, a CHECK, a row lock. Mocks would only prove the mocks agree with
 * themselves, and the failures this subsystem exists to prevent — two events
 * holding sequence 7, a segment closed with nothing after it — are precisely
 * the ones a mock cannot have.
 *
 * The suite does NOT test an authoritative-write boundary. There is none in
 * this increment, deliberately: see the migration's header.
 */
/** Chosen at module load: `it.skip` must be selected while the describe body runs. */
const DATABASE_CONFIGURED = (process.env['DATABASE_URL'] ?? '') !== '';

describe('P1-B2 audit segments and global sequence', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let authority: SegmentAuthorityService;
  const segmentIds: string[] = [];

  /** A segment that looks like it has been appended to, so it can be closed. */
  async function aFilledSegment(over: {
    firstSequence: bigint;
    lastSequence: bigint;
    lastHash?: string;
    predecessorSegmentId?: string;
  }): Promise<string> {
    const id = randomUUID();
    await prisma.auditSegment.create({
      data: {
        id,
        lifecycle: AuditSegmentLifecycle.CLOSED,
        firstSequence: over.firstSequence,
        lastSequence: over.lastSequence,
        firstHash: 'a'.repeat(64),
        lastHash: over.lastHash ?? 'b'.repeat(64),
        eventCount: Number(over.lastSequence - over.firstSequence + 1n),
        ...(over.predecessorSegmentId === undefined
          ? {}
          : { predecessorSegmentId: over.predecessorSegmentId }),
      },
    });
    segmentIds.push(id);
    return id;
  }

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
    authority = new SegmentAuthorityService(new PrismaAuditSegmentRepository());
    await normaliseStream();
  });

  /**
   * Put the stream back to exactly what the migration creates.
   *
   * Run before the suite as well as after it. These tests mutate a singleton
   * row and the one ACTIVE segment, so a run that died halfway leaves state
   * behind — and a suite that only cleans up afterwards fails on the next run
   * for reasons that have nothing to do with the code under test.
   */
  async function normaliseStream(): Promise<void> {
    await prisma.auditStreamState.update({
      where: { id: STREAM_STATE_ID },
      data: {
        activeSegmentId: GENESIS_SEGMENT_ID,
        nextSequence: 1n,
        tailHash: GENESIS_HASH,
        lastSegmentClosedAt: null,
      },
    });
    await prisma.auditLog.deleteMany({ where: { segmentId: { not: null } } });
    // Newest first: each successor chains to the one before it and the
    // predecessor foreign key is RESTRICT.
    const others = await prisma.auditSegment.findMany({
      where: { id: { not: GENESIS_SEGMENT_ID } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    for (const { id } of others) {
      await prisma.auditSegment.deleteMany({ where: { id } });
    }
    await prisma.auditSegment.update({
      where: { id: GENESIS_SEGMENT_ID },
      data: {
        lifecycle: AuditSegmentLifecycle.ACTIVE,
        closedAt: null,
        closureReason: null,
        lastSequence: null,
        firstHash: GENESIS_HASH,
        lastHash: GENESIS_HASH,
        eventCount: 0,
      },
    });
    segmentIds.length = 0;
  }

  afterAll(async () => {
    if (databaseAvailable) {
      await normaliseStream();
      await prisma.$disconnect();
    }
  });

  /**
   * A DB-backed test either runs against PostgreSQL or is reported as SKIPPED.
   * It must never report PASS after deliberately doing nothing.
   *
   * This used to return early inside a passing `it`, so a run with no database
   * reported every assertion below as green while executing none of them. CI is
   * not exposed — jest-global-setup refuses to start under CI without a
   * reachable database, for exactly this reason — but a local run was silently
   * green, and a suite that cannot tell "proved" from "did not run" is the
   * failure mode this module has already shipped twice.
   *
   * Decided at module load, because `databaseAvailable` is only known after
   * beforeAll and `it.skip` has to be chosen while the describe body runs.
   */
  const maybe = (name: string, fn: () => Promise<void>): void => {
    (DATABASE_CONFIGURED ? it : it.skip)(name, async () => {
      await fn();
    });
  };

  describe('the migration leaves a usable stream', () => {
    maybe('creates exactly one ACTIVE segment and one stream head', async () => {
      const active = await prisma.auditSegment.findMany({
        where: { lifecycle: AuditSegmentLifecycle.ACTIVE },
      });
      expect(active).toHaveLength(1);
      expect(active[0]?.id).toBe(GENESIS_SEGMENT_ID);

      const state = await prisma.auditStreamState.findUniqueOrThrow({
        where: { id: STREAM_STATE_ID },
      });
      expect(state.activeSegmentId).toBe(GENESIS_SEGMENT_ID);
      expect(state.nextSequence).toBe(1n);
      expect(state.tailHash).toBe(GENESIS_HASH);
    });

    maybe('leaves every pre-existing audit row valid and untouched', async () => {
      // The four columns are nullable and the CHECK has an all-NULL branch, so
      // the 404 call sites still writing through record() keep working. A
      // migration that broke them would take down campaign enrolment, payouts
      // and KYC decisions on a platform taking live money.
      const legacy = await prisma.auditLog.create({
        data: { action: 'p1b2.legacy.write', metadata: {} },
      });
      expect(legacy.segmentId).toBeNull();
      expect(legacy.sequence).toBeNull();
      expect(legacy.hash).toBeNull();
      expect(legacy.predecessorHash).toBeNull();
      await prisma.auditLog.delete({ where: { id: legacy.id } });
    });
  });

  describe('segment authority — sequence allocation', () => {
    maybe('hands out the stream head and what the next event chains to', async () => {
      const allocation = await prisma.$transaction(
        async (tx) => await authority.allocateSequenceAndObtainTail(tx),
      );
      expect(allocation.segmentId).toBe(GENESIS_SEGMENT_ID);
      expect(allocation.sequence).toBe(1n);
      expect(allocation.predecessorHash).toBe(GENESIS_HASH);
    });

    maybe('allocates nothing — it reserves, and the caller writes', async () => {
      // A reservation that wrote would make a failed append leave a gap in the
      // sequence, and a gap is indistinguishable from a deleted event to
      // anyone verifying the chain later.
      const before = await prisma.auditStreamState.findUniqueOrThrow({
        where: { id: STREAM_STATE_ID },
      });
      await prisma.$transaction(async (tx) => await authority.allocateSequenceAndObtainTail(tx));
      const after = await prisma.auditStreamState.findUniqueOrThrow({
        where: { id: STREAM_STATE_ID },
      });
      expect(after.nextSequence).toBe(before.nextSequence);
      expect(after.tailHash).toBe(before.tailHash);
    });

    maybe('serialises concurrent allocation: the row lock, not luck', async () => {
      // The whole correctness of the global sequence rests on SELECT ... FOR
      // UPDATE. Without it two transactions read the same next_sequence and
      // the second insert dies on the unique index — an audited write lost at
      // commit time. This drives ten concurrent allocations that each advance
      // the counter, and asserts every one got a distinct number.
      const CONCURRENCY = 10;
      const start = await prisma.auditStreamState.findUniqueOrThrow({
        where: { id: STREAM_STATE_ID },
      });

      const allocate = async (): Promise<bigint> =>
        await prisma.$transaction(async (tx) => {
          const allocation = await authority.allocateSequenceAndObtainTail(tx);
          // Stand in for what append() will do under the same lock.
          await tx.auditStreamState.update({
            where: { id: STREAM_STATE_ID },
            data: { nextSequence: allocation.sequence + 1n },
          });
          return allocation.sequence;
        });

      const sequences = await Promise.all(
        Array.from({ length: CONCURRENCY }, async () => await allocate()),
      );

      expect(new Set(sequences.map(String)).size).toBe(CONCURRENCY);
      const sorted = [...sequences].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      expect(sorted).toEqual(
        Array.from({ length: CONCURRENCY }, (_, i) => start.nextSequence + BigInt(i)),
      );

      await prisma.auditStreamState.update({
        where: { id: STREAM_STATE_ID },
        data: { nextSequence: start.nextSequence, tailHash: start.tailHash },
      });
    });

    maybe('refuses to allocate into a segment that was closed underneath it', async () => {
      const state = await prisma.auditStreamState.findUniqueOrThrow({
        where: { id: STREAM_STATE_ID },
      });
      const stale = await aFilledSegment({ firstSequence: 5000n, lastSequence: 5000n });
      await prisma.auditStreamState.update({
        where: { id: STREAM_STATE_ID },
        data: { activeSegmentId: stale },
      });

      // Appending to a closed segment would place events after its recorded
      // last_sequence, where a verification that trusts the closure anchor
      // will never look at them.
      await expect(
        prisma.$transaction(async (tx) => await authority.allocateSequenceAndObtainTail(tx)),
      ).rejects.toThrow(/not ACTIVE/i);

      await prisma.auditStreamState.update({
        where: { id: STREAM_STATE_ID },
        data: { activeSegmentId: state.activeSegmentId },
      });
    });
  });

  describe('segment authority — closure', () => {
    /** Make the ACTIVE segment look appended-to, so it can legally close. */
    async function fillActive(lastSequence: bigint, lastHash: string): Promise<void> {
      await prisma.auditSegment.update({
        where: { id: GENESIS_SEGMENT_ID },
        data: {
          lastSequence,
          lastHash,
          firstHash: 'a'.repeat(64),
          eventCount: Number(lastSequence),
        },
      });
    }

    maybe('closes the segment, opens its successor, and moves the stream to it', async () => {
      await fillActive(42n, '1'.repeat(64));
      const result = await prisma.$transaction(
        async (tx) => await authority.closeSegment(tx, GENESIS_SEGMENT_ID, 'B2 closure test'),
      );
      segmentIds.push(result.successorSegmentId);

      const closed = await prisma.auditSegment.findUniqueOrThrow({
        where: { id: GENESIS_SEGMENT_ID },
      });
      expect(closed.lifecycle).toBe(AuditSegmentLifecycle.CLOSED);
      expect(closed.closureReason).toBe('B2 closure test');

      const successor = await prisma.auditSegment.findUniqueOrThrow({
        where: { id: result.successorSegmentId },
      });
      expect(successor.lifecycle).toBe(AuditSegmentLifecycle.ACTIVE);
      // The global sequence continues across the boundary rather than
      // restarting: a restart would collide in the global unique index.
      expect(successor.firstSequence).toBe(43n);
      expect(successor.predecessorSegmentId).toBe(GENESIS_SEGMENT_ID);
      // The join between the two segments, verifiable without reading the
      // predecessor's rows — which is what a purge eventually removes.
      expect(successor.predecessorTailHash).toBe('1'.repeat(64));

      const state = await prisma.auditStreamState.findUniqueOrThrow({
        where: { id: STREAM_STATE_ID },
      });
      expect(state.activeSegmentId).toBe(result.successorSegmentId);
      expect(state.lastSegmentClosedAt).not.toBeNull();
    });

    maybe('leaves the stream tail alone, so the chain survives the boundary', async () => {
      // Closing appends no event, so the tail has not moved. Resetting it to a
      // genesis value would sever the chain at every boundary while leaving
      // each segment internally consistent — a break that verifies clean per
      // segment and fails only across the join.
      const before = await prisma.auditStreamState.findUniqueOrThrow({
        where: { id: STREAM_STATE_ID },
      });
      const active = await prisma.auditSegment.findFirstOrThrow({
        where: { lifecycle: AuditSegmentLifecycle.ACTIVE },
      });
      await prisma.auditSegment.update({
        where: { id: active.id },
        data: { lastSequence: 99n, lastHash: '2'.repeat(64), eventCount: 5 },
      });
      await prisma.auditStreamState.update({
        where: { id: STREAM_STATE_ID },
        data: { tailHash: '2'.repeat(64) },
      });

      const result = await prisma.$transaction(
        async (tx) => await authority.closeSegment(tx, active.id, 'tail continuity'),
      );
      segmentIds.push(result.successorSegmentId);

      const after = await prisma.auditStreamState.findUniqueOrThrow({
        where: { id: STREAM_STATE_ID },
      });
      expect(after.tailHash).toBe('2'.repeat(64));
      expect(after.tailHash).not.toBe(GENESIS_HASH);
      // And the successor records the same hash as its inbound link, so the
      // two agree about where the chain crosses.
      const successor = await prisma.auditSegment.findUniqueOrThrow({
        where: { id: result.successorSegmentId },
      });
      expect(successor.predecessorTailHash).toBe(after.tailHash);
      void before;
    });

    maybe('is idempotent for the same reason, and refuses a different one', async () => {
      const active = await prisma.auditSegment.findFirstOrThrow({
        where: { lifecycle: AuditSegmentLifecycle.ACTIVE },
      });
      await prisma.auditSegment.update({
        where: { id: active.id },
        data: { lastSequence: 150n, lastHash: '3'.repeat(64), eventCount: 3 },
      });

      const first = await prisma.$transaction(
        async (tx) => await authority.closeSegment(tx, active.id, 'quarterly rotation'),
      );
      segmentIds.push(first.successorSegmentId);

      const retry = await prisma.$transaction(
        async (tx) => await authority.closeSegment(tx, active.id, 'quarterly rotation'),
      );
      expect(retry.successorSegmentId).toBe(first.successorSegmentId);
      expect(retry.closedAt.getTime()).toBe(first.closedAt.getTime());

      // The reason is a governance record. Accepting a second, different one
      // would let whoever asked last rewrite why the segment was closed.
      await expect(
        prisma.$transaction(
          async (tx) => await authority.closeSegment(tx, active.id, 'a different reason entirely'),
        ),
      ).rejects.toThrow(/not ACTIVE/i);
    });

    maybe('refuses to close a segment holding no events', async () => {
      const active = await prisma.auditSegment.findFirstOrThrow({
        where: { lifecycle: AuditSegmentLifecycle.ACTIVE },
      });
      expect(active.eventCount).toBe(0);
      // An empty segment has no tail to anchor its successor to. Closing one
      // would hand the successor a genesis placeholder as its inbound link.
      await expect(
        prisma.$transaction(async (tx) => await authority.closeSegment(tx, active.id, 'empty')),
      ).rejects.toThrow(/no events/i);
    });

    maybe('never leaves the stream with two ACTIVE segments or none', async () => {
      const active = await prisma.auditSegment.findMany({
        where: { lifecycle: AuditSegmentLifecycle.ACTIVE },
      });
      expect(active).toHaveLength(1);
      const state = await prisma.auditStreamState.findUniqueOrThrow({
        where: { id: STREAM_STATE_ID },
      });
      expect(state.activeSegmentId).toBe(active[0]?.id);
    });
  });

  describe('constraints the database enforces, not the application', () => {
    maybe('refuses a second ACTIVE segment', async () => {
      const id = randomUUID();
      await expect(
        prisma.auditSegment.create({
          data: {
            id,
            lifecycle: AuditSegmentLifecycle.ACTIVE,
            firstSequence: 500n,
            firstHash: GENESIS_HASH,
            lastHash: GENESIS_HASH,
          },
        }),
      ).rejects.toThrow();
      expect(await prisma.auditSegment.findUnique({ where: { id } })).toBeNull();
    });

    maybe('allows many CLOSED segments to coexist', async () => {
      const first = await aFilledSegment({ firstSequence: 1000n, lastSequence: 1001n });
      const second = await aFilledSegment({ firstSequence: 1002n, lastSequence: 1003n });
      expect(first).not.toBe(second);
      expect(await prisma.auditSegment.count({ where: { id: { in: [first, second] } } })).toBe(2);
    });

    maybe('refuses a partially authoritative row', async () => {
      const segmentId = await aFilledSegment({ firstSequence: 2000n, lastSequence: 2000n });
      // A sequence with no hash cannot be verified; a hash with no sequence has
      // no place in the chain. Either would be found at verification time,
      // which is years too late.
      await expect(
        prisma.$executeRaw`
          INSERT INTO audit_logs (id, action, metadata, segment_id, sequence)
          VALUES (gen_random_uuid(), 'p1b2.partial', '{}'::jsonb, ${segmentId}::uuid, 2000)
        `,
      ).rejects.toThrow();
    });

    maybe('refuses the same global sequence twice, across different segments', async () => {
      // The sequence is global. Per-segment uniqueness alone would allow
      // sequence 7 in two segments, and "event 7" would stop naming one event.
      const a = await aFilledSegment({ firstSequence: 3000n, lastSequence: 3000n });
      const b = await aFilledSegment({ firstSequence: 3001n, lastSequence: 3001n });
      const write = (segmentId: string): Promise<number> => prisma.$executeRaw`
        INSERT INTO audit_logs (id, action, metadata, segment_id, sequence, hash, predecessor_hash)
        VALUES (gen_random_uuid(), 'p1b2.global', '{}'::jsonb, ${segmentId}::uuid, 9000,
                ${'c'.repeat(64)}, ${'d'.repeat(64)})
      `;
      await write(a);
      await expect(write(b)).rejects.toThrow();
      await prisma.$executeRaw`DELETE FROM audit_logs WHERE sequence = 9000`;
    });

    maybe('refuses to delete a segment that audit rows still point at', async () => {
      const segmentId = await aFilledSegment({ firstSequence: 4000n, lastSequence: 4000n });
      await prisma.$executeRaw`
        INSERT INTO audit_logs (id, action, metadata, segment_id, sequence, hash, predecessor_hash)
        VALUES (gen_random_uuid(), 'p1b2.restrict', '{}'::jsonb, ${segmentId}::uuid, 9100,
                ${'e'.repeat(64)}, ${'f'.repeat(64)})
      `;
      // RESTRICT, not CASCADE: tidying a segment away must not take its
      // evidence with it.
      await expect(prisma.auditSegment.delete({ where: { id: segmentId } })).rejects.toThrow();
      await prisma.$executeRaw`DELETE FROM audit_logs WHERE sequence = 9100`;
    });
  });
});
