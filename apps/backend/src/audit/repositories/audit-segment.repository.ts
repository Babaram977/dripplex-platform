import type { Prisma } from '@prisma/client';

export interface ClosureResult {
  segmentId: string;
  closedAt: Date;
  successorSegmentId: string;
}

/**
 * P1-B2 — closing a segment of the audit stream.
 *
 * Closure is the only lifecycle transition in this increment. Archive, verify
 * and purge are B8's, and are deliberately absent: a segment that can be
 * archived before anything can append to it is a subsystem with nothing to
 * archive.
 */
export interface AuditSegmentRepository {
  /**
   * Close the ACTIVE segment and create its successor, atomically.
   *
   * Contract:
   * - Runs inside a caller-owned transaction, and must never open its own.
   *   The caller holds the `audit_stream_state` row lock; taking a second
   *   transaction here would deadlock against it.
   * - Closure, successor creation and the stream-state update are one unit.
   *   A closed segment with no successor leaves the stream with nowhere to
   *   append, which is an outage of every audited write.
   * - Idempotent for the same closure reason: a retry returns the original
   *   result rather than closing twice.
   */
  closeSegment(
    tx: Prisma.TransactionClient,
    segmentId: string,
    closureReason: string,
  ): Promise<ClosureResult>;
}

export const AUDIT_SEGMENT_REPOSITORY = Symbol('AuditSegmentRepository');
