import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';

import { BankAccountsService } from './bank-accounts.service';

import type { AuditService } from '../audit/audit.service';
import type { PrismaService } from '../prisma/prisma.service';

const userId = '11111111-1111-4111-8111-111111111111';
const accountId = '22222222-2222-4222-8222-222222222222';

interface BankAccountsPrismaMock {
  customerBankAccount: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  withdrawalRequest: {
    findFirst: jest.Mock;
  };
  $transaction: jest.Mock;
}

function account(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: accountId,
    userId,
    bankName: 'GTBank',
    bankCode: '058',
    accountName: 'Stab Tester',
    accountNumber: '0123456789',
    isDefault: true,
    accountNameVerifiedAt: null,
    createdAt: new Date('2026-08-04T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

describe('BankAccountsService', () => {
  let prisma: BankAccountsPrismaMock;
  let auditService: { record: jest.Mock };
  let resolver: { configured: boolean; resolveAccountName: jest.Mock; listBanks: jest.Mock };
  let service: BankAccountsService;

  beforeEach(() => {
    prisma = {
      customerBankAccount: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      withdrawalRequest: { findFirst: jest.fn() },
      $transaction: jest.fn(),
    };
    auditService = { record: jest.fn().mockResolvedValue(undefined) };
    // Unconfigured by default, which is the pre-Phase-0 world: the existing
    // tests below describe behaviour that must not change when no resolver is
    // available.
    resolver = { configured: false, resolveAccountName: jest.fn(), listBanks: jest.fn() };
    service = new BankAccountsService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
      resolver,
    );
  });

  describe('name enquiry', () => {
    it('stores the name the bank returns, not the one the customer typed', async () => {
      resolver.configured = true;
      resolver.resolveAccountName.mockResolvedValue({ accountName: 'IBRAHIM SAEED ABDULLAHI' });
      prisma.customerBankAccount.findFirst.mockResolvedValue(null);
      prisma.customerBankAccount.count.mockResolvedValue(0);
      prisma.customerBankAccount.create.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) => account(data),
      );

      const result = await service.add(userId, {
        bankName: 'GTBank',
        bankCode: '058',
        // What the customer typed. The bank disagrees, and the bank wins.
        accountName: 'saeed',
        accountNumber: '0123456789',
      });

      expect(resolver.resolveAccountName).toHaveBeenCalledWith({
        accountNumber: '0123456789',
        bankCode: '058',
      });
      expect(result.accountName).toBe('IBRAHIM SAEED ABDULLAHI');
      expect(result.accountNameVerified).toBe(true);
    });

    it('does not save an account the bank refuses to confirm', async () => {
      resolver.configured = true;
      resolver.resolveAccountName.mockRejectedValue(
        new ValidationDomainException('Could not resolve account name'),
      );
      prisma.customerBankAccount.findFirst.mockResolvedValue(null);
      prisma.customerBankAccount.count.mockResolvedValue(0);

      await expect(
        service.add(userId, {
          bankName: 'GTBank',
          bankCode: '058',
          accountName: 'Stab Tester',
          // One digit off a real account is still a valid-looking number.
          // Refusing it here is the entire point of Phase 0.
          accountNumber: '0123456788',
        }),
      ).rejects.toBeInstanceOf(ValidationDomainException);

      expect(prisma.customerBankAccount.create).not.toHaveBeenCalled();
    });

    it('refuses to save unverified when a resolver is live but no bank was chosen', async () => {
      resolver.configured = true;
      prisma.customerBankAccount.findFirst.mockResolvedValue(null);
      prisma.customerBankAccount.count.mockResolvedValue(0);

      await expect(
        service.add(userId, {
          bankName: 'GTBank',
          accountName: 'Stab Tester',
          accountNumber: '0123456789',
        }),
      ).rejects.toBeInstanceOf(ValidationDomainException);

      // Silently downgrading to self-attested is how the guarantee would rot.
      expect(resolver.resolveAccountName).not.toHaveBeenCalled();
      expect(prisma.customerBankAccount.create).not.toHaveBeenCalled();
    });

    it('still saves self-attested when no resolver is configured', async () => {
      prisma.customerBankAccount.findFirst.mockResolvedValue(null);
      prisma.customerBankAccount.count.mockResolvedValue(0);
      prisma.customerBankAccount.create.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) => account(data),
      );

      const result = await service.add(userId, {
        bankName: 'GTBank',
        accountName: 'Stab Tester',
        accountNumber: '0123456789',
      });

      // Null is "nobody asked", not "the bank said no" — and it must not
      // block an environment that has no Paystack credentials.
      expect(result.accountNameVerified).toBe(false);
      expect(result.accountName).toBe('Stab Tester');
    });

    it('offers no banks when no resolver is configured', async () => {
      await expect(service.listBanks()).resolves.toEqual([]);
      expect(resolver.listBanks).not.toHaveBeenCalled();
    });
  });

  describe('add', () => {
    it('marks the first linked account as default', async () => {
      prisma.customerBankAccount.findFirst.mockResolvedValue(null);
      prisma.customerBankAccount.count.mockResolvedValue(0);
      prisma.customerBankAccount.create.mockResolvedValue(account());

      const result = await service.add(userId, {
        bankName: 'GTBank',
        accountName: 'Stab Tester',
        accountNumber: '0123456789',
      });

      expect(prisma.customerBankAccount.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isDefault: true }) }),
      );
      expect(result.isDefault).toBe(true);
      expect(auditService.record).toHaveBeenCalled();
    });

    it('does not default a second account', async () => {
      prisma.customerBankAccount.findFirst.mockResolvedValue(null);
      prisma.customerBankAccount.count.mockResolvedValue(1);
      prisma.customerBankAccount.create.mockResolvedValue(account({ isDefault: false }));

      await service.add(userId, {
        bankName: 'Access Bank',
        accountName: 'Stab Tester',
        accountNumber: '9876543210',
      });

      expect(prisma.customerBankAccount.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isDefault: false }) }),
      );
    });

    it('rejects a duplicate account number for the same user', async () => {
      prisma.customerBankAccount.findFirst.mockResolvedValue(account());

      await expect(
        service.add(userId, {
          bankName: 'GTBank',
          accountName: 'Stab Tester',
          accountNumber: '0123456789',
        }),
      ).rejects.toThrow(ConflictDomainException);
      expect(prisma.customerBankAccount.create).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('throws when the account does not belong to the user', async () => {
      prisma.customerBankAccount.findFirst.mockResolvedValue(null);

      await expect(service.remove(userId, accountId)).rejects.toThrow(NotFoundDomainException);
    });

    it('refuses to remove an account with a pending withdrawal', async () => {
      prisma.customerBankAccount.findFirst.mockResolvedValue(account());
      prisma.withdrawalRequest.findFirst.mockResolvedValue({ id: 'w1', status: 'PENDING' });

      await expect(service.remove(userId, accountId)).rejects.toThrow(ValidationDomainException);
      expect(prisma.customerBankAccount.update).not.toHaveBeenCalled();
    });

    it('reassigns default to the next oldest account when the default is removed', async () => {
      prisma.customerBankAccount.findFirst
        .mockResolvedValueOnce(account({ isDefault: true }))
        .mockResolvedValueOnce(account({ id: 'next', isDefault: false }));
      prisma.withdrawalRequest.findFirst.mockResolvedValue(null);
      prisma.customerBankAccount.update.mockResolvedValue(account());

      await service.remove(userId, accountId);

      expect(prisma.customerBankAccount.update).toHaveBeenCalledWith({
        where: { id: accountId },
        data: { deletedAt: expect.any(Date) as Date, isDefault: false },
      });
      expect(prisma.customerBankAccount.update).toHaveBeenCalledWith({
        where: { id: 'next' },
        data: { isDefault: true },
      });
    });
  });

  describe('assertOwned', () => {
    it('returns the account when owned by the user', async () => {
      prisma.customerBankAccount.findFirst.mockResolvedValue(account());

      const result = await service.assertOwned(userId, accountId);

      expect(result).toEqual(account());
    });

    it('throws NotFoundDomainException when not owned', async () => {
      prisma.customerBankAccount.findFirst.mockResolvedValue(null);

      await expect(service.assertOwned(userId, accountId)).rejects.toThrow(NotFoundDomainException);
    });
  });
});
