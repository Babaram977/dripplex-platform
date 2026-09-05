import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Segment Authority Service — Class-A Transaction Sequencing
 *
 * Manages the global audit stream state and sequence allocation within
 * Serializable transaction boundaries. Acquires an explicit row lock
 * on audit_stream_state using SELECT...FOR UPDATE to prevent concurrent
 * sequence allocation.
 *
 * Critical: This service is always called FIRST in an append() operation,
 * acquiring the lock that serializes access. All subsequent operations in
 * the transaction run under this lock.
 */
@Injectable()
export class SegmentAuthorityService {
  /**
   * Allocate the next sequence number and obtain current tail hash.
   *
   * Acquires an EXPLICIT row-level lock (SELECT...FOR UPDATE) on the single
   * audit_stream_state row. This lock serializes all sequence allocations.
   *
   * CRITICAL CONTRACT:
   * - Must be called at the BEGINNING of a Serializable transaction
   * - Acquires a EXPLICIT SELECT...FOR UPDATE lock on audit_stream_state
   * - Returns immutable values for rest of transaction
   * - Caller must already be in a Serializable transaction
   * - Lock is held until transaction commit/abort
   *
   * @param tx - Caller-owned Prisma.TransactionClient (must be Serializable)
   * @returns Object with segmentId, sequence (allocated), and predecessorHash (for chain binding)
   * @throws If ACTIVE segment is not actually ACTIVE (concurrent close)
   */
  public async allocateSequenceAndObtainTail(tx: Prisma.TransactionClient): Promise<{
    segmentId: string;
    sequence: bigint;
    predecessorHash: string;
  }> {
    // Step 1: Acquire explicit row lock via SELECT...FOR UPDATE
    // This serializes all sequence allocations to the single row.
    // Raw query within transaction client.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call
    const streamStateResult = (await (tx.$queryRaw as any)`
      SELECT id, "nextSequence", "tailHash", "activeSegmentId"
      FROM audit_stream_state
      WHERE id = 'main'
      FOR UPDATE
    `) as {
      id: string;
      nextSequence: bigint;
      tailHash: string;
      activeSegmentId: string;
    }[];

    if (streamStateResult.length === 0) {
      throw new Error('audit_stream_state row (id="main") not found; cannot allocate sequence');
    }

     
    const streamState = streamStateResult[0];
     
    const nextSequence = BigInt(streamState.nextSequence.toString());
    const predecessorHash = streamState.tailHash;
    const activeSegmentId = streamState.activeSegmentId;

    // Step 2: Validate ACTIVE segment exists and is still ACTIVE
    // This double-check ensures the segment we're about to write to hasn't been closed
    const segment = await tx.auditSegment.findUniqueOrThrow({
      where: { id: activeSegmentId },
    });

    if (segment.lifecycle !== 'ACTIVE') {
      throw new Error(
        `Segment ${activeSegmentId} is not ACTIVE (lifecycle=${segment.lifecycle}); ` +
          `cannot allocate sequence. Segment may have been concurrently closed.`,
      );
    }

    // Step 3: Return the allocated sequence and predecessor hash
    // No side effects here — the actual updates happen after hash calculation
    return {
      segmentId: activeSegmentId,
      sequence: nextSequence,
      predecessorHash: predecessorHash,
    };
  }
}
