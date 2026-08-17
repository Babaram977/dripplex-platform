import { WalletOwnerType, WithdrawalRequestStatus } from '@prisma/client';

import {
  ForbiddenDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';

import { WithdrawalService } from './withdrawal.service';

import type { BankAccountsService } from './bank-accounts.service';
import type { WalletPinService } from './wallet-pin.service';
import type { WalletService } from './wallet.service';
import type { AuditService } from '../audit/audit.service';
import type { DomainEventBus } from '../events/domain-event-bus';
import type { PrismaService } from '../prisma/prisma.service';

const userId = '11111111-1111-4111-8111-111111111111';
const adminId = '99999999-9999-4999-8999-999999999999';
const bankAccountId = '22222222-2222-4222-8222-222222222222';
const walletId = '33333333-3333-4333-8333-333333333333';
const requestId = '44444444-4444-4444-8444-444444444444';

interface WithdrawalPrismaMock {
  withdrawalRequest: {
    create: jest.Mock;
    update: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    findUnique: jest.Mock;
  };
  // A reversal credits back the wallet that was actually debited, read from
  // the request's walletId rather than assumed to be the customer's.
  wallet: { findUnique: jest.Mock };
}

function request(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: requestId,
    userId,
    walletId,
    bankAccountId,
    amount: '5000',
    currency: 'NGN',
    status: WithdrawalRequestStatus.PENDING,
    failureReason: null,
    adminNote: null,
    processedByUserId: null,
    processedAt: null,
    createdAt: new Date('2026-08-04T00:00:00.000Z'),
    updatedAt: new Date('2026-08-04T00:00:00.000Z'),
    ...overrides,
  };
}

describe('WithdrawalService', () => {
  let prisma: WithdrawalPrismaMock;
  let walletService: {
    getWallet: jest.Mock;
    withdrawal: jest.Mock;
    credit: jest.Mock;
    assertWithinLimits: jest.Mock;
  };
  let bankAccountsService: { assertOwned: jest.Mock };
  let walletPinService: { verify: jest.Mock };
  let auditService: { record: jest.Mock };
  let eventBus: { emit: jest.Mock };
  let service: WithdrawalService;

  beforeEach(() => {
    prisma = {
      wallet: {
        findUnique: jest.fn().mockResolvedValue({
          id: walletId,
          ownerType: WalletOwnerType.CUSTOMER,
          ownerId: userId,
        }),
      },
      withdrawalRequest: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    walletService = {
      getWallet: jest
        .fn()
        .mockResolvedValue({ id: walletId, currency: 'NGN', availableBalance: 10000 }),
      withdrawal: jest.fn(),
      credit: jest.fn(),
      assertWithinLimits: jest.fn().mockResolvedValue(undefined),
    };
    bankAccountsService = { assertOwned: jest.fn().mockResolvedValue({ id: bankAccountId }) };
    walletPinService = { verify: jest.fn().mockResolvedValue(undefined) };
    auditService = { record: jest.fn().mockResolvedValue(undefined) };
    eventBus = { emit: jest.fn().mockResolvedValue(undefined) };

    service = new WithdrawalService(
      prisma as unknown as PrismaService,
      walletService as unknown as WalletService,
      bankAccountsService as unknown as BankAccountsService,
      walletPinService as unknown as WalletPinService,
      auditService as unknown as AuditService,
      eventBus as unknown as DomainEventBus,
    );
  });

  describe('create', () => {
    it('rejects an amount below the minimum', async () => {
      await expect(
        service.create(userId, WalletOwnerType.CUSTOMER, { amount: 1, bankAccountId, pin: '1234' }),
      ).rejects.toThrow(ValidationDomainException);
      expect(walletPinService.verify).not.toHaveBeenCalled();
    });

    it('verifies the PIN and owns the bank account before debiting', async () => {
      prisma.withdrawalRequest.create.mockResolvedValue(request());
      walletService.withdrawal.mockResolvedValue({ id: walletId });

      await service.create(userId, WalletOwnerType.CUSTOMER, {
        amount: 5000,
        bankAccountId,
        pin: '1234',
      });

      expect(walletPinService.verify).toHaveBeenCalledWith(userId, '1234');
      expect(bankAccountsService.assertOwned).toHaveBeenCalledWith(userId, bankAccountId);
      expect(walletService.withdrawal).toHaveBeenCalledWith(
        expect.objectContaining({ ownerId: userId, amount: 5000, referenceId: requestId }),
      );
      expect(eventBus.emit).toHaveBeenCalledWith(
        'WithdrawalRequested',
        expect.objectContaining({ withdrawalId: requestId }),
        expect.anything(),
      );
    });

    it('marks the request FAILED and rethrows when the debit fails (insufficient balance)', async () => {
      prisma.withdrawalRequest.create.mockResolvedValue(request());
      walletService.withdrawal.mockRejectedValue(
        new ValidationDomainException('Insufficient wallet balance'),
      );
      prisma.withdrawalRequest.update.mockResolvedValue(
        request({ status: WithdrawalRequestStatus.FAILED }),
      );

      await expect(
        service.create(userId, WalletOwnerType.CUSTOMER, {
          amount: 5000,
          bankAccountId,
          pin: '1234',
        }),
      ).rejects.toThrow(ValidationDomainException);

      expect(prisma.withdrawalRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: requestId },
          data: expect.objectContaining({ status: WithdrawalRequestStatus.FAILED }),
        }),
      );
      expect(eventBus.emit).not.toHaveBeenCalled();
    });
  });

  describe('getForUser', () => {
    it('throws NotFoundDomainException when the request does not exist', async () => {
      prisma.withdrawalRequest.findUnique.mockResolvedValue(null);

      await expect(service.getForUser(userId, requestId)).rejects.toThrow(NotFoundDomainException);
    });

    it('throws ForbiddenDomainException when the request belongs to someone else', async () => {
      prisma.withdrawalRequest.findUnique.mockResolvedValue(request({ userId: 'someone-else' }));

      await expect(service.getForUser(userId, requestId)).rejects.toThrow(ForbiddenDomainException);
    });
  });

  describe('adminComplete', () => {
    it('rejects completing a non-PENDING request', async () => {
      prisma.withdrawalRequest.findUnique.mockResolvedValue(
        request({ status: WithdrawalRequestStatus.COMPLETED }),
      );

      await expect(service.adminComplete(adminId, requestId, undefined)).rejects.toThrow(
        ValidationDomainException,
      );
    });

    it('marks the request COMPLETED and does not touch the wallet', async () => {
      prisma.withdrawalRequest.findUnique.mockResolvedValue(request());
      prisma.withdrawalRequest.update.mockResolvedValue(
        request({ status: WithdrawalRequestStatus.COMPLETED }),
      );

      const result = await service.adminComplete(adminId, requestId, 'Paid via bank transfer');

      expect(result.status).toBe(WithdrawalRequestStatus.COMPLETED);
      expect(walletService.credit).not.toHaveBeenCalled();
      expect(eventBus.emit).toHaveBeenCalledWith(
        'WithdrawalCompleted',
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe('adminFail', () => {
    it('reverses the debit via a real wallet credit referencing the same request id', async () => {
      prisma.withdrawalRequest.findUnique.mockResolvedValue(request());
      prisma.withdrawalRequest.update.mockResolvedValue(
        request({
          status: WithdrawalRequestStatus.FAILED,
          failureReason: 'Bank rejected transfer',
        }),
      );

      await service.adminFail(adminId, requestId, 'Bank rejected transfer');

      expect(walletService.credit).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: userId,
          amount: 5000,
          referenceId: requestId,
          referenceType: 'wallet_withdrawal_reversal',
        }),
      );
      expect(eventBus.emit).toHaveBeenCalledWith(
        'WithdrawalFailed',
        expect.anything(),
        expect.anything(),
      );
    });

    it('rejects failing a non-PENDING request', async () => {
      prisma.withdrawalRequest.findUnique.mockResolvedValue(
        request({ status: WithdrawalRequestStatus.FAILED }),
      );

      await expect(service.adminFail(adminId, requestId, 'reason')).rejects.toThrow(
        ValidationDomainException,
      );
      expect(walletService.credit).not.toHaveBeenCalled();
    });
  });
});
