import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Segment Authority Service — Class-A Transaction Sequencing
 *
 * Manages the global audit stream state and sequence allocation within
 * Serializable transaction boundaries. Holds a single-row lock on
 * audit_stream_state to prevent concurrent sequence allocation.
 *
 * Critical: This service is always called FIRST in an append() operation,
 * acquiring the lock that prevents concurrent modifications. All subsequent
 * operations in the transaction run under this lock.
 */
@Injectable()
export class SegmentAuthorityService {
  /**
   * Allocate the next sequence number and obtain current tail hash.
   *
   * CRITICAL CONTRACT:
   * - Must be called at the BEGINNING of a Serializable transaction
   * - Acquires an implicit lock on audit_stream_state (no explicit SELECT...FOR UPDATE needed in Serializable)
   * - Returns immutable values for rest of transaction
   * - Caller must already be in a Serializable transaction
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
    // Step 1: Read stream state (implicit lock in Serializable tx)
    const streamState = await tx.auditStreamState.findUniqueOrThrow({
      where: { id: 'main' },
    });

    const nextSequence = streamState.nextSequence;
    const predecessorHash = streamState.tailHash;
    const activeSegmentId = streamState.activeSegmentId;

    // Step 2: Validate ACTIVE segment exists and is still ACTIVE
    // This double-check ensures the segment we're about to write to hasn't been closed concurrently
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
