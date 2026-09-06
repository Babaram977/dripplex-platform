import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import { ArchiveManifestBuilder } from './archive-manifest.builder';
import { SixPartVerifier, type VerificationResult } from './six-part-verifier';

/**
 * Archive Service — Segment Archive Creation & Verification
 *
 * Implements B8.3 Archive Engine: creates immutable archive of closed segments
 * with cryptographic manifest and six-part integrity verification.
 *
 * Contract: Operates within Serializable transactions for isolation guarantees.
 * CRITICAL: Must be called with caller-owned Prisma.TransactionClient.
 */
export interface ArchiveSegmentResult {
  segmentId: string;
  manifestId: string;
  archivedAt: Date;
  verificationPassed: boolean;
  verificationErrors: string[];
}

@Injectable()
export class ArchiveService {
  private readonly manifestBuilder = new ArchiveManifestBuilder();
  private readonly verifier = new SixPartVerifier();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Archive a CLOSED segment atomically within a transaction.
   *
   * CRITICAL CONTRACT:
   * - Must be called within a Serializable transaction
   * - Must use supplied tx parameter, never root Prisma client
   * - Must NOT open nested $transaction()
   * - Archive creation and verification are atomic (all-or-nothing)
   *
   * Flow:
   * 1. Validate segment is CLOSED (not ACTIVE, not already archived)
   * 2. Load all events in segment to memory (for manifest generation)
   * 3. Generate immutable archive manifest with digest
   * 4. Run six-part integrity verification
   * 5. Create archive manifest row in database
   * 6. Update segment.archivedAt and set lifecycle to ARCHIVE_PENDING
   * 7. Return result (including verification outcome)
   *
   * Idempotency: same segmentId returns same result (manifest digest is deterministic).
   *
   * @param tx - Caller-owned Prisma.TransactionClient (must be Serializable)
   * @param segmentId - The CLOSED segment to archive
   * @returns ArchiveSegmentResult with manifest ID and verification outcome
   * @throws If segment not CLOSED or already archived, or verification fails
   */
  public async archiveSegment(
    tx: Prisma.TransactionClient,
    segmentId: string,
  ): Promise<ArchiveSegmentResult> {
    // Step 1: Validate segment is CLOSED
    const segment = await tx.auditSegment.findUnique({
      where: { id: segmentId },
    });

    if (!segment) {
      throw new Error(`Segment not found: ${segmentId}`);
    }

    if (segment.lifecycle !== 'CLOSED') {
      throw new Error(`Segment must be CLOSED to archive, got ${segment.lifecycle}`);
    }

    if (segment.archivedAt !== null) {
      // Idempotency: already archived, return existing manifest
      const existingManifest = await tx.segmentArchiveManifest.findUnique({
        where: { segmentId },
      });

      if (existingManifest) {
        return {
          segmentId,
          manifestId: existingManifest.id,
          archivedAt: segment.archivedAt,
          verificationPassed: true, // Already verified during first archive
          verificationErrors: [],
        };
      }
    }

    // Step 2: Load all events in segment to memory
    const rawEvents = await tx.auditLog.findMany({
      where: { segmentId },
      orderBy: { sequence: 'asc' },
      select: {
        id: true,
        sequence: true,
        hash: true,
        predecessorHash: true,
        userId: true,
        action: true,
        resource: true,
        resourceId: true,
        ipAddress: true,
        userAgent: true,
        metadata: true,
        createdAt: true,
      },
    });

    if (rawEvents.length === 0) {
      throw new Error(`Segment ${segmentId} has no events, cannot archive`);
    }

    // Validate all events have required authoritative fields
    const events = rawEvents.map((e) => {
      if (e.sequence === null || e.hash === null || e.predecessorHash === null) {
        const seqStr = String(e.sequence);
        const hashStr = String(e.hash);
        const predStr = String(e.predecessorHash);
        throw new Error(
          `Event has missing authoritative fields: sequence=${seqStr}, hash=${hashStr}, predecessorHash=${predStr}`,
        );
      }
      return {
        sequence: e.sequence,
        hash: e.hash,
        predecessorHash: e.predecessorHash,
      };
    });

    // Validate segment boundary data (should never be null for CLOSED segment)
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (segment.firstSequence === null || segment.lastSequence === null) {
      throw new Error(`Segment ${segmentId} has null boundary sequences`);
    }

    // Step 3: Generate immutable archive manifest
    const manifestInput = {
      segmentId,
      firstSequence: segment.firstSequence,
      lastSequence: segment.lastSequence,
      eventCount: segment.eventCount,
      firstHash: segment.firstHash,
      lastHash: segment.lastHash,
      predecessorHash: segment.predecessorTailHash ?? '0'.repeat(64),
    };

    const manifest = this.manifestBuilder.build(manifestInput);

    // Step 4: Run six-part integrity verification
    // Load predecessor segment for anchor agreement check
    let predecessorTailHash: string | null = null;
    if (segment.predecessorSegmentId !== null) {
      const predecessor = await tx.auditSegment.findUnique({
        where: { id: segment.predecessorSegmentId },
        select: { lastHash: true },
      });
      if (predecessor) {
        predecessorTailHash = predecessor.lastHash;
      }
    }

    const verificationResult = this.verifier.verify(
      {
        segmentId,
        firstSequence: segment.firstSequence,
        lastSequence: segment.lastSequence,
        eventCount: segment.eventCount,
        firstHash: segment.firstHash,
        lastHash: segment.lastHash,
        predecessorHash: manifestInput.predecessorHash,
        manifestDigest: manifest.manifestDigest,
        events: events.map((e) => ({
          sequence: e.sequence,
          hash: e.hash,
          predecessorHash: e.predecessorHash,
        })),
        predecessorTailHash,
      },
      // Pass the recalculate function for digest verification
      (input) => this.manifestBuilder.calculateManifestDigest(input),
    );

    if (!verificationResult.passed) {
      throw new Error(
        `Archive verification failed for segment ${segmentId}: ${verificationResult.errors.join('; ')}`,
      );
    }

    // Step 5a: Create archive manifest row in database
    const createdManifest = await tx.segmentArchiveManifest.create({
      data: {
        id: manifest.id,
        segmentId,
        firstSequence: manifest.firstSequence,
        lastSequence: manifest.lastSequence,
        eventCount: manifest.eventCount,
        firstHash: manifest.firstHash,
        lastHash: manifest.lastHash,
        predecessorHash: manifest.predecessorHash,
        manifestDigest: manifest.manifestDigest,
        signingMetadata: (manifest.signingMetadata ?? null) as Prisma.InputJsonValue,
      },
    });

    // Step 5b: Create immutable archived event records for post-purge verification
    // These records preserve all essential event data so archive can be verified after live rows are purged
    const archivedEventRecords = rawEvents.map((e, index) => {
      const eventData = events[index];
      if (!eventData) {
        const idxStr = String(index);
        throw new Error(`Event data missing for index ${idxStr}`);
      }
      return {
        id: e.id,
        archiveId: createdManifest.id,
        segmentId,
        sequence: eventData.sequence,
        hash: eventData.hash,
        predecessorHash: eventData.predecessorHash,
        userId: e.userId ?? null,
        action: e.action,
        resource: e.resource ?? null,
        resourceId: e.resourceId ?? null,
        ipAddress: e.ipAddress ?? null,
        userAgent: e.userAgent ?? null,
        metadata: e.metadata as Prisma.InputJsonValue,
        createdAt: e.createdAt,
      };
    });

    await tx.segmentArchivedEvent.createMany({
      data: archivedEventRecords,
    });

    // Step 6: Update segment state to ARCHIVE_PENDING, set archivedAt
    const now = new Date();
    await tx.auditSegment.update({
      where: { id: segmentId },
      data: {
        lifecycle: 'ARCHIVE_PENDING',
        archivedAt: now,
      },
    });

    return {
      segmentId,
      manifestId: createdManifest.id,
      archivedAt: now,
      verificationPassed: true,
      verificationErrors: [],
    };
  }

  /**
   * Complete archive verification and transition segment to ARCHIVED_VERIFIED.
   *
   * Completes the archive lifecycle after archiveSegment has created the manifest.
   * In production, this would be called after external archive vault has accepted
   * the archive (vault persistence confirmed, sealed, etc.).
   *
   * For B8.3 initial implementation, this immediately sets ARCHIVED_VERIFIED
   * (future B9+ will add vault integration).
   *
   * CRITICAL: Must be called within Serializable transaction.
   *
   * @param tx - Caller-owned Prisma.TransactionClient
   * @param segmentId - Segment in ARCHIVE_PENDING state
   * @returns Updated segment with ARCHIVED_VERIFIED lifecycle
   */
  public async completeArchiveVerification(
    tx: Prisma.TransactionClient,
    segmentId: string,
  ): Promise<{ lifecycle: string }> {
    const segment = await tx.auditSegment.findUnique({
      where: { id: segmentId },
    });

    if (!segment) {
      throw new Error(`Segment not found: ${segmentId}`);
    }

    if (segment.lifecycle !== 'ARCHIVE_PENDING') {
      throw new Error(
        `Segment must be in ARCHIVE_PENDING state to complete verification, got ${segment.lifecycle}`,
      );
    }

    // Validate manifest exists
    const manifest = await tx.segmentArchiveManifest.findUnique({
      where: { segmentId },
    });

    if (!manifest) {
      throw new Error(`Archive manifest not found for segment ${segmentId}`);
    }

    // Transition to ARCHIVED_VERIFIED
    const now = new Date();
    const updated = await tx.auditSegment.update({
      where: { id: segmentId },
      data: {
        lifecycle: 'ARCHIVED_VERIFIED',
        archiveVerifiedAt: now,
      },
    });

    return updated;
  }

  /**
   * Public wrapper: Archive a segment within an auto-managed transaction.
   *
   * Establishes a Serializable transaction and delegates to archiveSegment.
   *
   * @param segmentId - The CLOSED segment to archive
   * @returns ArchiveSegmentResult
   */
  public async archiveSegmentWithTransaction(segmentId: string): Promise<ArchiveSegmentResult> {
    return await this.prisma.$transaction(
      async (tx) => {
        return await this.archiveSegment(tx, segmentId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /**
   * Public wrapper: Complete archive verification within an auto-managed transaction.
   *
   * @param segmentId - Segment in ARCHIVE_PENDING state
   */
  public async completeArchiveVerificationWithTransaction(
    segmentId: string,
  ): Promise<ReturnType<typeof this.completeArchiveVerification>> {
    return await this.prisma.$transaction(
      async (tx) => {
        return await this.completeArchiveVerification(tx, segmentId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /**
   * Verify archive integrity using archived event records (post-purge verification).
   *
   * After live auditLog rows are deleted during purge, this method verifies the archive
   * using only the immutable archived event records, proving the archive survived purge.
   *
   * @param tx - Caller-owned Prisma.TransactionClient
   * @param segmentId - Archived segment
   * @returns Verification result using only archived events
   */
  public async verifyArchivePostPurge(
    tx: Prisma.TransactionClient,
    segmentId: string,
  ): Promise<VerificationResult> {
    // Load segment and manifest
    const segment = await tx.auditSegment.findUnique({
      where: { id: segmentId },
    });

    if (!segment) {
      throw new Error(`Segment not found: ${segmentId}`);
    }

    const manifest = await tx.segmentArchiveManifest.findUnique({
      where: { segmentId },
    });

    if (!manifest) {
      throw new Error(`Archive manifest not found for segment ${segmentId}`);
    }

    // Load archived events (live auditLog rows may be deleted)
    const archivedEvents = await tx.segmentArchivedEvent.findMany({
      where: { segmentId },
      orderBy: { sequence: 'asc' },
      select: {
        sequence: true,
        hash: true,
        predecessorHash: true,
      },
    });

    // Load predecessor segment for anchor verification
    let predecessorTailHash: string | null = null;
    if (segment.predecessorSegmentId !== null) {
      const predecessor = await tx.auditSegment.findUnique({
        where: { id: segment.predecessorSegmentId },
        select: { lastHash: true },
      });
      if (predecessor) {
        predecessorTailHash = predecessor.lastHash;
      }
    }

    // Run verification against archived events
    const verificationResult = this.verifier.verify(
      {
        segmentId,
        firstSequence: segment.firstSequence,
        lastSequence: segment.lastSequence ?? 0n,
        eventCount: segment.eventCount,
        firstHash: segment.firstHash,
        lastHash: segment.lastHash,
        predecessorHash: manifest.predecessorHash,
        manifestDigest: manifest.manifestDigest,
        events: archivedEvents.map((e) => ({
          sequence: e.sequence,
          hash: e.hash,
          predecessorHash: e.predecessorHash,
        })),
        predecessorTailHash,
      },
      (input) => this.manifestBuilder.calculateManifestDigest(input),
    );

    return verificationResult;
  }
}
