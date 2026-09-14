import { Injectable } from '@nestjs/common';
import { AuditSegmentLifecycle } from '@prisma/client';

import { STREAM_STATE_ID } from './audit.constants';
import { PrismaAuditSegmentRepository } from './repositories/prisma-audit-segment.repository';

import type { ClosureResult } from './repositories/audit-segment.repository';
import type { Prisma } from '@prisma/client';

/** What an appender needs to write one event: where it goes, what number it
 *  takes, and what it chains to. */
export interface SequenceAllocation {
  segmentId: string;
  sequence: bigint;
  predecessorHash: string;
}

/**
 * P1-B2 — the authority over the audit stream's sequence and segments.
 *
 * The global sequence is allocated here and nowhere else. Correctness rests on
 * one thing: the `SELECT ... FOR UPDATE` below. Two transactions that both read
 * `next_sequence` without it would be handed the same number, and the second
 * insert would fail the global unique index — turning a silent duplicate into a
 * visible error, which is better, but still an audited write lost at commit
 * time. The lock makes the second transaction wait instead.
 *
 * It is deliberately a lock and not an application mutex: this backend runs
 * more than one instance, and a mutex in one process serialises nothing.
 */
@Injectable()
export class SegmentAuthorityService {
  constructor(private readonly segments: PrismaAuditSegmentRepository) {}

  /**
   * Take the stream lock, allocate the next global sequence, and return what
   * the new event must chain to.
   *
   * Must be called first in the appending transaction, and the caller must
   * already be inside one. Nothing is written here: the returned values are a
   * reservation that the caller's own insert makes real, and the lock is held
   * until that transaction commits or rolls back.
   */
  public async allocateSequenceAndObtainTail(
    tx: Prisma.TransactionClient,
  ): Promise<SequenceAllocation> {
    // Raw, because Prisma has no FOR UPDATE. Parameterised rather than
    // interpolated even though the only value is a constant — an id that
    // becomes configurable later must not become an injection point by
    // inheriting this line.
    const rows = await tx.$queryRaw<
      { next_sequence: bigint; tail_hash: string; active_segment_id: string }[]
    >`
      SELECT next_sequence, tail_hash, active_segment_id
      FROM audit_stream_state
      WHERE id = ${STREAM_STATE_ID}
      FOR UPDATE
    `;

    const state = rows[0];
    if (state === undefined) {
      throw new Error(
        `Audit stream state "${STREAM_STATE_ID}" not found. The stream has no head, so no ` +
          `sequence can be allocated.`,
      );
    }

    // Re-read the segment under the lock. Between one append and the next the
    // ACTIVE segment can have been closed, and appending to a closed segment
    // would put events after its recorded last_sequence — invisible to a
    // verification that trusts the closure anchor.
    const segment = await tx.auditSegment.findUniqueOrThrow({
      where: { id: state.active_segment_id },
    });
    if (segment.lifecycle !== AuditSegmentLifecycle.ACTIVE) {
      throw new Error(
        `Audit segment ${segment.id} is ${segment.lifecycle}, not ACTIVE. It was closed ` +
          `concurrently; retry to pick up its successor.`,
      );
    }

    return {
      segmentId: state.active_segment_id,
      // Already a bigint: Prisma returns PostgreSQL BIGINT as bigint, and
      // wrapping it again would only look like a conversion.
      sequence: state.next_sequence,
      predecessorHash: state.tail_hash,
    };
  }

  /**
   * Close a segment and open its successor.
   *
   * Authorisation belongs to the caller. This service is the integrity
   * authority, not the permission one: it decides whether a closure is
   * coherent, never whether the person asking may perform it.
   */
  public async closeSegment(
    tx: Prisma.TransactionClient,
    segmentId: string,
    closureReason: string,
  ): Promise<ClosureResult> {
    return await this.segments.closeSegment(tx, segmentId, closureReason);
  }
}
