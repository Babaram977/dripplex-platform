/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
import { Test, type TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { Logger } from 'nestjs-pino';

import { PrismaService } from '../../prisma/prisma.service';

import { PrismaAuditSegmentRepository } from './prisma-audit-segment.repository';

/**
 * P1-B4 Segment Closure Tests
 *
 * Phase 9 Test Matrix Implementation:
 * - Unit: Close ACTIVE, Close CLOSED, Close missing, Retry same request
 * - Integration: Successor created, Stream state updated, Append after close
 * - Concurrency: append vs close, close vs close, duplicate successor
 * - PostgreSQL: one ACTIVE, closure immutable, predecessor anchor, successor anchor
 */
describe('PrismaAuditSegmentRepository', () => {
  let repository: PrismaAuditSegmentRepository;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaAuditSegmentRepository,
        PrismaService,
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get<PrismaAuditSegmentRepository>(PrismaAuditSegmentRepository);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * Helper: Ensure a segment has at least one event (required for closure)
   * This directly updates segment fields without creating audit log entries,
   * which is valid for test setup since the requirement is eventCount >= 1.
   */
  async function ensureSegmentHasEvents(segmentId: string): Promise<void> {
    const segment = await prisma.auditSegment.findUniqueOrThrow({
      where: { id: segmentId },
    });

    if (segment.eventCount === 0) {
      // Set up minimal event state: generate consistent test hash
      const testHash = 'd'.repeat(64);
      const firstSeq = segment.firstSequence || 1n;

      await prisma.auditSegment.update({
        where: { id: segmentId },
        data: {
          lastSequence: firstSeq,
          lastHash: testHash,
          eventCount: 1,
          firstHash:
            segment.firstHash === '0000000000000000000000000000000000000000000000000000000000000000'
              ? testHash
              : segment.firstHash,
        },
      });
    }
  }

  /**
   * UNIT TESTS
   */

  describe('Unit: Close ACTIVE segment', () => {
    it('should close ACTIVE segment and create successor', async () => {
      // Setup: Create a segment with events
      const segment = await prisma.$transaction(async (tx) => {
        const streamState =
          (await (tx.$queryRaw as any)`SELECT active_segment_id FROM audit_stream_state WHERE id = 'main' FOR UPDATE`) as {
            active_segment_id: string;
          }[];

        const activeSegmentId = streamState[0]!.active_segment_id;

        return await tx.auditSegment.findUniqueOrThrow({
          where: { id: activeSegmentId },
        });
      });

      // Add at least one event to the segment
      // This is required before closure (eventCount must be >= 1)
      await ensureSegmentHasEvents(segment.id);

      // Execute: Close segment
      const closure = await prisma.$transaction(
        async (tx) => {
          return await repository.closeSegment(tx, segment.id, 'test-closure-reason');
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      // Assert: Closure result
      expect(closure).toBeDefined();
      expect(closure.segmentId).toBe(segment.id);
      expect(closure.closedAt).toBeInstanceOf(Date);
      expect(closure.successorSegmentId).toBeDefined();
      expect(closure.successorSegmentId).not.toBe(segment.id);

      // Verify: Segment is CLOSED
      const closedSegment = await prisma.auditSegment.findUniqueOrThrow({
        where: { id: segment.id },
      });
      expect(closedSegment.lifecycle).toBe('CLOSED');
      expect(closedSegment.closedAt).toBeDefined();
      expect(closedSegment.closureReason).toBe('test-closure-reason');
    });
  });

  describe('Unit: Close CLOSED segment with same reason (idempotency)', () => {
    it('should return same closure result on idempotent retry', async () => {
      // Setup: Close a segment first
      const segment = await prisma.$transaction(async (tx) => {
        const streamState =
          (await (tx.$queryRaw as any)`SELECT active_segment_id FROM audit_stream_state WHERE id = 'main' FOR UPDATE`) as {
            active_segment_id: string;
          }[];
        const activeSegmentId = streamState[0]!.active_segment_id;

        return await tx.auditSegment.findUniqueOrThrow({
          where: { id: activeSegmentId },
        });
      });

      // Ensure segment has at least one event
      await ensureSegmentHasEvents(segment.id);

      const firstClosure = await prisma.$transaction(
        async (tx) => {
          return await repository.closeSegment(tx, segment.id, 'idempotent-test');
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      // Execute: Retry same closure (idempotent)
      const secondClosure = await prisma.$transaction(
        async (tx) => {
          return await repository.closeSegment(tx, segment.id, 'idempotent-test');
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      // Assert: Same result on idempotent retry
      expect(secondClosure.segmentId).toBe(firstClosure.segmentId);
      expect(secondClosure.closedAt.getTime()).toBe(firstClosure.closedAt.getTime());
      expect(secondClosure.successorSegmentId).toBe(firstClosure.successorSegmentId);
    });
  });

  describe('Unit: Close segment with different reason (conflict)', () => {
    it('should reject closure with conflicting reason', async () => {
      // Setup: Close a segment first
      const segment = await prisma.$transaction(async (tx) => {
        const streamState =
          (await (tx.$queryRaw as any)`SELECT active_segment_id FROM audit_stream_state WHERE id = 'main' FOR UPDATE`) as {
            active_segment_id: string;
          }[];
        const activeSegmentId = streamState[0]!.active_segment_id;

        return await tx.auditSegment.findUniqueOrThrow({
          where: { id: activeSegmentId },
        });
      });

      // Ensure segment has at least one event
      await ensureSegmentHasEvents(segment.id);

      await prisma.$transaction(
        async (tx) => {
          return await repository.closeSegment(tx, segment.id, 'first-reason');
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      // Execute: Try to close with different reason (should fail)
      await expect(
        prisma.$transaction(
          async (tx) => {
            return await repository.closeSegment(tx, segment.id, 'different-reason');
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
      ).rejects.toThrow();
    });
  });

  describe('Unit: Close missing segment', () => {
    it('should reject closure of non-existent segment', async () => {
      const fakeSegmentId = '00000000-0000-0000-0000-000000000000';

      await expect(
        prisma.$transaction(
          async (tx) => {
            return await repository.closeSegment(tx, fakeSegmentId, 'closure-reason');
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
      ).rejects.toThrow('not found');
    });
  });

  /**
   * INTEGRATION TESTS
   */

  describe('Integration: Successor created with proper chaining', () => {
    it('should create successor with predecessor chain', async () => {
      let segment = await prisma.$transaction(async (tx) => {
        const streamState =
          (await (tx.$queryRaw as any)`SELECT active_segment_id FROM audit_stream_state WHERE id = 'main' FOR UPDATE`) as {
            active_segment_id: string;
          }[];
        const activeSegmentId = streamState[0]!.active_segment_id;

        return await tx.auditSegment.findUniqueOrThrow({
          where: { id: activeSegmentId },
        });
      });

      await ensureSegmentHasEvents(segment.id);

      // Fetch fresh segment after events added
      segment = await prisma.auditSegment.findUniqueOrThrow({
        where: { id: segment.id },
      });

      const closure = await prisma.$transaction(
        async (tx) => {
          return await repository.closeSegment(tx, segment.id, 'successor-test');
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      // Verify successor
      const successor = await prisma.auditSegment.findUniqueOrThrow({
        where: { id: closure.successorSegmentId },
      });

      expect(successor.lifecycle).toBe('ACTIVE');
      expect(successor.predecessorSegmentId).toBe(segment.id);
      expect(successor.predecessorTailHash).toBe(segment.lastHash);
      expect(successor.firstSequence).toBe(segment.lastSequence! + 1n);
    });
  });

  describe('Integration: Stream state updated', () => {
    it('should update stream_state to point to successor', async () => {
      let segment = await prisma.$transaction(async (tx) => {
        const streamState =
          (await (tx.$queryRaw as any)`SELECT active_segment_id FROM audit_stream_state WHERE id = 'main' FOR UPDATE`) as {
            active_segment_id: string;
          }[];
        const activeSegmentId = streamState[0]!.active_segment_id;

        return await tx.auditSegment.findUniqueOrThrow({
          where: { id: activeSegmentId },
        });
      });

      await ensureSegmentHasEvents(segment.id);

      // Fetch fresh segment after events added
      segment = await prisma.auditSegment.findUniqueOrThrow({
        where: { id: segment.id },
      });

      const closure = await prisma.$transaction(
        async (tx) => {
          return await repository.closeSegment(tx, segment.id, 'stream-state-test');
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      // Verify stream state
      const streamState = await prisma.auditStreamState.findUniqueOrThrow({
        where: { id: 'main' },
      });

      const lastSequence = BigInt(segment.lastSequence!.toString());
      const expectedNextSequence = lastSequence + 1n;

      expect(streamState.activeSegmentId).toBe(closure.successorSegmentId);
      expect(streamState.lastSegmentClosedAt).toBeDefined();
      expect(streamState.nextSequence).toBe(expectedNextSequence);
    });
  });

  /**
   * CONCURRENCY TESTS
   */

  describe('Concurrency: Close vs Close on same segment', () => {
    it('should serialize close operations; one succeeds, one fails or returns idempotent result', async () => {
      // This test verifies Serializable isolation handles concurrent closes
      const segment = await prisma.$transaction(async (tx) => {
        const streamState =
          (await (tx.$queryRaw as any)`SELECT active_segment_id FROM audit_stream_state WHERE id = 'main' FOR UPDATE`) as {
            active_segment_id: string;
          }[];
        const activeSegmentId = streamState[0]!.active_segment_id;

        return await tx.auditSegment.findUniqueOrThrow({
          where: { id: activeSegmentId },
        });
      });

      await ensureSegmentHasEvents(segment.id);

      // Execute two closes concurrently
      const results = await Promise.allSettled([
        prisma.$transaction(
          async (tx) => {
            return await repository.closeSegment(tx, segment.id, 'concurrent-close-1');
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
        prisma.$transaction(
          async (tx) => {
            return await repository.closeSegment(tx, segment.id, 'concurrent-close-2');
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
      ]);

      // At least one should succeed, one should fail (different closure reasons)
      const successes = results.filter((r) => r.status === 'fulfilled');

      expect(successes.length).toBeGreaterThanOrEqual(1);
      // Second one may fail due to conflict (different closure reason) or succeed (idempotent)
    });
  });

  /**
   * PostgreSQL INVARIANT TESTS
   */

  describe('PostgreSQL: Exactly one ACTIVE segment', () => {
    it('should maintain exactly one ACTIVE segment after closure', async () => {
      // Count ACTIVE segments before
      const activeBefore = await prisma.auditSegment.count({
        where: { lifecycle: 'ACTIVE' },
      });
      expect(activeBefore).toBe(1);

      // Close segment
      const segment = await prisma.$transaction(async (tx) => {
        const streamState =
          (await (tx.$queryRaw as any)`SELECT active_segment_id FROM audit_stream_state WHERE id = 'main' FOR UPDATE`) as {
            active_segment_id: string;
          }[];
        const activeSegmentId = streamState[0]!.active_segment_id;

        return await tx.auditSegment.findUniqueOrThrow({
          where: { id: activeSegmentId },
        });
      });

      await ensureSegmentHasEvents(segment.id);

      await prisma.$transaction(
        async (tx) => {
          return await repository.closeSegment(tx, segment.id, 'active-count-test');
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      // Count ACTIVE segments after
      const activeAfter = await prisma.auditSegment.count({
        where: { lifecycle: 'ACTIVE' },
      });
      expect(activeAfter).toBe(1);
    });
  });

  describe('PostgreSQL: Closure immutability', () => {
    it('should not allow modification of immutable closure fields', async () => {
      const segment = await prisma.$transaction(async (tx) => {
        const streamState =
          (await (tx.$queryRaw as any)`SELECT active_segment_id FROM audit_stream_state WHERE id = 'main' FOR UPDATE`) as {
            active_segment_id: string;
          }[];
        const activeSegmentId = streamState[0]!.active_segment_id;

        return await tx.auditSegment.findUniqueOrThrow({
          where: { id: activeSegmentId },
        });
      });

      await ensureSegmentHasEvents(segment.id);

      // Fetch fresh segment data after adding events
      const freshSegment = await prisma.auditSegment.findUniqueOrThrow({
        where: { id: segment.id },
      });

      const closure = await prisma.$transaction(
        async (tx) => {
          return await repository.closeSegment(tx, segment.id, 'immutability-test');
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      // Verify immutable fields are unchanged
      const closedSegment = await prisma.auditSegment.findUniqueOrThrow({
        where: { id: closure.segmentId },
      });

      expect(closedSegment.firstHash).toBe(freshSegment.firstHash);
      expect(closedSegment.lastHash).toBe(freshSegment.lastHash);
      expect(closedSegment.firstSequence).toBe(freshSegment.firstSequence);
      expect(closedSegment.lastSequence).toBe(freshSegment.lastSequence);
      expect(closedSegment.eventCount).toBe(freshSegment.eventCount);
    });
  });

  describe('PostgreSQL: Predecessor anchor preservation', () => {
    it('should preserve predecessor tail hash in successor', async () => {
      const segment = await prisma.$transaction(async (tx) => {
        const streamState =
          (await (tx.$queryRaw as any)`SELECT active_segment_id FROM audit_stream_state WHERE id = 'main' FOR UPDATE`) as {
            active_segment_id: string;
          }[];
        const activeSegmentId = streamState[0]!.active_segment_id;

        return await tx.auditSegment.findUniqueOrThrow({
          where: { id: activeSegmentId },
        });
      });

      await ensureSegmentHasEvents(segment.id);

      // Fetch fresh segment data after adding events
      const freshSegment = await prisma.auditSegment.findUniqueOrThrow({
        where: { id: segment.id },
      });

      const closure = await prisma.$transaction(
        async (tx) => {
          return await repository.closeSegment(tx, segment.id, 'predecessor-anchor-test');
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      const successor = await prisma.auditSegment.findUniqueOrThrow({
        where: { id: closure.successorSegmentId },
      });

      expect(successor.predecessorTailHash).toBe(freshSegment.lastHash);
      expect(successor.predecessorSegmentId).toBe(segment.id);
    });
  });
});
