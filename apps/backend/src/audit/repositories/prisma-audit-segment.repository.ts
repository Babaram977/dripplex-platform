import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { AuditSegmentLifecycle } from '@prisma/client';

import { GENESIS_HASH, STREAM_STATE_ID } from '../audit.constants';

import type { AuditSegmentRepository, ClosureResult } from './audit-segment.repository';
import type { Prisma } from '@prisma/client';

/**
 * P1-B2 — segment closure against PostgreSQL.
 *
 * Every step runs on the caller's transaction client. The caller has already
 * taken `SELECT ... FOR UPDATE` on the stream-state row, so this code is
 * serialised against any concurrent append or closure by the database rather
 * than by hoping the two never coincide.
 */
@Injectable()
export class PrismaAuditSegmentRepository implements AuditSegmentRepository {
  public async closeSegment(
    tx: Prisma.TransactionClient,
    segmentId: string,
    closureReason: string,
  ): Promise<ClosureResult> {
    const segment = await tx.auditSegment.findUnique({ where: { id: segmentId } });
    if (segment === null) {
      throw new Error(`Audit segment ${segmentId} not found`);
    }

    if (segment.lifecycle !== AuditSegmentLifecycle.ACTIVE) {
      // A retry of the same closure is not an error. A closure that already
      // happened for a different stated reason is: the reason is governance
      // record, and quietly accepting a second one would let the record be
      // rewritten by whoever asked last.
      if (
        segment.lifecycle === AuditSegmentLifecycle.CLOSED &&
        segment.closureReason === closureReason &&
        segment.closedAt !== null
      ) {
        const successor = await tx.auditSegment.findFirst({
          where: { predecessorSegmentId: segmentId },
          orderBy: { createdAt: 'asc' },
        });
        if (successor === null) {
          throw new Error(
            `Audit segment ${segmentId} is CLOSED but has no successor. The stream has ` +
              `nowhere to append; this is a data-integrity failure, not a retry.`,
          );
        }
        return {
          segmentId: segment.id,
          closedAt: segment.closedAt,
          successorSegmentId: successor.id,
        };
      }

      throw new Error(
        `Audit segment ${segmentId} is ${segment.lifecycle}, not ACTIVE, and cannot be closed`,
      );
    }

    // An empty segment has no tail to anchor its successor to, and nothing for
    // an archive to contain. Closing one would produce a segment whose
    // predecessorTailHash is the genesis placeholder rather than a real event.
    if (segment.lastSequence === null || segment.eventCount === 0) {
      throw new Error(
        `Audit segment ${segmentId} holds no events and cannot be closed ` +
          `(eventCount=${String(segment.eventCount)})`,
      );
    }

    const now = new Date();

    // firstHash, lastHash, firstSequence, lastSequence and eventCount are NOT
    // written here. They are the closure anchor: what the archive is verified
    // against later, and what a tamper check compares. Closure records that the
    // segment ended, never what it contained.
    const closed = await tx.auditSegment.update({
      where: { id: segmentId },
      data: { lifecycle: AuditSegmentLifecycle.CLOSED, closedAt: now, closureReason },
    });

    const successor = await tx.auditSegment.create({
      data: {
        id: randomUUID(),
        lifecycle: AuditSegmentLifecycle.ACTIVE,
        // The global sequence continues across the boundary. It does not
        // restart: a sequence that restarted per segment would collide with
        // the previous segment's numbers in the global unique index, and
        // "event 7" would stop identifying one event.
        firstSequence: segment.lastSequence + 1n,
        lastSequence: null,
        // Placeholders until the successor's first event lands. The real link
        // to the predecessor is predecessorTailHash below, which is why these
        // being genesis values costs nothing.
        firstHash: GENESIS_HASH,
        lastHash: GENESIS_HASH,
        eventCount: 0,
        predecessorSegmentId: segment.id,
        predecessorTailHash: segment.lastHash,
      },
    });

    // The stream's tail hash is deliberately left alone. Closing a segment
    // appends no event, so the tail of the stream has not moved — and the next
    // event must chain to the last real event, not to a genesis value. Resetting
    // it here would sever the hash chain at every segment boundary while leaving
    // each segment internally consistent, which is the kind of break that
    // verifies clean per segment and fails only across the join.
    await tx.auditStreamState.update({
      where: { id: STREAM_STATE_ID },
      data: { activeSegmentId: successor.id, lastSegmentClosedAt: now },
    });

    return {
      segmentId: closed.id,
      closedAt: closed.closedAt ?? now,
      successorSegmentId: successor.id,
    };
  }
}
