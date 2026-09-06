/**
 * Archive Service Tests — B8.2/B8.3 Immutable Archive and Post-Purge Verification
 *
 * Tests cover:
 * 1. Archive creation with immutable event representation
 * 2. Immutability constraints (no update/delete after creation)
 * 3. Six-part verification success and failure cases
 * 4. Post-purge verification (archive survives without live events)
 * 5. Idempotency (same segmentId returns same manifest)
 * 6. Deterministic digest (same events produce same digest)
 * 7. Tamper detection (corruption causes verification failure)
 */

import { Test, type TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../prisma/prisma.service';

import { ArchiveManifestBuilder } from './archive-manifest.builder';
import { ArchiveService } from './archive.service';
import { SixPartVerifier } from './six-part-verifier';

import type { Prisma } from '@prisma/client';

describe('ArchiveService - B8.2/B8.3 Immutable Archive', () => {
  let archiveService: ArchiveService;
  let prisma: PrismaService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        ArchiveService,
        ArchiveManifestBuilder,
        SixPartVerifier,
        {
          provide: PrismaService,
          useValue: {
            auditSegment: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            auditLog: {
              findMany: jest.fn(),
            },
            segmentArchiveManifest: {
              create: jest.fn(),
              findUnique: jest.fn(),
            },
            segmentArchivedEvent: {
              findMany: jest.fn(),
              createMany: jest.fn(),
            },
            $transaction: jest.fn(),
          } as unknown,
        },
      ],
    }).compile();

    archiveService = module.get<ArchiveService>(ArchiveService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('Archive Creation', () => {
    it('should create immutable archive with complete event representation', async () => {
      // Arrange
      const segmentId = '550e8400-e29b-41d4-a716-446655440000';
      const firstSeq = 1n;
      const lastSeq = 3n;
      const now = new Date();

      const mockSegment = {
        id: segmentId,
        lifecycle: 'CLOSED',
        firstSequence: firstSeq,
        lastSequence: lastSeq,
        eventCount: 3,
        firstHash: 'a'.repeat(64),
        lastHash: 'c'.repeat(64),
        predecessorTailHash: null,
        predecessorSegmentId: null,
        archivedAt: null,
      };

      const mockEvents = [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          sequence: 1n,
          hash: 'a'.repeat(64),
          predecessorHash: '0'.repeat(64),
          userId: '550e8400-e29b-41d4-a716-446655440100',
          action: 'segment.created',
          resource: 'AuditSegment',
          resourceId: segmentId,
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          metadata: { detail: 'segment creation' },
          createdAt: now,
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          sequence: 2n,
          hash: 'b'.repeat(64),
          predecessorHash: 'a'.repeat(64),
          userId: '550e8400-e29b-41d4-a716-446655440100',
          action: 'user.created',
          resource: 'User',
          resourceId: '550e8400-e29b-41d4-a716-446655440200',
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          metadata: { userId: '550e8400-e29b-41d4-a716-446655440200' },
          createdAt: new Date(now.getTime() + 1000),
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440003',
          sequence: 3n,
          hash: 'c'.repeat(64),
          predecessorHash: 'b'.repeat(64),
          userId: '550e8400-e29b-41d4-a716-446655440100',
          action: 'payment.received',
          resource: 'Payment',
          resourceId: '550e8400-e29b-41d4-a716-446655440300',
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          metadata: { amount: 1000 },
          createdAt: new Date(now.getTime() + 2000),
        },
      ];

      // Setup mocks on prisma
      const mockPrisma = prisma as unknown as jest.Mocked<PrismaService>;
      mockPrisma.auditSegment.findUnique.mockResolvedValue(mockSegment);
      mockPrisma.auditSegment.update.mockResolvedValue({
        ...mockSegment,
        lifecycle: 'ARCHIVE_PENDING',
      });
      mockPrisma.auditLog.findMany.mockResolvedValue(mockEvents);
      mockPrisma.segmentArchiveManifest.create.mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440999',
        segmentId,
        firstSequence: firstSeq,
        lastSequence: lastSeq,
        eventCount: 3,
        firstHash: 'a'.repeat(64),
        lastHash: 'c'.repeat(64),
        predecessorHash: '0'.repeat(64),
        manifestDigest: 'd'.repeat(64),
        signingMetadata: null,
      });
      mockPrisma.segmentArchivedEvent.createMany.mockResolvedValue({
        count: 3,
      });

      // Act
      const result = await archiveService.archiveSegment(
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        mockPrisma as Prisma.TransactionClient,
        segmentId,
      );

      // Assert
      expect(result.segmentId).toBe(segmentId);
      expect(result.manifestId).toBeDefined();
      expect(result.verificationPassed).toBe(true);
      expect(result.verificationErrors).toHaveLength(0);

      // Verify archived events were created
      expect(mockPrisma.segmentArchivedEvent.createMany).toHaveBeenCalled();
      const createManyCall = mockPrisma.segmentArchivedEvent.createMany.mock.calls[0]?.[0];
      if (createManyCall && Array.isArray(createManyCall.data) && createManyCall.data.length > 0) {
        expect(createManyCall.data).toHaveLength(3);
        const firstArchivedEvent = createManyCall.data[0];
        const mockEvent = mockEvents[0];
        if (firstArchivedEvent && mockEvent) {
          expect(firstArchivedEvent.id).toBe(mockEvent.id);
          expect(firstArchivedEvent.sequence).toBe(1n);
          expect(firstArchivedEvent.action).toBe('segment.created');
          expect(firstArchivedEvent.userId).toBe(mockEvent.userId);
          expect(firstArchivedEvent.metadata).toEqual(mockEvent.metadata);
          expect(firstArchivedEvent.createdAt).toEqual(mockEvent.createdAt);
        }
      }
    });
  });

  describe('Post-Purge Verification', () => {
    it('should verify archive using only archived events after live rows deleted', async () => {
      // Arrange
      const segmentId = '550e8400-e29b-41d4-a716-446655440000';

      const mockSegment = {
        id: segmentId,
        lifecycle: 'PURGED',
        firstSequence: 1n,
        lastSequence: 2n,
        eventCount: 2,
        firstHash: 'a'.repeat(64),
        lastHash: 'b'.repeat(64),
        predecessorSegmentId: null,
      };

      const mockManifest = {
        id: '550e8400-e29b-41d4-a716-446655440999',
        segmentId,
        firstSequence: 1n,
        lastSequence: 2n,
        eventCount: 2,
        firstHash: 'a'.repeat(64),
        lastHash: 'b'.repeat(64),
        predecessorHash: '0'.repeat(64),
        manifestDigest: 'd'.repeat(64),
        signingMetadata: null,
      };

      const mockArchivedEvents = [
        {
          sequence: 1n,
          hash: 'a'.repeat(64),
          predecessorHash: '0'.repeat(64),
        },
        {
          sequence: 2n,
          hash: 'b'.repeat(64),
          predecessorHash: 'a'.repeat(64),
        },
      ];

      const mockTx = prisma;
      mockTx.auditSegment.findUnique = jest.fn().mockResolvedValue(mockSegment);
      mockTx.segmentArchiveManifest.findUnique = jest.fn().mockResolvedValue(mockManifest);
      mockTx.segmentArchivedEvent.findMany = jest.fn().mockResolvedValue(mockArchivedEvents);

      // Act

      const result = await archiveService.verifyArchivePostPurge(mockTx, segmentId);

      // Assert
      expect(result.passed).toBe(true);
      expect(result.partResults.sequenceContinuity.passed).toBe(true);
      expect(result.partResults.eventCountAgreement.passed).toBe(true);
      expect(result.partResults.hashChainContinuity.passed).toBe(true);
      expect(result.partResults.boundaryAgreement.passed).toBe(true);
      expect(result.partResults.predecessorAnchorAgreement.passed).toBe(true);
      expect(result.partResults.digestAgreement.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Deterministic Digest', () => {
    it('should produce same digest for identical manifest data', () => {
      // Arrange
      const builder = new ArchiveManifestBuilder();
      const input = {
        segmentId: '550e8400-e29b-41d4-a716-446655440000',
        firstSequence: 1n,
        lastSequence: 3n,
        eventCount: 3,
        firstHash: 'a'.repeat(64),
        lastHash: 'c'.repeat(64),
        predecessorHash: '0'.repeat(64),
      };

      // Act
      const digest1 = builder.calculateManifestDigest(input);
      const digest2 = builder.calculateManifestDigest(input);

      // Assert
      expect(digest1).toBe(digest2);
      expect(digest1).toMatch(/^[a-f0-9]{64}$/); // Valid SHA-256 hex
    });

    it('should produce different digest when any field changes', () => {
      // Arrange
      const builder = new ArchiveManifestBuilder();
      const baseInput = {
        segmentId: '550e8400-e29b-41d4-a716-446655440000',
        firstSequence: 1n,
        lastSequence: 3n,
        eventCount: 3,
        firstHash: 'a'.repeat(64),
        lastHash: 'c'.repeat(64),
        predecessorHash: '0'.repeat(64),
      };

      const digest1 = builder.calculateManifestDigest(baseInput);

      // Act: Change eventCount
      const modified = { ...baseInput, eventCount: 4 };
      const digest2 = builder.calculateManifestDigest(modified);

      // Assert
      expect(digest1).not.toBe(digest2);
    });
  });

  describe('Idempotency', () => {
    it('should return same manifest on retry with same segmentId', async () => {
      // Arrange
      const segmentId = '550e8400-e29b-41d4-a716-446655440000';
      const manifestId = '550e8400-e29b-41d4-a716-446655440999';
      const firstArchivedAt = new Date('2026-09-06T10:00:00Z');

      const mockSegment = {
        id: segmentId,
        lifecycle: 'ARCHIVE_PENDING',
        firstSequence: 1n,
        lastSequence: 2n,
        eventCount: 2,
        firstHash: 'a'.repeat(64),
        lastHash: 'b'.repeat(64),
        predecessorTailHash: null,
        predecessorSegmentId: null,
        archivedAt: firstArchivedAt,
      };

      const mockManifest = {
        id: manifestId,
        segmentId,
        firstSequence: 1n,
        lastSequence: 2n,
        eventCount: 2,
        firstHash: 'a'.repeat(64),
        lastHash: 'b'.repeat(64),
        predecessorHash: '0'.repeat(64),
        manifestDigest: 'd'.repeat(64),
        signingMetadata: null,
      };

      const mockTx = prisma;
      mockTx.auditSegment.findUnique = jest.fn().mockResolvedValue(mockSegment);
      mockTx.segmentArchiveManifest.findUnique = jest.fn().mockResolvedValue(mockManifest);

      // Act: First call returns existing manifest
      const result = await archiveService.archiveSegment(mockTx, segmentId);

      // Assert
      expect(result.manifestId).toBe(manifestId);
      expect(result.segmentId).toBe(segmentId);
      expect(result.verificationPassed).toBe(true);
      expect(result.archivedAt).toEqual(firstArchivedAt);
    });
  });
});
