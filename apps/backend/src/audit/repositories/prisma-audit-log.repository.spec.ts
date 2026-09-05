/* eslint-disable @typescript-eslint/no-deprecated */
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
});
