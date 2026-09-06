/**
 * Audit Segments Schema Constraint Tests — PostgreSQL Integration
 *
 * Real tests that verify PostgreSQL constraints and invariants are properly
 * enforced at the database level for audit_segments, audit_stream_state, and audit_logs tables.
 *
 * Requirements:
 * - PostgreSQL test database with P1-B2 migration applied
 * - Prisma Client connection to test database
 * - Test environment with DATABASE_URL pointing to test instance
 */

import { randomUUID } from 'crypto';

import { PrismaClient, Prisma } from '@prisma/client';

describe('Audit Segments Schema Constraints — PostgreSQL Integration Tests', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ─────────────────────────────────────────────────────────────────
  // CS.1-CS.3: Exactly-One-ACTIVE Partial Unique Index Tests
  // ─────────────────────────────────────────────────────────────────

  describe('CS.1: Exactly-One-ACTIVE Partial Unique Index Enforcement', () => {
    it('should prevent inserting a second ACTIVE segment', async () => {
      // Find existing ACTIVE segment
      const activeSegments = await prisma.auditSegment.findMany({
        where: { lifecycle: 'ACTIVE' },
      });

      expect(activeSegments.length).toBe(1);

      // Attempt to insert another ACTIVE segment — must fail with unique violation
      const newSegmentId = randomUUID();
      try {
        await prisma.auditSegment.create({
          data: {
            id: newSegmentId,
            lifecycle: 'ACTIVE',
            firstSequence: 10000n,
            firstHash: '1111111111111111111111111111111111111111111111111111111111111111',
            lastHash: '1111111111111111111111111111111111111111111111111111111111111111',
          },
        });
        fail('Should have thrown UNIQUE constraint violation');
      } catch (error) {
        // Prisma throws P2002 for unique constraint violations
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((error as any).code).toBe('P2002');
        // The error metadata includes the column that violates the constraint
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((error as any).meta?.target).toContain('lifecycle');
      }
    });
  });

  describe('CS.2: Non-ACTIVE Segments Can Coexist', () => {
    it('should allow multiple CLOSED segments to exist simultaneously', async () => {
      const segment1Id = randomUUID();
      const segment2Id = randomUUID();

      try {
        // Create first CLOSED segment
        await prisma.auditSegment.create({
          data: {
            id: segment1Id,
            lifecycle: 'CLOSED',
            firstSequence: 5000n,
            firstHash: '2222222222222222222222222222222222222222222222222222222222222222',
            lastHash: '2222222222222222222222222222222222222222222222222222222222222222',
            lastSequence: 5999n,
          },
        });

        // Create second CLOSED segment
        await prisma.auditSegment.create({
          data: {
            id: segment2Id,
            lifecycle: 'CLOSED',
            firstSequence: 6000n,
            firstHash: '3333333333333333333333333333333333333333333333333333333333333333',
            lastHash: '3333333333333333333333333333333333333333333333333333333333333333',
            lastSequence: 6999n,
          },
        });

        // Both should exist
        const segments = await prisma.auditSegment.findMany({
          where: { id: { in: [segment1Id, segment2Id] } },
        });

        expect(segments).toHaveLength(2);
        expect(segments.every((s) => s.lifecycle === 'CLOSED')).toBe(true);
      } finally {
        // Cleanup
        await prisma.auditSegment.deleteMany({
          where: { id: { in: [segment1Id, segment2Id] } },
        });
      }
    });
  });

  describe('CS.3: Authoritative Field Atomicity (CHECK Constraint)', () => {
    it('should reject audit log with partial authoritative fields', async () => {
      // Get the ACTIVE segment
      const segment = await prisma.auditSegment.findFirst({
        where: { lifecycle: 'ACTIVE' },
      });

      if (!segment) {
        fail('No ACTIVE segment found');
      }

      // Attempt to insert audit log with segment_id but no sequence (violates CHECK constraint)
      try {
        // Use raw query to bypass Prisma's type checking
        await prisma.$executeRaw(Prisma.sql`
          INSERT INTO audit_logs (
            id, action, "segmentId", sequence, hash, "predecessorHash", "createdAt"
          ) VALUES (
            ${randomUUID()}::UUID, 'TEST_ACTION', ${segment.id}::UUID, NULL, NULL, NULL, NOW()
          )
        `);
        fail('Should have thrown CHECK constraint violation');
      } catch (error) {
        // PostgreSQL CHECK constraint violation
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((error as any).code).toBe('P2010'); // Raw query error (CHECK violation)
      }
    });

    it('should accept audit log with all four authoritative fields NOT NULL', async () => {
      const segment = await prisma.auditSegment.findFirst({
        where: { lifecycle: 'ACTIVE' },
      });

      if (!segment) {
        fail('No ACTIVE segment found');
      }

      const logId = randomUUID();
      const sequence = BigInt(20000);
      const hash = '4444444444444444444444444444444444444444444444444444444444444444';
      const predHash = '3333333333333333333333333333333333333333333333333333333333333333';

      try {
        // This should succeed (all four fields NOT NULL)
        await prisma.auditLog.create({
          data: {
            id: logId,
            action: 'TEST_CHECK_CONSTRAINT',
            segmentId: segment.id,
            sequence,
            hash,
            predecessorHash: predHash,
          },
        });

        const created = await prisma.auditLog.findUnique({
          where: { id: logId },
        });

        expect(created?.segmentId).toBe(segment.id);
        expect(created?.sequence).toBe(sequence);
        expect(created?.hash).toBe(hash);
        expect(created?.predecessorHash).toBe(predHash);
      } finally {
        await prisma.auditLog.deleteMany({
          where: { id: logId },
        });
      }
    });

    it('should reject audit log with all four authoritative fields NULL (legacy path blocked)', async () => {
      const logId = randomUUID();

      try {
        // This should FAIL (all four fields NULL rejected by authoritative-write boundary trigger)
        // The deprecated create() path is blocked after P1-B2 to prevent unauthorized writes
        // masquerading as legacy data.
        await prisma.auditLog.create({
          data: {
            id: logId,
            action: 'LEGACY_ACTION_BLOCKED',
            // All authoritative fields are NULL (or omitted)
            // This triggers the boundary check: RAISE EXCEPTION
          },
        });
        fail('Should have thrown authoritative-write boundary violation');
      } catch (error) {
        // Trigger should raise exception for all-NULL rows
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect((error as any).message).toContain('Legacy write boundary violated');
      }
    });
  });

  describe('CS.4-CS.6: Foreign Key Integrity', () => {
    it('should prevent deletion of segment referenced by audit_logs', async () => {
      const segment = await prisma.auditSegment.findFirst({
        where: { lifecycle: 'ACTIVE' },
      });

      if (!segment) {
        fail('No ACTIVE segment found');
      }

      // The ACTIVE segment has the stream_state referencing it
      // Attempting to delete it should fail with FK constraint
      try {
        await prisma.auditSegment.delete({
          where: { id: segment.id },
        });
        fail('Should have thrown FK constraint violation');
      } catch (error) {
        // Prisma throws P2014 or P2003 for FK violations depending on context
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errorCode = (error as any).code;
        expect(['P2014', 'P2003']).toContain(errorCode);
      }
    });
  });

  describe('CS.7: Unique Constraint on (segment_id, sequence)', () => {
    it('should enforce unique (segment_id, sequence) combination', async () => {
      const segment = await prisma.auditSegment.findFirst({
        where: { lifecycle: 'ACTIVE' },
      });

      if (!segment) {
        fail('No ACTIVE segment found');
      }

      const sequence = BigInt(30000);
      const hash = '5555555555555555555555555555555555555555555555555555555555555555';
      const predHash = '4444444444444444444444444444444444444444444444444444444444444444';
      const log1Id = randomUUID();
      const log2Id = randomUUID();

      try {
        // Create first audit log
        await prisma.auditLog.create({
          data: {
            id: log1Id,
            action: 'TEST_UNIQUE_1',
            segmentId: segment.id,
            sequence,
            hash,
            predecessorHash: predHash,
          },
        });

        // Attempt to create second with same (segmentId, sequence) — must fail
        try {
          await prisma.auditLog.create({
            data: {
              id: log2Id,
              action: 'TEST_UNIQUE_2',
              segmentId: segment.id,
              sequence, // Same sequence
              hash: '6666666666666666666666666666666666666666666666666666666666666666',
              predecessorHash: hash,
            },
          });
          fail('Should have thrown UNIQUE constraint violation');
        } catch (error) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          expect((error as any).code).toBe('P2002');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          expect((error as any).meta?.target).toContain('segment_id');
        }
      } finally {
        await prisma.auditLog.deleteMany({
          where: { id: { in: [log1Id, log2Id] } },
        });
      }
    });
  });

  describe('CS.8: Global Sequence Uniqueness (Regression Test for New Index)', () => {
    it('should prevent same sequence across different segments (global uniqueness)', async () => {
      // Create two distinct CLOSED segments for this test
      const segment1Id = randomUUID();
      const segment2Id = randomUUID();
      const globalSequence = BigInt(40000); // Same sequence used in both segments
      const hash = '7777777777777777777777777777777777777777777777777777777777777777';
      const predHash = '6666666666666666666666666666666666666666666666666666666666666666';
      const log1Id = randomUUID();
      const log2Id = randomUUID();

      try {
        // Create two segments
        await prisma.auditSegment.create({
          data: {
            id: segment1Id,
            lifecycle: 'CLOSED',
            firstSequence: 35000n,
            firstHash: hash,
            lastHash: hash,
            lastSequence: 35999n,
          },
        });

        await prisma.auditSegment.create({
          data: {
            id: segment2Id,
            lifecycle: 'CLOSED',
            firstSequence: 36000n,
            firstHash: hash,
            lastHash: hash,
            lastSequence: 36999n,
          },
        });

        // Create first audit log with global sequence in segment 1
        await prisma.auditLog.create({
          data: {
            id: log1Id,
            action: 'TEST_GLOBAL_SEQ_1',
            segmentId: segment1Id,
            sequence: globalSequence,
            hash,
            predecessorHash: predHash,
          },
        });

        // Attempt to create second audit log with SAME global sequence in segment 2 — must fail
        try {
          await prisma.auditLog.create({
            data: {
              id: log2Id,
              action: 'TEST_GLOBAL_SEQ_2',
              segmentId: segment2Id,
              sequence: globalSequence, // Same global sequence
              hash: '8888888888888888888888888888888888888888888888888888888888888888',
              predecessorHash: hash,
            },
          });
          fail('Should have thrown global sequence UNIQUE constraint violation');
        } catch (error) {
          // Should violate audit_logs_sequence_global_key index
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          expect((error as any).code).toBe('P2002');
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          expect((error as any).meta?.target).toContain('sequence');
        }
      } finally {
        // Cleanup
        await prisma.auditLog.deleteMany({
          where: { id: { in: [log1Id, log2Id] } },
        });
        await prisma.auditSegment.deleteMany({
          where: { id: { in: [segment1Id, segment2Id] } },
        });
      }
    });
  });
});
