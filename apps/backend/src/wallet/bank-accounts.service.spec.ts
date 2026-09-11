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
    // Configured by default. Verification is mandatory for every persona as of
    // the founder decision of 2026-09-11, so a resolver that cannot be reached
    // is the exceptional case a test opts into, not the baseline.
    resolver = {
      configured: true,
      resolveAccountName: jest.fn().mockResolvedValue({ accountName: 'IBRAHIM SAEED ABDULLAHI' }),
      listBanks: jest.fn().mockResolvedValue([
        { name: 'Guaranty Trust Bank', code: '058' },
        { name: 'Access Bank', code: '044' },
      ]),
    };
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

    // A partner client that predates the bank picker sends a free-text bank
    // name and no code. That must not become a way to save an account the bank
    // never confirmed, so the name is resolved against the provider's list and
    // the same enquiry runs. The guarantee is "no account is stored unless the
    // bank confirmed it", not "the caller must know the code".
    it('resolves a free-text bank name to a code and still runs the enquiry', async () => {
      resolver.configured = true;
      resolver.listBanks.mockResolvedValue([{ name: 'Guaranty Trust Bank', code: '058' }]);
      resolver.resolveAccountName.mockResolvedValue({ accountName: 'IBRAHIM SAEED ABDULLAHI' });
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

      // "GTBank" is an alias, not the canonical name Paystack returns.
      expect(resolver.resolveAccountName).toHaveBeenCalledWith({
        accountNumber: '0123456789',
        bankCode: '058',
      });
      // The canonical name and code are what get stored, not the alias.
      expect(result.bankName).toBe('Guaranty Trust Bank');
      expect(result.accountName).toBe('IBRAHIM SAEED ABDULLAHI');
      expect(result.accountNameVerified).toBe(true);
    });

    it('refuses a bank name that resolves to no bank, without asking the bank', async () => {
      resolver.configured = true;
      resolver.listBanks.mockResolvedValue([{ name: 'Guaranty Trust Bank', code: '058' }]);
      prisma.customerBankAccount.findFirst.mockResolvedValue(null);
      prisma.customerBankAccount.count.mockResolvedValue(0);

      await expect(
        service.add(userId, {
          bankName: 'Not A Real Bank',
          accountName: 'Stab Tester',
          accountNumber: '0123456789',
        }),
      ).rejects.toBeInstanceOf(ValidationDomainException);

      // Silently downgrading to self-attested is how the guarantee would rot.
      expect(resolver.resolveAccountName).not.toHaveBeenCalled();
      expect(prisma.customerBankAccount.create).not.toHaveBeenCalled();
    });

    // The form calls this while the person is still filling it in, so the
    // account name they see is the bank's answer rather than their own typing.
    describe('resolveAccount (preview, stores nothing)', () => {
      it('returns the name the bank gives, with the canonical bank', async () => {
        resolver.configured = true;
        resolver.listBanks.mockResolvedValue([{ name: 'Guaranty Trust Bank', code: '058' }]);
        resolver.resolveAccountName.mockResolvedValue({ accountName: 'AL AMIN TIJJANI UMAR' });

        const result = await service.resolveAccount({
          bankName: 'GTBank',
          accountNumber: '0123456789',
        });

        expect(result).toEqual({
          accountName: 'AL AMIN TIJJANI UMAR',
          bankName: 'Guaranty Trust Bank',
          bankCode: '058',
        });
        // Nothing is written: this runs before the person has committed.
        expect(prisma.customerBankAccount.create).not.toHaveBeenCalled();
      });

      it('prefers a chosen bank code over the display name', async () => {
        resolver.configured = true;
        resolver.listBanks.mockResolvedValue([
          { name: 'Guaranty Trust Bank', code: '058' },
          { name: 'OPay Digital Services Limited (OPay)', code: '999992' },
        ]);
        resolver.resolveAccountName.mockResolvedValue({ accountName: 'SAMEER MOHSEEN' });

        const result = await service.resolveAccount({
          bankName: 'anything at all',
          bankCode: '999992',
          accountNumber: '8039739700',
        });

        expect(resolver.resolveAccountName).toHaveBeenCalledWith({
          accountNumber: '8039739700',
          bankCode: '999992',
        });
        expect(result.bankName).toBe('OPay Digital Services Limited (OPay)');
        expect(result.accountName).toBe('SAMEER MOHSEEN');
      });

      it('refuses when the bank cannot be identified, without asking the bank', async () => {
        resolver.configured = true;
        resolver.listBanks.mockResolvedValue([{ name: 'Guaranty Trust Bank', code: '058' }]);

        await expect(
          service.resolveAccount({ bankName: 'Not A Bank', accountNumber: '0123456789' }),
        ).rejects.toBeInstanceOf(ValidationDomainException);
        expect(resolver.resolveAccountName).not.toHaveBeenCalled();
      });

      it('refuses when no resolver is configured rather than inventing a name', async () => {
        resolver.configured = false;

        await expect(
          service.resolveAccount({ bankCode: '058', accountNumber: '0123456789' }),
        ).rejects.toBeInstanceOf(ValidationDomainException);
      });
    });

    // Founder decision 2026-09-11, reversing the Phase 0 compromise. This test
    // previously asserted the opposite — that an unconfigured environment
    // "still saves self-attested" — on the reasoning that degrading beat
    // refusing. It did not: `PayoutFulfillment` already refuses to pay an
    // unverified destination, so such a row was never a usable account. It was
    // a withdrawal that failed later, or one an operator paid out by hand to a
    // name nobody had checked.
    it('refuses to link anything when no resolver is configured', async () => {
      resolver.configured = false;
      prisma.customerBankAccount.findFirst.mockResolvedValue(null);
      prisma.customerBankAccount.count.mockResolvedValue(0);

      await expect(
        service.add(userId, {
          bankName: 'GTBank',
          accountName: 'Stab Tester',
          accountNumber: '0123456789',
        }),
      ).rejects.toBeInstanceOf(ValidationDomainException);

      expect(prisma.customerBankAccount.create).not.toHaveBeenCalled();
    });

    it('refuses an account number that is not a NUBAN, without asking the bank', async () => {
      prisma.customerBankAccount.findFirst.mockResolvedValue(null);
      prisma.customerBankAccount.count.mockResolvedValue(0);

      // The DTO used to accept 6-20 digits, so a six-digit number reached here
      // and was stored self-attested — name enquiry could never resolve it.
      await expect(
        service.add(userId, {
          bankName: 'GTBank',
          accountName: 'Stab Tester',
          accountNumber: '012345',
        }),
      ).rejects.toBeInstanceOf(ValidationDomainException);

      expect(resolver.resolveAccountName).not.toHaveBeenCalled();
      expect(prisma.customerBankAccount.create).not.toHaveBeenCalled();
    });

    it('ignores a typed account name entirely, even when the bank agrees', async () => {
      prisma.customerBankAccount.findFirst.mockResolvedValue(null);
      prisma.customerBankAccount.count.mockResolvedValue(0);
      prisma.customerBankAccount.create.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) => account(data),
      );

      // No account name supplied at all: a correct client no longer sends one,
      // because it was never what got stored.
      const result = await service.add(userId, {
        bankName: 'GTBank',
        bankCode: '058',
        accountNumber: '0123456789',
      });

      expect(result.accountName).toBe('IBRAHIM SAEED ABDULLAHI');
      expect(result.accountNameVerified).toBe(true);
    });

    it('offers no banks when no resolver is configured', async () => {
      resolver.configured = false;
      // An empty list is the signal that the form has nothing to offer. It used
      // to mean "fall back to free text"; `add` now refuses in this state, so a
      // client that still falls back is building a form that cannot succeed.
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
