/* eslint-disable @typescript-eslint/no-deprecated, @typescript-eslint/no-explicit-any */
import { type Prisma } from '@prisma/client';

import { PrismaAuditLogRepository } from './prisma-audit-log.repository';

import type { AuditEventForAppend } from './audit-log.repository';

describe('PrismaAuditLogRepository', () => {
  const mockPrismaService = {
    auditLog: {
      create: jest.fn(),
    },
  };

  const mockAuditRecord = {
    id: 'audit-id',
    action: 'TEST_ACTION',
    userId: 'user-id',
    resource: 'test',
    resourceId: 'resource-id',
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    metadata: {},
    createdAt: new Date(),
  };

  let repository: PrismaAuditLogRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    (mockPrismaService.auditLog.create).mockResolvedValue(mockAuditRecord);
    // Type assertion needed for mock: PrismaService interface mocking
     
    repository = new PrismaAuditLogRepository(mockPrismaService as any);
  });

  // ─────────────────────────────────────────────────────────────────
  // Repository append() tests (transaction-client usage verification)
  // ─────────────────────────────────────────────────────────────────

  describe('append(tx, event) — Transaction-Client Contract', () => {
    it('R2.1: should call tx.auditLog.create() (not this.prisma)', async () => {
      // Create a mock TransactionClient with auditLog
      const mockTx = {
        auditLog: {
          create: jest.fn().mockResolvedValue(mockAuditRecord),
        },
      } as unknown as Prisma.TransactionClient;

      const event: AuditEventForAppend = {
        action: 'TEST_ACTION',
        context: { userId: 'user-id' },
      };

      await repository.append(mockTx, event);

      // Verify tx.auditLog.create() was called
      expect(mockTx.auditLog.create).toHaveBeenCalled();
      // Verify root prisma was NOT called
      expect(mockPrismaService.auditLog.create).not.toHaveBeenCalled();
    });

    it('R2.2: should pass correct data structure to tx.auditLog.create()', async () => {
      const mockTx = {
        auditLog: {
          create: jest.fn().mockResolvedValue(mockAuditRecord),
        },
      } as unknown as Prisma.TransactionClient;

      const event: AuditEventForAppend = {
        action: 'WALLET_CREDITED',
        context: {
          userId: 'user-123',
          ipAddress: '192.168.1.1',
          userAgent: 'chrome/latest',
        },
        details: {
          resource: 'wallet',
          resourceId: 'wallet-456',
          metadata: { amount: 1000 },
        },
      };

      await repository.append(mockTx, event);

      expect(mockTx.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: 'WALLET_CREDITED',
          userId: 'user-123',
          ipAddress: '192.168.1.1',
          userAgent: 'chrome/latest',
          resource: 'wallet',
          resourceId: 'wallet-456',
          metadata: { amount: 1000 },
        },
      });
    });

    it('R2.3: should handle optional context fields', async () => {
      const mockTx = {
        auditLog: {
          create: jest.fn().mockResolvedValue(mockAuditRecord),
        },
      } as unknown as Prisma.TransactionClient;

      const event: AuditEventForAppend = {
        action: 'TEST_ACTION',
        context: { userId: 'user-id' }, // only userId, no ipAddress or userAgent
      };

      await repository.append(mockTx, event);

      expect(mockTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'TEST_ACTION',
            userId: 'user-id',
          }),
        }),
      );

      // Verify ipAddress and userAgent were not included
      const callData = (mockTx.auditLog.create as jest.Mock).mock.calls[0][0].data;
      expect(callData.ipAddress).toBeUndefined();
      expect(callData.userAgent).toBeUndefined();
    });

    it('R2.4: should return the created AuditLogRecord', async () => {
      const mockTx = {
        auditLog: {
          create: jest.fn().mockResolvedValue(mockAuditRecord),
        },
      } as unknown as Prisma.TransactionClient;

      const event: AuditEventForAppend = {
        action: 'TEST_ACTION',
        context: { userId: 'user-id' },
      };

      const result = await repository.append(mockTx, event);

      expect(result).toEqual(mockAuditRecord);
      expect(result.id).toBe('audit-id');
      expect(result.action).toBe('TEST_ACTION');
    });

    it('R2.5: should preserve metadata from event.details', async () => {
      const mockTx = {
        auditLog: {
          create: jest.fn().mockResolvedValue(mockAuditRecord),
        },
      } as unknown as Prisma.TransactionClient;

      const metadata = {
        walletId: 'wallet-123',
        amount: 5000,
        currency: 'NGN',
        transactionRef: 'txn-456',
      };

      const event: AuditEventForAppend = {
        action: 'WALLET_TRANSFERRED',
        context: { userId: 'user-id' },
        details: {
          resource: 'wallet',
          metadata,
        },
      };

      await repository.append(mockTx, event);

      expect(mockTx.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata,
        }),
      });
    });

    it('R2.6: should set default empty metadata if not provided', async () => {
      const mockTx = {
        auditLog: {
          create: jest.fn().mockResolvedValue(mockAuditRecord),
        },
      } as unknown as Prisma.TransactionClient;

      const event: AuditEventForAppend = {
        action: 'TEST_ACTION',
        context: { userId: 'user-id' },
        // details is undefined, so metadata should default to {}
      };

      await repository.append(mockTx, event);

      expect(mockTx.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: {},
        }),
      });
    });
  });

  describe('create(input) — Backward Compatibility', () => {
    it('should call this.prisma.auditLog.create()', async () => {
      const input = {
        action: 'TEST_ACTION',
        userId: 'user-id',
        resource: 'test',
      };

      await repository.create(input);

      expect(mockPrismaService.auditLog.create).toHaveBeenCalled();
    });

    it('should still work for non-transactional audit calls', async () => {
      const input = {
        action: 'LEGACY_ACTION',
        userId: 'user-id',
      };

      (mockPrismaService.auditLog.create).mockResolvedValue(mockAuditRecord);

      const result = await repository.create(input);

      expect(result).toEqual(mockAuditRecord);
      expect(mockPrismaService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'LEGACY_ACTION',
            userId: 'user-id',
          }),
        }),
      );
    });
  });

  describe('Critical: No Root-Prisma Fallback in append()', () => {
    it('RZ.1: append() must never call this.prisma.auditLog.create()', async () => {
      const mockTx = {
        auditLog: {
          create: jest.fn().mockResolvedValue(mockAuditRecord),
        },
      } as unknown as Prisma.TransactionClient;

      const event: AuditEventForAppend = {
        action: 'TEST_ACTION',
        context: { userId: 'user-id' },
      };

      await repository.append(mockTx, event);

      // CRITICAL: root prisma must NOT be called
      expect(mockPrismaService.auditLog.create).not.toHaveBeenCalled();
      // Only tx should be called
      expect(mockTx.auditLog.create).toHaveBeenCalled();
    });

    it('RZ.2: append() must use tx parameter, not this.prisma', async () => {
      const mockTx = {
        auditLog: {
          create: jest.fn().mockResolvedValue(mockAuditRecord),
        },
      } as unknown as Prisma.TransactionClient;

      const event: AuditEventForAppend = {
        action: 'TEST_ACTION',
        context: { userId: 'user-id' },
      };

      // Call append multiple times
      await repository.append(mockTx, event);
      await repository.append(mockTx, event);

      // Verify tx was used both times, never root prisma
      expect(mockTx.auditLog.create).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.auditLog.create).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // P1-B2 Extension: Segment Authority and Chain Integration
  // ─────────────────────────────────────────────────────────────────

  describe('P1-B2: Segment Authority & Chain Integration', () => {
    it('B2.1: append() inserts with non-NULL segment_id, sequence, hash, predecessor_hash', async () => {
      const mockTx = {
        auditLog: {
          create: jest.fn().mockResolvedValue({
            ...mockAuditRecord,
            segmentId: 'seg-123',
            sequence: 1n,
            hash: 'abc123',
            predecessorHash: 'def456',
          }),
        },
      } as unknown as Prisma.TransactionClient;

      const event: AuditEventForAppend = {
        action: 'TEST_ACTION',
        context: { userId: 'user-id' },
      };

      await repository.append(mockTx, event);

      const callData = (mockTx.auditLog.create as jest.Mock).mock.calls[0][0]
        .data;
      expect(callData.segmentId).toBeDefined();
      expect(callData.sequence).toBeDefined();
      expect(callData.hash).toBeDefined();
      expect(callData.predecessorHash).toBeDefined();
    });

    it('B2.2: append() calls segmentAuthorityService.allocateSequenceAndObtainTail()', async () => {
      const mockSegmentAuthorityService = {
        allocateSequenceAndObtainTail: jest
          .fn()
          .mockResolvedValue({
            segmentId: 'seg-123',
            sequence: 1n,
            predecessorHash: 'pred-hash',
          }),
      };

      const mockAuditChainService = {
        calculateEventHash: jest
          .fn()
          .mockResolvedValue('calculated-hash'),
      };

      const mockTx = {
        auditLog: {
          create: jest.fn().mockResolvedValue(mockAuditRecord),
        },
        auditSegment: {
          update: jest.fn().mockResolvedValue({}),
        },
        auditStreamState: {
          update: jest.fn().mockResolvedValue({}),
        },
      } as unknown as Prisma.TransactionClient;


       
      const repository2 = new PrismaAuditLogRepository(
        mockPrismaService as any,  
        mockSegmentAuthorityService,
        mockAuditChainService as any,  
      );

      const event: AuditEventForAppend = {
        action: 'TEST_ACTION',
        context: { userId: 'user-id' },
      };

      await repository2.append(mockTx, event);

      expect(
        mockSegmentAuthorityService.allocateSequenceAndObtainTail,
      ).toHaveBeenCalledWith(mockTx);
    });

    it('B2.3: append() calls auditChainService.calculateEventHash()', async () => {
      const mockSegmentAuthorityService = {
        allocateSequenceAndObtainTail: jest
          .fn()
          .mockResolvedValue({
            segmentId: 'seg-123',
            sequence: 1n,
            predecessorHash: 'pred-hash',
          }),
      };

      const mockAuditChainService = {
        calculateEventHash: jest
          .fn()
          .mockResolvedValue('calculated-hash'),
      };

      const mockTx = {
        auditLog: {
          create: jest.fn().mockResolvedValue(mockAuditRecord),
        },
        auditSegment: {
          update: jest.fn().mockResolvedValue({}),
        },
        auditStreamState: {
          update: jest.fn().mockResolvedValue({}),
        },
      } as unknown as Prisma.TransactionClient;


       
      const repository2 = new PrismaAuditLogRepository(
        mockPrismaService as any,  
        mockSegmentAuthorityService,
        mockAuditChainService as any,  
      );

      const event: AuditEventForAppend = {
        action: 'TEST_ACTION',
        context: { userId: 'user-id' },
      };

      await repository2.append(mockTx, event);

      expect(mockAuditChainService.calculateEventHash).toHaveBeenCalledWith(
        event,
        1n,
        'seg-123',
        'pred-hash',
      );
    });

    it('B2.4: append() updates segment tail (lastSequence, lastHash, eventCount)', async () => {
      const mockSegmentAuthorityService = {
        allocateSequenceAndObtainTail: jest
          .fn()
          .mockResolvedValue({
            segmentId: 'seg-123',
            sequence: 1n,
            predecessorHash: 'pred-hash',
          }),
      };

      const mockAuditChainService = {
        calculateEventHash: jest
          .fn()
          .mockResolvedValue('calculated-hash'),
      };

      const mockTx = {
        auditLog: {
          create: jest.fn().mockResolvedValue(mockAuditRecord),
        },
        auditSegment: {
          update: jest.fn().mockResolvedValue({}),
        },
        auditStreamState: {
          update: jest.fn().mockResolvedValue({}),
        },
      } as unknown as Prisma.TransactionClient;


       
      const repository2 = new PrismaAuditLogRepository(
        mockPrismaService as any,  
        mockSegmentAuthorityService,
        mockAuditChainService as any,  
      );

      const event: AuditEventForAppend = {
        action: 'TEST_ACTION',
        context: { userId: 'user-id' },
      };

      await repository2.append(mockTx, event);

      expect(mockTx.auditSegment.update).toHaveBeenCalledWith({
        where: { id: 'seg-123' },
        data: {
          lastSequence: 1n,
          lastHash: 'calculated-hash',
          eventCount: { increment: 1 },
        },
      });
    });

    it('B2.5: append() updates stream state (nextSequence, tailHash)', async () => {
      const mockSegmentAuthorityService = {
        allocateSequenceAndObtainTail: jest
          .fn()
          .mockResolvedValue({
            segmentId: 'seg-123',
            sequence: 1n,
            predecessorHash: 'pred-hash',
          }),
      };

      const mockAuditChainService = {
        calculateEventHash: jest
          .fn()
          .mockResolvedValue('calculated-hash'),
      };

      const mockTx = {
        auditLog: {
          create: jest.fn().mockResolvedValue(mockAuditRecord),
        },
        auditSegment: {
          update: jest.fn().mockResolvedValue({}),
        },
        auditStreamState: {
          update: jest.fn().mockResolvedValue({}),
        },
      } as unknown as Prisma.TransactionClient;


       
      const repository2 = new PrismaAuditLogRepository(
        mockPrismaService as any,  
        mockSegmentAuthorityService,
        mockAuditChainService as any,  
      );

      const event: AuditEventForAppend = {
        action: 'TEST_ACTION',
        context: { userId: 'user-id' },
      };

      await repository2.append(mockTx, event);

      expect(mockTx.auditStreamState.update).toHaveBeenCalledWith({
        where: { id: 'main' },
        data: {
          nextSequence: 2n,
          tailHash: 'calculated-hash',
        },
      });
    });

    it('B2.6: append() returns AuditLogRecord with all fields populated', async () => {
      const mockSegmentAuthorityService = {
        allocateSequenceAndObtainTail: jest
          .fn()
          .mockResolvedValue({
            segmentId: 'seg-123',
            sequence: 1n,
            predecessorHash: 'pred-hash',
          }),
      };

      const mockAuditChainService = {
        calculateEventHash: jest
          .fn()
          .mockResolvedValue('calculated-hash'),
      };

      const expectedRecord = {
        ...mockAuditRecord,
        segmentId: 'seg-123',
        sequence: 1n,
        hash: 'calculated-hash',
        predecessorHash: 'pred-hash',
      };

      const mockTx = {
        auditLog: {
          create: jest.fn().mockResolvedValue(expectedRecord),
        },
        auditSegment: {
          update: jest.fn().mockResolvedValue({}),
        },
        auditStreamState: {
          update: jest.fn().mockResolvedValue({}),
        },
      } as unknown as Prisma.TransactionClient;


       
      const repository2 = new PrismaAuditLogRepository(
        mockPrismaService as any,  
        mockSegmentAuthorityService,
        mockAuditChainService as any,  
      );

      const event: AuditEventForAppend = {
        action: 'TEST_ACTION',
        context: { userId: 'user-id' },
      };

      const result = await repository2.append(mockTx, event);

      expect(result.segmentId).toBe('seg-123');
      expect(result.sequence).toBe(1n);
      expect(result.hash).toBe('calculated-hash');
      expect(result.predecessorHash).toBe('pred-hash');
    });

    it('B2.7: append() transaction atomicity (all steps or none)', async () => {
      // This test verifies that if any step fails, the entire transaction rolls back
      const mockSegmentAuthorityService = {
        allocateSequenceAndObtainTail: jest
          .fn()
          .mockResolvedValue({
            segmentId: 'seg-123',
            sequence: 1n,
            predecessorHash: 'pred-hash',
          }),
      };

      const mockAuditChainService = {
        calculateEventHash: jest
          .fn()
          .mockResolvedValue('calculated-hash'),
      };

      const mockTx = {
        auditLog: {
          create: jest.fn().mockRejectedValue(new Error('Insert failed')),
        },
        auditSegment: {
          update: jest.fn(),
        },
        auditStreamState: {
          update: jest.fn(),
        },
      } as unknown as Prisma.TransactionClient;


       
      const repository2 = new PrismaAuditLogRepository(
        mockPrismaService as any,  
        mockSegmentAuthorityService,
        mockAuditChainService as any,  
      );

      const event: AuditEventForAppend = {
        action: 'TEST_ACTION',
        context: { userId: 'user-id' },
      };

      await expect(repository2.append(mockTx, event)).rejects.toThrow(
        'Insert failed',
      );

      // Update methods should not be called since insert failed
      expect(mockTx.auditSegment.update).not.toHaveBeenCalled();
      expect(mockTx.auditStreamState.update).not.toHaveBeenCalled();
    });
  });
});
