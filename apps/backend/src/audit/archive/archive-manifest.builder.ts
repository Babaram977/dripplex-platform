import * as crypto from 'crypto';

/**
 * Archive Manifest Builder — Deterministic Cryptographic Summary
 *
 * Generates an immutable manifest of segment contents at archive time.
 * All state is captured from the segment and its events, then canonicalized
 * deterministically so the manifest digest is reproducible.
 *
 * Contract: Same canonicalization rules as AuditLog.hash (SHA-256, alphabetical
 * field order, BigInt preserved as decimal string, no timestamp).
 */
export interface ArchiveManifestInput {
  segmentId: string;
  firstSequence: bigint;
  lastSequence: bigint;
  eventCount: number;
  firstHash: string;
  lastHash: string;
  predecessorHash: string;
}

export interface ArchiveManifest {
  id: string;
  segmentId: string;
  firstSequence: bigint;
  lastSequence: bigint;
  eventCount: number;
  firstHash: string;
  lastHash: string;
  predecessorHash: string;
  manifestDigest: string;
  signingMetadata?: Record<string, unknown> | null;
}

export class ArchiveManifestBuilder {
  /**
   * Canonicalize manifest data into deterministic JSON for hashing.
   *
   * Field order (alphabetical, locked):
   * 1. eventCount
   * 2. firstHash
   * 3. firstSequence
   * 4. lastHash
   * 5. lastSequence
   * 6. predecessorHash
   * 7. segmentId
   *
   * Rules:
   * - BigInt → exact decimal string (no precision loss for values > 2^53-1)
   * - No whitespace
   * - Sorted keys
   *
   * @param input - Manifest data to canonicalize
   * @returns Canonical JSON string (deterministic)
   */
  public canonicalizeManifest(input: ArchiveManifestInput): string {
    // Create canonical object with alphabetical field ordering
    const canonical = {
      eventCount: input.eventCount,
      firstHash: input.firstHash,
      firstSequence: input.firstSequence.toString(), // BigInt → exact decimal string
      lastHash: input.lastHash,
      lastSequence: input.lastSequence.toString(), // BigInt → exact decimal string
      predecessorHash: input.predecessorHash,
      segmentId: input.segmentId,
    };

    // Serialize with sorted keys, no whitespace
    const sortedKeys = Object.keys(canonical).sort();
    const serialized = JSON.stringify(canonical, sortedKeys);

    return serialized;
  }

  /**
   * Calculate the SHA-256 digest of the manifest.
   *
   * The digest proves manifest integrity: identical manifests always produce
   * identical digests, and any change invalidates the digest.
   *
   * @param input - Manifest data
   * @returns SHA-256 digest as lowercase hex string
   */
  public calculateManifestDigest(input: ArchiveManifestInput): string {
    const canonical = this.canonicalizeManifest(input);
    const digest = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
    return digest;
  }

  /**
   * Build complete archive manifest with calculated digest.
   *
   * @param input - Manifest data (segment state at archive time)
   * @returns Complete manifest with calculated digest
   */
  public build(input: ArchiveManifestInput): ArchiveManifest {
    const manifestDigest = this.calculateManifestDigest(input);

    return {
      id: crypto.randomUUID(),
      segmentId: input.segmentId,
      firstSequence: input.firstSequence,
      lastSequence: input.lastSequence,
      eventCount: input.eventCount,
      firstHash: input.firstHash,
      lastHash: input.lastHash,
      predecessorHash: input.predecessorHash,
      manifestDigest,
      signingMetadata: null,
    };
  }
}
