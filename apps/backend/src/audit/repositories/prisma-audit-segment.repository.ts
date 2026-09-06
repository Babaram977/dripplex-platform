import { randomUUID } from 'crypto';

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { AuditSegmentRepository, ClosureResult } from './audit-segment.repository';

/**
 * Prisma Implementation of Audit Segment Repository
 *
 * Implements Class-A Serializable transaction semantics for segment closure.
 * All operations must participate in a caller-owned transaction and follow
 * the strict atomic pattern: closure + successor creation + stream_state update.
 */
@Injectable()
export class PrismaAuditSegmentRepository implements AuditSegmentRepository {
  /**
   * Close an ACTIVE segment and atomically create its successor.
   *
   * Atomic sequence within Serializable transaction:
   * 1. Lock stream_state (implicit by SELECT...FOR UPDATE in caller context)
   * 2. Fetch ACTIVE segment by ID (verify ACTIVE lifecycle, capture tail)
   * 3. Check idempotency: if already closed with same reason, return cached result
   * 4. If closed with different reason, reject (conflict)
   * 5. Capture immutable closure anchor: all four fields (firstSequence, lastSequence, firstHash, lastHash, eventCount)
   * 6. Close segment: UPDATE SET lifecycle='CLOSED', closedAt=NOW(), closureReason
   * 7. Create successor: INSERT new ACTIVE segment with firstSequence=predecessor.lastSequence+1
   * 8. Update stream_state: SET activeSegmentId=successor.id, lastSegmentClosedAt=NOW()
   * 9. Return ClosureResult
   *
   * All 9 steps are atomic. No partial state permitted.
   *
   * @param tx - Prisma.TransactionClient (must be in Serializable transaction)
   * @param segmentId - Segment to close
   * @param closureReason - Governance reason for closure
   * @returns ClosureResult
   * @throws If segment not ACTIVE, closure reason conflicts, or any step fails
   */
  public async closeSegment(
    tx: Prisma.TransactionClient,
    segmentId: string,
    closureReason: string,
  ): Promise<ClosureResult> {
    // Step 1: Fetch segment by ID to validate ACTIVE and capture tail
    const segment = await tx.auditSegment.findUnique({
      where: { id: segmentId },
    });

    if (!segment) {
      throw new Error(`Segment ${segmentId} not found. Cannot close non-existent segment.`);
    }

    if (segment.lifecycle !== 'ACTIVE') {
      // Step 2: Check idempotency for already-closed segments
      if (segment.lifecycle === 'CLOSED' && segment.closureReason === closureReason) {
        // Idempotent: same closure reason on already-closed segment returns same result
        // Create synthetic successor ID by fetching actual successor (should exist)
        const successor = await tx.auditSegment.findFirst({
          where: { predecessorSegmentId: segmentId },
          orderBy: { createdAt: 'asc' },
        });

        if (successor && segment.closedAt) {
          return {
            segmentId: segment.id,
            closedAt: segment.closedAt,
            successorSegmentId: successor.id,
          };
        }

        throw new Error(
          `Segment ${segmentId} is CLOSED but no successor found. Data integrity error.`,
        );
      }

      // Different closure reason or different lifecycle state: conflict
      throw new Error(
        `Segment ${segmentId} is not ACTIVE (lifecycle=${segment.lifecycle}). ` +
          `Cannot close. If already closed with different reason, operation rejected.`,
      );
    }

    // Step 3: Validate segment has content (eventCount >= 1 for closure)
    const lastSeq = segment.lastSequence;
    if (lastSeq === null || segment.eventCount === 0) {
      const lastSeqStr = lastSeq?.toString() ?? 'null';
      const eventCountStr = segment.eventCount.toString();
      throw new Error(
        `Segment ${segmentId} has no events (lastSequence=${lastSeqStr}, eventCount=${eventCountStr}). ` +
          `Cannot close segment without events.`,
      );
    }

    // Step 4: Capture immutable closure anchor (all required fields)
    // At this point, lastSeq is guaranteed to be non-null due to the check above
    const closureAnchor = {
      firstSequence: segment.firstSequence,
      lastSequence: lastSeq,
      firstHash: segment.firstHash,
      lastHash: segment.lastHash,
      eventCount: segment.eventCount,
      predecessorTailHash: segment.predecessorTailHash,
    };

    // Step 5: Close segment atomically
    const now = new Date();
    const closedSegment = await tx.auditSegment.update({
      where: { id: segmentId },
      data: {
        lifecycle: 'CLOSED',
        closedAt: now,
        closureReason,
        // DO NOT modify firstHash, lastHash, firstSequence, lastSequence, eventCount (immutable)
      },
    });

    // Step 6: Create successor ACTIVE segment
    const successorId = randomUUID();
    const nextSequence = closureAnchor.lastSequence + 1n;

    const successor = await tx.auditSegment.create({
      data: {
        id: successorId,
        lifecycle: 'ACTIVE',
        firstSequence: nextSequence,
        lastSequence: null, // Will be set on first event append
        firstHash: '0000000000000000000000000000000000000000000000000000000000000000', // Will be set on first event
        lastHash: '0000000000000000000000000000000000000000000000000000000000000000', // Will be set on first event
        eventCount: 0,
        predecessorSegmentId: segmentId,
        predecessorTailHash: closureAnchor.lastHash, // Capture predecessor's tail at closure time
      },
    });

    // Step 7: Update stream_state to point to new ACTIVE segment
    await tx.auditStreamState.update({
      where: { id: 'main' },
      data: {
        activeSegmentId: successor.id,
        lastSegmentClosedAt: now,
        nextSequence: nextSequence, // Reset to first sequence of new segment
        tailHash: '0000000000000000000000000000000000000000000000000000000000000000', // Reset to genesis for new segment
      },
    });

    // Step 8: Return closure result
    // closedSegment.closedAt is guaranteed to be non-null since we set it in the UPDATE statement
    const closedAt = closedSegment.closedAt ?? now;
    return {
      segmentId: closedSegment.id,
      closedAt,
      successorSegmentId: successor.id,
    };
  }
}
