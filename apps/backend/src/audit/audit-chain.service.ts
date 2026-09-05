import * as crypto from 'crypto';

import { Injectable } from '@nestjs/common';

import type { AuditEventForAppend } from './repositories/audit-log.repository';
import type { Prisma } from '@prisma/client';

/**
 * Audit Chain Service — SHA-256 Cryptographic Binding
 *
 * Canonicalizes audit events into deterministic JSON and calculates SHA-256 hashes
 * for cryptographic chain verification. Ensures identical events always produce
 * identical hashes across all implementations.
 *
 * Critical: Field order is alphabetical and locked; canonical serialization is deterministic.
 */
@Injectable()
export class AuditChainService {
  /**
   * Canonicalize an audit event into deterministic JSON for hashing.
   *
   * Field order (alphabetical, locked):
   * 1. action
   * 2. ipAddress
   * 3. metadata
   * 4. predecessorHash
   * 5. resource
   * 6. resourceId
   * 7. segmentId
   * 8. sequence
   * 9. timestamp
   * 10. userAgent
   * 11. userId
   *
   * Rules:
   * - Null values are included (not omitted)
   * - BigInt → exact decimal string (no precision loss for values > 2^53-1)
   * - No whitespace
   * - Sorted keys
   *
   * @param event - Audit event with all required fields for hashing
   * @returns Canonical JSON string (deterministic)
   */
  public canonicalizeEvent(event: {
    action: string;
    userId?: string | null | undefined;
    ipAddress?: string | null | undefined;
    userAgent?: string | null | undefined;
    resource?: string | null | undefined;
    resourceId?: string | null | undefined;
    metadata?: Prisma.InputJsonValue | null | undefined;
    sequence: bigint;
    segmentId: string;
    timestamp: Date;
    predecessorHash: string;
  }): string {
    // Create canonical object with alphabetical field ordering and null for missing fields.
    // CRITICAL: sequence must be preserved as exact decimal string, not converted to Number,
    // to avoid precision loss for values > 2^53-1 (JavaScript number limit).
    const canonical = {
      action: event.action,
      ipAddress: event.ipAddress ?? null,
      metadata: event.metadata ?? null,
      predecessorHash: event.predecessorHash,
      resource: event.resource ?? null,
      resourceId: event.resourceId ?? null,
      segmentId: event.segmentId,
      sequence: event.sequence.toString(), // BigInt → exact decimal string (no precision loss)
      timestamp: event.timestamp.toISOString(),
      userAgent: event.userAgent ?? null,
      userId: event.userId ?? null,
    };

    // Serialize with sorted keys, no whitespace
    // JSON.stringify with a replacer function that sorts keys
    const sortedKeys = Object.keys(canonical).sort();
    const serialized = JSON.stringify(canonical, sortedKeys);

    return serialized;
  }

  /**
   * Calculate the SHA-256 hash of an audit event within a transaction.
   *
   * The hash binds the event to:
   * - Its position in the sequence (sequence number)
   * - Its segment (segmentId)
   * - The previous event's hash (predecessorHash)
   * - All event content (action, context, details)
   *
   * @param event - Audit event from repository
   * @param sequence - Allocated sequence number (from SegmentAuthorityService)
   * @param segmentId - Active segment ID (from SegmentAuthorityService)
   * @param predecessorHash - Previous event's hash (from SegmentAuthorityService)
   * @returns SHA-256 hash as lowercase hex string
   */
  public calculateEventHash(
    event: AuditEventForAppend,
    sequence: bigint,
    segmentId: string,
    predecessorHash: string,
  ): string {
    // Canonicalize the event with all required fields
    const canonical = this.canonicalizeEvent({
      action: event.action,
      userId: event.context.userId,
      ipAddress: event.context.ipAddress,
      userAgent: event.context.userAgent,
      resource: event.details?.resource,
      resourceId: event.details?.resourceId,
      metadata: event.details?.metadata,
      sequence,
      segmentId,
      timestamp: new Date(), // Database NOW() at insert time
      predecessorHash,
    });

    // Calculate SHA-256 hash
    const hash = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex'); // Lowercase hex

    return hash;
  }
}
