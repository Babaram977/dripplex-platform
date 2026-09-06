import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaAuditSegmentRepository } from './repositories/prisma-audit-segment.repository';

import type { ClosureResult } from './repositories/audit-segment.repository';

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
 *
 * Also manages segment closure: coordinating the transition from ACTIVE
 * to CLOSED and atomic creation of successor segments.
 */
@Injectable()
export class SegmentAuthorityService {
  constructor(private readonly auditSegmentRepository: PrismaAuditSegmentRepository) {}
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
    // Raw query within transaction client using snake_case PostgreSQL column names.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call
    const streamStateResult = (await (tx.$queryRaw as any)`
      SELECT id, next_sequence, tail_hash, active_segment_id
      FROM audit_stream_state
      WHERE id = 'main'
      FOR UPDATE
    `) as {
      id: string;
      next_sequence: bigint;
      tail_hash: string;
      active_segment_id: string;
    }[];

    if (streamStateResult.length === 0) {
      throw new Error('audit_stream_state row (id="main") not found; cannot allocate sequence');
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const streamState = streamStateResult[0]!;
    const nextSequence = BigInt(streamState.next_sequence.toString());
    const predecessorHash = streamState.tail_hash;
    const activeSegmentId = streamState.active_segment_id;

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

  /**
   * Close the ACTIVE segment and atomically create its successor.
   *
   * Delegates to PrismaAuditSegmentRepository to execute the closure atomically
   * within a Serializable transaction.
   *
   * CRITICAL CONTRACT:
   * - Must be called within a Serializable transaction
   * - Must use supplied tx parameter
   * - Must NOT open nested $transaction()
   * - Closure and successor creation are atomic (all-or-nothing)
   *
   * Authorization: The caller (typically AuditService via AuditController) is responsible
   * for ensuring the user has audit_segment:close permission. This service is the final
   * authority and re-validates the operation's validity (segment ACTIVE, closure reason, etc.).
   *
   * @param tx - Caller-owned Prisma.TransactionClient (must be Serializable)
   * @param segmentId - The ACTIVE segment to close
   * @param closureReason - Governance reason for closure
   * @returns ClosureResult with segmentId, closedAt, and successorSegmentId
   * @throws If segment not ACTIVE, closure fails, or transaction boundaries violated
   */
  public async closeSegment(
    tx: Prisma.TransactionClient,
    segmentId: string,
    closureReason: string,
  ): Promise<ClosureResult> {
    return await this.auditSegmentRepository.closeSegment(tx, segmentId, closureReason);
  }
}
