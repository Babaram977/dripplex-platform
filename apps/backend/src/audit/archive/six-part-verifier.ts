/**
 * Six-Part Integrity Verifier — Archive Validation Engine
 *
 * Implements the complete archive integrity check contract (Contract 14, B8.3).
 * All six parts must pass for archive to transition to ARCHIVED_VERIFIED.
 *
 * Six-Part Check:
 * 1. Sequence Continuity: no gaps from firstSequence to lastSequence
 * 2. Event Count Agreement: eventCount == (lastSequence - firstSequence + 1)
 * 3. Hash Chain Continuity: each event's hash links to predecessor
 * 4. First/Last Boundary Agreement: firstHash and lastHash match event hashes
 * 5. Predecessor Anchor Agreement: predecessor segment's lastHash == predecessorHash
 * 6. Archive Digest Agreement: manifest digest reproduced identically
 */

export interface VerificationInput {
  // From manifest
  segmentId: string;
  firstSequence: bigint;
  lastSequence: bigint;
  eventCount: number;
  firstHash: string;
  lastHash: string;
  predecessorHash: string;
  manifestDigest: string;

  // From events (populated during verification)
  events: {
    sequence: bigint;
    hash: string;
    predecessorHash: string;
  }[];

  // From predecessor segment (nullable if first segment)
  predecessorTailHash: string | null;
}

export interface VerificationResult {
  passed: boolean;
  partResults: {
    sequenceContinuity: PartResult;
    eventCountAgreement: PartResult;
    hashChainContinuity: PartResult;
    boundaryAgreement: PartResult;
    predecessorAnchorAgreement: PartResult;
    digestAgreement: PartResult;
  };
  errors: string[];
}

export interface PartResult {
  passed: boolean;
  details: string;
}

export class SixPartVerifier {
  /**
   * Verify Part 1: Sequence Continuity
   * Check that there are no gaps from firstSequence to lastSequence.
   */
  private verifySequenceContinuity(input: VerificationInput): PartResult {
    try {
      // Expected sequence range
      const expectedSequences = new Set<string>();
      for (let seq = input.firstSequence; seq <= input.lastSequence; seq++) {
        expectedSequences.add(seq.toString());
      }

      // Actual sequence values from events
      const actualSequences = new Set(input.events.map((e) => e.sequence.toString()));

      // Check for missing sequences
      const missing = Array.from(expectedSequences).filter((seq) => !actualSequences.has(seq));

      if (missing.length > 0) {
        return {
          passed: false,
          details: `Missing sequences: ${missing.join(', ')}`,
        };
      }

      // Check for extra sequences
      const extra = Array.from(actualSequences).filter((seq) => !expectedSequences.has(seq));
      if (extra.length > 0) {
        return {
          passed: false,
          details: `Unexpected sequences: ${extra.join(', ')}`,
        };
      }

      const firstStr = String(input.firstSequence);
      const lastStr = String(input.lastSequence);
      return {
        passed: true,
        details: `Sequences continuous from ${firstStr} to ${lastStr}`,
      };
    } catch (e) {
      return {
        passed: false,
        details: `Sequence continuity check failed: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  /**
   * Verify Part 2: Event Count Agreement
   * Check that eventCount == (lastSequence - firstSequence + 1).
   */
  private verifyEventCountAgreement(input: VerificationInput): PartResult {
    try {
      const expectedCount = Number(input.lastSequence - input.firstSequence + 1n);
      const actualCount = input.eventCount;
      const eventsLength = input.events.length;
      const expectedCountStr = String(expectedCount);
      const actualCountStr = String(actualCount);
      const eventsLengthStr = String(eventsLength);
      const firstSeqStr = String(input.firstSequence);
      const lastSeqStr = String(input.lastSequence);

      if (actualCount !== expectedCount) {
        return {
          passed: false,
          details: `Event count mismatch: manifest reports ${actualCountStr}, calculated as ${expectedCountStr}`,
        };
      }

      if (eventsLength !== expectedCount) {
        return {
          passed: false,
          details: `Event list length mismatch: ${eventsLengthStr} events, expected ${expectedCountStr}`,
        };
      }

      return {
        passed: true,
        details: `Event count agrees: ${actualCountStr} events from ${firstSeqStr} to ${lastSeqStr}`,
      };
    } catch (e) {
      return {
        passed: false,
        details: `Event count agreement check failed: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  /**
   * Verify Part 3: Hash Chain Continuity
   * Check that each event's hash links to predecessor.
   */
  private verifyHashChainContinuity(input: VerificationInput): PartResult {
    try {
      for (let i = 1; i < input.events.length; i++) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const current = input.events[i]!;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const previous = input.events[i - 1]!;

        if (current.predecessorHash !== previous.hash) {
          const seqStr = String(current.sequence);
          return {
            passed: false,
            details: `Hash chain broken at sequence ${seqStr}: predecessorHash ${current.predecessorHash} does not match previous event hash ${previous.hash}`,
          };
        }
      }

      const eventsLenStr = String(input.events.length);
      return {
        passed: true,
        details: `Hash chain continuous across ${eventsLenStr} events`,
      };
    } catch (e) {
      return {
        passed: false,
        details: `Hash chain continuity check failed: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  /**
   * Verify Part 4: First/Last Boundary Agreement
   * Check that firstHash and lastHash match event hashes.
   */
  private verifyBoundaryAgreement(input: VerificationInput): PartResult {
    try {
      if (input.events.length === 0) {
        return {
          passed: false,
          details: `No events in segment, cannot verify boundaries`,
        };
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const firstEvent = input.events[0]!;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const lastEvent = input.events[input.events.length - 1]!;

      if (firstEvent.hash !== input.firstHash) {
        return {
          passed: false,
          details: `First hash mismatch: manifest ${input.firstHash} != event ${firstEvent.hash}`,
        };
      }

      if (lastEvent.hash !== input.lastHash) {
        return {
          passed: false,
          details: `Last hash mismatch: manifest ${input.lastHash} != event ${lastEvent.hash}`,
        };
      }

      return {
        passed: true,
        details: `Boundaries verified: first=${input.firstHash.substring(0, 8)}..., last=${input.lastHash.substring(0, 8)}...`,
      };
    } catch (e) {
      return {
        passed: false,
        details: `Boundary agreement check failed: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  /**
   * Verify Part 5: Predecessor Anchor Agreement
   * Check that predecessor segment's lastHash == predecessorHash.
   */
  private verifyPredecessorAnchorAgreement(input: VerificationInput): PartResult {
    try {
      // If predecessorTailHash is null, this is the first segment
      if (input.predecessorTailHash === null) {
        // First segment should have zeros for predecessorHash
        const expectedZeros = '0'.repeat(64);
        if (input.predecessorHash !== expectedZeros) {
          return {
            passed: false,
            details: `First segment must have zero predecessorHash, got ${input.predecessorHash}`,
          };
        }
        return {
          passed: true,
          details: 'First segment: predecessorHash correctly set to zeros',
        };
      }

      // Not first segment: predecessorTailHash must match predecessorHash
      if (input.predecessorTailHash !== input.predecessorHash) {
        return {
          passed: false,
          details: `Predecessor anchor mismatch: predecessor tail ${input.predecessorTailHash} != manifest predecessorHash ${input.predecessorHash}`,
        };
      }

      const hashPrefix = input.predecessorHash.substring(0, 8);
      return {
        passed: true,
        details: `Predecessor anchor verified: ${hashPrefix}...`,
      };
    } catch (e) {
      return {
        passed: false,
        details: `Predecessor anchor agreement check failed: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  /**
   * Verify Part 6: Archive Digest Agreement
   * Check that manifest digest reproduces identically.
   *
   * @param input - Verification input
   * @param recalculateDigest - Function to recalculate manifest digest
   */
  private verifyDigestAgreement(
    input: VerificationInput,
    recalculateDigest: (input: VerificationInput) => string,
  ): PartResult {
    try {
      const recalculated = recalculateDigest(input);

      if (recalculated !== input.manifestDigest) {
        return {
          passed: false,
          details: `Digest mismatch: stored ${input.manifestDigest} != recalculated ${recalculated}`,
        };
      }

      return {
        passed: true,
        details: `Archive digest verified: ${input.manifestDigest.substring(0, 8)}...`,
      };
    } catch (e) {
      return {
        passed: false,
        details: `Digest agreement check failed: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  /**
   * Execute complete six-part verification.
   *
   * @param input - Verification input with all segment and event data
   * @param recalculateDigest - Function to recalculate manifest digest from manifest input
   * @returns Complete verification result with all six parts
   */
  public verify(
    input: VerificationInput,
    recalculateDigest: (input: VerificationInput) => string,
  ): VerificationResult {
    const partResults = {
      sequenceContinuity: this.verifySequenceContinuity(input),
      eventCountAgreement: this.verifyEventCountAgreement(input),
      hashChainContinuity: this.verifyHashChainContinuity(input),
      boundaryAgreement: this.verifyBoundaryAgreement(input),
      predecessorAnchorAgreement: this.verifyPredecessorAnchorAgreement(input),
      digestAgreement: this.verifyDigestAgreement(input, recalculateDigest),
    };

    const errors = Object.entries(partResults)
      .filter(([_, result]) => !result.passed)
      .map(([name, result]) => `${name}: ${result.details}`);

    const passed = errors.length === 0;

    return {
      passed,
      partResults,
      errors,
    };
  }
}
