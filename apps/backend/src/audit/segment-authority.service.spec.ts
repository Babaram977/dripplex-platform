import { type Prisma } from '@prisma/client';

import { SegmentAuthorityService } from './segment-authority.service';

describe('SegmentAuthorityService', () => {
  let service: SegmentAuthorityService;

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
    service = new SegmentAuthorityService();
  });

  describe('allocateSequenceAndObtainTail', () => {
    it('should allocate nextSequence from stream state', async () => {
      const mockTx = {
        auditStreamState: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(mockStreamState),
        },
        auditSegment: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(mockActiveSegment),
        },
      } as unknown as Prisma.TransactionClient;

      const result = await service.allocateSequenceAndObtainTail(mockTx);

      expect(result.sequence).toBe(1n);
      expect(mockTx.auditStreamState.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: 'main' },
      });
    });

    it('should return activeSegmentId from stream state', async () => {
      const mockTx = {
        auditStreamState: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(mockStreamState),
        },
        auditSegment: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(mockActiveSegment),
        },
      } as unknown as Prisma.TransactionClient;

      const result = await service.allocateSequenceAndObtainTail(mockTx);

      expect(result.segmentId).toBe('00000000-0000-0000-0000-000000000001');
    });

    it('should return predecessorHash from stream state tail', async () => {
      const mockTx = {
        auditStreamState: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(mockStreamState),
        },
        auditSegment: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(mockActiveSegment),
        },
      } as unknown as Prisma.TransactionClient;

      const result = await service.allocateSequenceAndObtainTail(mockTx);

      expect(result.predecessorHash).toBe(
        '0000000000000000000000000000000000000000000000000000000000000000',
      );
    });

    it('should throw error if ACTIVE segment is not ACTIVE', async () => {
      const closedSegment = { ...mockActiveSegment, lifecycle: 'CLOSED' };

      const mockTx = {
        auditStreamState: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(mockStreamState),
        },
        auditSegment: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(closedSegment),
        },
      } as unknown as Prisma.TransactionClient;

      await expect(service.allocateSequenceAndObtainTail(mockTx)).rejects.toThrow('not ACTIVE');
    });

    it('should validate segment is really ACTIVE (concurrency check)', async () => {
      const mockTx = {
        auditStreamState: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(mockStreamState),
        },
        auditSegment: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(mockActiveSegment),
        },
      } as unknown as Prisma.TransactionClient;

      await service.allocateSequenceAndObtainTail(mockTx);

      expect(mockTx.auditSegment.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: '00000000-0000-0000-0000-000000000001' },
      });
    });
  });
});
