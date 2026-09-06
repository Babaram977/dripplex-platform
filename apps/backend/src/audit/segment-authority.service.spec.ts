import { type Prisma } from '@prisma/client';

import { type PrismaAuditSegmentRepository } from './repositories/prisma-audit-segment.repository';
import { SegmentAuthorityService } from './segment-authority.service';

describe('SegmentAuthorityService', () => {
  let service: SegmentAuthorityService;
  let mockAuditSegmentRepository: jest.Mocked<PrismaAuditSegmentRepository>;

  const mockStreamState = {
    id: 'main',
    nextSequence: 1n,
    tailHash: '0000000000000000000000000000000000000000000000000000000000000000',
    activeSegmentId: '00000000-0000-0000-0000-000000000001',
    lastSegmentClosedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockActiveSegment = {
    id: '00000000-0000-0000-0000-000000000001',
    lifecycle: 'ACTIVE' as const,
    firstSequence: 1n,
    lastSequence: 0n,
    firstHash: '0000000000000000000000000000000000000000000000000000000000000000',
    lastHash: '0000000000000000000000000000000000000000000000000000000000000000',
    eventCount: 0,
    predecessorSegmentId: null,
    predecessorTailHash: null,
    closedAt: null,
    closureReason: null,
    archivedAt: null,
    archiveVerifiedAt: null,
    archiveChecksum: null,
    purgeAuthorizedAt: null,
    purgeAuthorizedBy: null,
    purgedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockAuditSegmentRepository = {
      closeSegment: jest.fn(),
    };
    service = new SegmentAuthorityService(mockAuditSegmentRepository);
  });

  describe('allocateSequenceAndObtainTail', () => {
    // Helper function to create a properly mocked transaction client
    const createMockTx = (
      streamStateOverride?: typeof mockStreamState,
      segmentOverride?: Record<string, unknown>,
    ): Prisma.TransactionClient => {
      const streamState = streamStateOverride ?? mockStreamState;
      const segment = {
        ...mockActiveSegment,
        ...segmentOverride,
      };

      return {
        $queryRaw: jest.fn().mockResolvedValue([
          {
            id: streamState.id,
            next_sequence: streamState.nextSequence,
            tail_hash: streamState.tailHash,
            active_segment_id: streamState.activeSegmentId,
          },
        ]),
        auditStreamState: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(streamState),
        },
        auditSegment: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(segment),
        },
      } as unknown as Prisma.TransactionClient;
    };

    it('should allocate nextSequence from stream state', async () => {
      const mockTx = createMockTx();

      const result = await service.allocateSequenceAndObtainTail(mockTx);

      expect(result.sequence).toBe(1n);
      expect(mockTx.auditStreamState.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: 'main' },
      });
    });

    it('should return activeSegmentId from stream state', async () => {
      const mockTx = createMockTx();

      const result = await service.allocateSequenceAndObtainTail(mockTx);

      expect(result.segmentId).toBe('00000000-0000-0000-0000-000000000001');
    });

    it('should return predecessorHash from stream state tail', async () => {
      const mockTx = createMockTx();

      const result = await service.allocateSequenceAndObtainTail(mockTx);

      expect(result.predecessorHash).toBe(
        '0000000000000000000000000000000000000000000000000000000000000000',
      );
    });

    it('should throw error if ACTIVE segment is not ACTIVE', async () => {
      const mockTx = createMockTx(mockStreamState, { lifecycle: 'CLOSED' as const });

      await expect(service.allocateSequenceAndObtainTail(mockTx)).rejects.toThrow('not ACTIVE');
    });

    it('should validate segment is really ACTIVE (concurrency check)', async () => {
      const mockTx = createMockTx();

      await service.allocateSequenceAndObtainTail(mockTx);

      expect(mockTx.auditSegment.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: '00000000-0000-0000-0000-000000000001' },
      });
    });
  });
});
