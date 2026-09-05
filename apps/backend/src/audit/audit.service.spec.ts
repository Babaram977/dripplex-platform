/* eslint-disable @typescript-eslint/no-deprecated */
import { type Prisma } from '@prisma/client';

import { AUTH_AUDIT_ACTIONS } from './audit.constants';
import { AuditService } from './audit.service';

import type { AuditLogRepository, AuditEventForAppend } from './repositories/audit-log.repository';

describe('AuditService', () => {
  const mockRepository = {
    create: jest.fn(),
    append: jest.fn(),
  } as unknown as jest.Mocked<AuditLogRepository>;

  const mockAuditRecord = {
    id: 'audit-id',
    action: AUTH_AUDIT_ACTIONS.REGISTRATION_COMPLETED,
    userId: 'user-id',
    resource: 'user',
    resourceId: 'user-id',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
    metadata: {},
    createdAt: new Date(),
  };

  let service: AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository.create.mockResolvedValue(mockAuditRecord);
    mockRepository.append.mockResolvedValue(mockAuditRecord);
    service = new AuditService(mockRepository);
  });

  // ─────────────────────────────────────────────────────────────────
  // CATEGORY 1: Interface Conformance (4 tests)
  // ─────────────────────────────────────────────────────────────────

  describe('T1.1: append() method exists on AuditService', () => {
    it('should have an append method', () => {
      expect(typeof service.append).toBe('function');
    });
  });

  describe('T1.2: append() accepts Prisma.TransactionClient parameter', () => {
    it('should accept tx as first parameter', async () => {
      const mockTx = {} as Prisma.TransactionClient;
      const event: AuditEventForAppend = {
        action: AUTH_AUDIT_ACTIONS.REGISTRATION_COMPLETED,
        context: { userId: 'user-id' },
      };

      await service.append(mockTx, event);

      expect(mockRepository.append).toHaveBeenCalledWith(mockTx, event);
    });
  });

  describe('T1.3: append() accepts AuditEventForAppend parameter', () => {
    it('should accept event with action, context, and details', async () => {
      const mockTx = {} as Prisma.TransactionClient;
      const event: AuditEventForAppend = {
        action: 'TEST_ACTION',
        context: { userId: 'user-id', ipAddress: '127.0.0.1' },
        details: { resource: 'test', resourceId: 'test-id' },
      };

      await service.append(mockTx, event);

      expect(mockRepository.append).toHaveBeenCalledWith(mockTx, event);
    });
  });

  describe('T1.4: append() returns Promise<void>', () => {
    it('should return a promise that resolves to void', async () => {
      const mockTx = {} as Prisma.TransactionClient;
      const event: AuditEventForAppend = {
        action: 'TEST_ACTION',
        context: { userId: 'user-id' },
      };

      const result = service.append(mockTx, event);
      expect(result instanceof Promise).toBe(true);

      // Verify the promise resolves without error
      await expect(result).resolves.toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // CATEGORY 2: Transaction-Client Usage (5 tests)
  // ─────────────────────────────────────────────────────────────────

  describe('T2.1: append() calls repository.append() (not create())', () => {
    it('should delegate to repository.append(), not repository.create()', async () => {
      const mockTx = {} as Prisma.TransactionClient;
      const event: AuditEventForAppend = {
        action: 'TEST_ACTION',
        context: { userId: 'user-id' },
      };

      await service.append(mockTx, event);

      expect(mockRepository.append).toHaveBeenCalled();
      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('T2.2: append() does not open nested $transaction()', () => {
    it('should pass tx to repository without wrapping in $transaction()', async () => {
      const mockTx = {} as Prisma.TransactionClient;
      const event: AuditEventForAppend = {
        action: 'TEST_ACTION',
        context: { userId: 'user-id' },
      };

      await service.append(mockTx, event);

      // Verify that append was called with the tx directly
      expect(mockRepository.append).toHaveBeenCalledWith(mockTx, event);
    });
  });

  describe('T2.3: append() propagates tx to repository correctly', () => {
    it('should pass the same tx instance to repository.append()', async () => {
      const mockTx = { auditLog: { create: jest.fn() } } as unknown as Prisma.TransactionClient;
      const event: AuditEventForAppend = {
        action: 'TEST_ACTION',
        context: { userId: 'user-id' },
      };

      await service.append(mockTx, event);

      const [passedTx] = (mockRepository.append as jest.Mock).mock.calls[0];
      expect(passedTx).toBe(mockTx);
    });
  });

  describe('T2.4: append() and record() use different paths', () => {
    it('should use append() for transaction-aware path', async () => {
      const mockTx = {} as Prisma.TransactionClient;
      const event: AuditEventForAppend = {
        action: 'TEST_ACTION',
        context: { userId: 'user-id' },
      };

      await service.append(mockTx, event);
      expect(mockRepository.append).toHaveBeenCalled();
    });

    it('should use create() for post-transaction path via record()', async () => {
      await service.record('TEST_ACTION', { userId: 'user-id' });
      expect(mockRepository.create).toHaveBeenCalled();
    });
  });

  describe('T2.5: append() does not fall back to root Prisma', () => {
    it('should only call repository.append(), never repository.create()', async () => {
      const mockTx = {} as Prisma.TransactionClient;
      const event: AuditEventForAppend = {
        action: 'TEST_ACTION',
        context: { userId: 'user-id' },
      };

      await service.append(mockTx, event);

      // Verify create() was not called (would indicate root-Prisma fallback)
      expect(mockRepository.create).not.toHaveBeenCalled();
      expect(mockRepository.append).toHaveBeenCalledTimes(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // CATEGORY 3: Event Propagation (3 tests)
  // ─────────────────────────────────────────────────────────────────

  describe('T3.1: action field propagates to repository', () => {
    it('should pass action from event to repository.append()', async () => {
      const mockTx = {} as Prisma.TransactionClient;
      const event: AuditEventForAppend = {
        action: 'CUSTOM_ACTION',
        context: { userId: 'user-id' },
      };

      await service.append(mockTx, event);

      expect(mockRepository.append).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({ action: 'CUSTOM_ACTION' }),
      );
    });
  });

  describe('T3.2: context fields propagate to repository', () => {
    it('should pass userId, ipAddress, userAgent to repository.append()', async () => {
      const mockTx = {} as Prisma.TransactionClient;
      const event: AuditEventForAppend = {
        action: 'TEST_ACTION',
        context: {
          userId: 'user-id',
          ipAddress: '192.168.1.1',
          userAgent: 'test-agent/1.0',
        },
      };

      await service.append(mockTx, event);

      expect(mockRepository.append).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          context: {
            userId: 'user-id',
            ipAddress: '192.168.1.1',
            userAgent: 'test-agent/1.0',
          },
        }),
      );
    });
  });

  describe('T3.3: details metadata propagates to repository', () => {
    it('should pass details.metadata to repository.append()', async () => {
      const mockTx = {} as Prisma.TransactionClient;
      const metadata = { amount: 100, currency: 'NGN' };
      const event: AuditEventForAppend = {
        action: 'WALLET_CREDITED',
        context: { userId: 'user-id' },
        details: {
          resource: 'wallet',
          resourceId: 'wallet-id',
          metadata,
        },
      };

      await service.append(mockTx, event);

      expect(mockRepository.append).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({
          details: expect.objectContaining({
            metadata,
          }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // CATEGORY 4: Backward Compatibility (3 tests)
  // ─────────────────────────────────────────────────────────────────

  describe('T4.1: record() method still exists and works', () => {
    it('should have a record method', () => {
      expect(typeof service.record).toBe('function');
    });

    it('should call record() successfully', async () => {
      await service.record(
        AUTH_AUDIT_ACTIONS.REGISTRATION_COMPLETED,
        { userId: 'user-id', ipAddress: '127.0.0.1', userAgent: 'jest' },
        { resource: 'user', resourceId: 'user-id' },
      );

      expect(mockRepository.create).toHaveBeenCalled();
    });
  });

  describe('T4.2: record() uses create() path (unchanged behavior)', () => {
    it('should delegate to repository.create() for non-authoritative audit', async () => {
      await service.record(
        AUTH_AUDIT_ACTIONS.REGISTRATION_COMPLETED,
        { userId: 'user-id' },
        { resource: 'user' },
      );

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AUTH_AUDIT_ACTIONS.REGISTRATION_COMPLETED,
          userId: 'user-id',
          resource: 'user',
        }),
      );
    });
  });

  describe('T4.3: record() and append() do not interfere', () => {
    it('should allow both paths to be used in sequence', async () => {
      const mockTx = {} as Prisma.TransactionClient;

      // Use append first
      await service.append(mockTx, {
        action: 'ACTION_1',
        context: { userId: 'user-id' },
      });

      // Then use record
      await service.record('ACTION_2', { userId: 'user-id' });

      expect(mockRepository.append).toHaveBeenCalledTimes(1);
      expect(mockRepository.create).toHaveBeenCalledTimes(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Additional: recordFailure() method (AD-02 requirement)
  // ─────────────────────────────────────────────────────────────────

  describe('recordFailure() method', () => {
    it('should exist and accept (action, context, details)', async () => {
      expect(typeof service.recordFailure).toBe('function');

      await service.recordFailure(
        'INFRASTRUCTURE_FAILURE',
        { userId: 'user-id', ipAddress: '127.0.0.1' },
        { resource: 'wallet', metadata: { error: 'timeout' } },
      );

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'INFRASTRUCTURE_FAILURE',
          userId: 'user-id',
          ipAddress: '127.0.0.1',
          resource: 'wallet',
        }),
      );
    });
  });
});
