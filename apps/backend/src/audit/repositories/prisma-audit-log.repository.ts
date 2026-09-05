import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditChainService } from '../audit-chain.service';
import { SegmentAuthorityService } from '../segment-authority.service';

import type {
  AuditLogRecord,
  AuditLogRepository,
  AuditEventForAppend,
  CreateAuditLogInput,
} from './audit-log.repository';

@Injectable()
export class PrismaAuditLogRepository implements AuditLogRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly segmentAuthorityService: SegmentAuthorityService,
    private readonly auditChainService: AuditChainService,
  ) {}

  /**
   * Create an audit log entry outside any transaction (legacy path).
   *
   * Uses the root Prisma client. Not authoritative for Class-A operations.
   *
   * @deprecated Use append(tx, event) for authoritative Class-A audit.
   */
  public async create(input: CreateAuditLogInput): Promise<AuditLogRecord> {
    return await this.prisma.auditLog.create({
      data: {
        action: input.action,
        ...(input.userId !== undefined ? { userId: input.userId } : {}),
        ...(input.resource !== undefined ? { resource: input.resource } : {}),
        ...(input.resourceId !== undefined ? { resourceId: input.resourceId } : {}),
        ...(input.ipAddress !== undefined ? { ipAddress: input.ipAddress } : {}),
        ...(input.userAgent !== undefined ? { userAgent: input.userAgent } : {}),
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      },
    });
  }

  /**
   * Append an authoritative audit event within a transaction.
   *
   * Class-A Transaction (Serializable) sequence:
   * 1. Allocate sequence and obtain tail from stream state (lock acquired here)
   * 2. Calculate event hash (deterministic, cryptographically bound)
   * 3. Insert audit_log with all authoritative fields (segment, sequence, hash, predecessor)
   * 4. Update segment tail (lastSequence, lastHash, eventCount)
   * 5. Update stream state (nextSequence, tailHash)
   *
   * All 5 steps complete or all roll back atomically. No orphaned events.
   *
   * CRITICAL CONTRACT:
   * - MUST use the supplied tx parameter
   * - MUST NOT call this.prisma.* (root client)
   * - MUST NOT open a nested $transaction()
   * - Participates in the caller's Serializable transaction
   * - Caller must use isolationLevel: Serializable
   *
   * @param tx - Caller-owned Prisma.TransactionClient (must be Serializable)
   * @param event - Audit event (action, context, details)
   * @returns AuditLogRecord with all 4 authoritative fields populated
   */
  public async append(
    tx: Prisma.TransactionClient,
    event: AuditEventForAppend,
  ): Promise<AuditLogRecord> {
    // Step 1: Allocate sequence and obtain predecessor hash (lock acquired on stream_state)
    const { segmentId, sequence, predecessorHash } =
      await this.segmentAuthorityService.allocateSequenceAndObtainTail(tx);

    // Step 2: Calculate hash (canonical serialization + SHA-256)
    const hash = this.auditChainService.calculateEventHash(
      event,
      sequence,
      segmentId,
      predecessorHash,
    );

    // Step 3: Insert event with all authoritative fields
    const auditLog = await tx.auditLog.create({
      data: {
        segmentId,
        sequence,
        hash,
        predecessorHash,
        action: event.action,
        ...(event.context.userId !== undefined ? { userId: event.context.userId } : {}),
        ...(event.context.ipAddress !== undefined ? { ipAddress: event.context.ipAddress } : {}),
        ...(event.context.userAgent !== undefined ? { userAgent: event.context.userAgent } : {}),
        ...(event.details?.resource !== undefined ? { resource: event.details.resource } : {}),
        ...(event.details?.resourceId !== undefined
          ? { resourceId: event.details.resourceId }
          : {}),
        metadata: event.details?.metadata ?? {},
      },
    });

    // Step 4: Update segment tail (next event will use this as predecessor)
    // CRITICAL: On first event, set firstHash (immutable anchor). On subsequent events, update lastHash only.
    const segment = await tx.auditSegment.findUniqueOrThrow({
      where: { id: segmentId },
    });

    const isFirstEvent = segment.lastSequence === null;

    await tx.auditSegment.update({
      where: { id: segmentId },
      data: {
        ...(isFirstEvent ? { firstHash: hash } : {}), // Set firstHash only on first event (immutable)
        lastSequence: sequence,
        lastHash: hash,
        eventCount: { increment: 1 },
      },
    });

    // Step 5: Update stream state (next sequence and tail hash for next event)
    await tx.auditStreamState.update({
      where: { id: 'main' },
      data: {
        nextSequence: sequence + 1n,
        tailHash: hash,
      },
    });

    return auditLog;
  }
}
