import { type Prisma } from '@prisma/client';

export interface ClosureResult {
  segmentId: string;
  closedAt: Date;
  successorSegmentId: string;
}

export interface AuditSegmentRepository {
  /**
   * Close an ACTIVE segment and atomically create its successor within a transaction.
   *
   * CRITICAL CONTRACT:
   * - Must be called within a Serializable transaction
   * - Must use supplied tx parameter, never root Prisma client
   * - Must NOT open nested $transaction()
   * - Closure and successor creation are atomic (all-or-nothing)
   * - Idempotency: same (segmentId, closureReason) pair returns same result
   * - Conflict: different closure reason on already-closed segment is rejected
   *
   * Flow:
   * 1. Validate ACTIVE segment exists and matches requested ID
   * 2. Validate segment has not already been closed (check lifecycle)
   * 3. Capture immutable closure anchor (firstSequence, lastSequence, firstHash, lastHash, eventCount)
   * 4. Close segment: SET lifecycle='CLOSED', closedAt=NOW(), closureReason, leave firstHash/lastHash immutable
   * 5. Create successor: new ACTIVE segment with firstSequence=predecessor.lastSequence+1, chained via predecessorSegmentId
   * 6. Update stream_state: SET activeSegmentId=successor.id, lastSegmentClosedAt=NOW()
   * 7. Return closure result (segmentId, closedAt, successorSegmentId)
   *
   * @param tx - Caller-owned Prisma.TransactionClient (must be Serializable)
   * @param segmentId - The segment to close
   * @param closureReason - Governance reason for closure
   * @returns ClosureResult with segmentId, closedAt, successorSegmentId
   * @throws If segment not ACTIVE, already closed, or closure reason conflicts
   */
  closeSegment(
    tx: Prisma.TransactionClient,
    segmentId: string,
    closureReason: string,
  ): Promise<ClosureResult>;
}

export const AUDIT_SEGMENT_REPOSITORY = Symbol('AuditSegmentRepository');
