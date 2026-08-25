import { UserStatus, WalletDirection, WalletTransactionType } from '@prisma/client';

import { WalletRecipientsService } from './wallet-recipients.service';

import type { PrismaService } from '../prisma/prisma.service';

const callerId = '11111111-1111-4111-8111-111111111111';
const recipientId = '22222222-2222-4222-8222-222222222222';

interface RecipientsPrismaMock {
  user: {
    findMany: jest.Mock;
  };
  walletLedgerEntry: {
    findMany: jest.Mock;
  };
}

function user(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: recipientId,
    firstName: 'Chidi',
    lastName: 'Okoro',
    phone: '+2348012345678',
    status: UserStatus.ACTIVE,
    ...overrides,
  };
}

describe('WalletRecipientsService', () => {
  let prisma: RecipientsPrismaMock;
  let service: WalletRecipientsService;

  beforeEach(() => {
    prisma = {
      user: { findMany: jest.fn() },
      walletLedgerEntry: { findMany: jest.fn() },
    };
    service = new WalletRecipientsService(prisma as unknown as PrismaService);
  });

  describe('findByPhone', () => {
    it('returns a masked recipient for an active-user phone match', async () => {
      prisma.user.findMany.mockResolvedValue([user()]);

      const result = await service.findByPhone(callerId, '+2348012345678');

      expect(result).toEqual({
        id: recipientId,
        firstName: 'Chidi',
        lastName: 'Okoro',
        maskedPhone: '+2348012****78',
      });
    });

    // The reported bug: the app sends the digits the sender typed, and the
    // account was stored in E.164 by super-app registration. An exact match
    // could never succeed, so transfer by phone never worked.
    it('finds an E.164 account from the local number the sender typed', async () => {
      prisma.user.findMany.mockResolvedValue([user()]);

      const result = await service.findByPhone(callerId, '08012345678');

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { phone: { in: expect.arrayContaining(['+2348012345678']) } },
      });
      expect(result?.id).toBe(recipientId);
    });

    it('finds a locally-stored account from an E.164 number', async () => {
      prisma.user.findMany.mockResolvedValue([user({ phone: '08012345678' })]);

      const result = await service.findByPhone(callerId, '+2348012345678');

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { phone: { in: expect.arrayContaining(['08012345678']) } },
      });
      expect(result?.maskedPhone).toBe('08012****78');
    });

    it('returns null when no user matches the phone', async () => {
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.findByPhone(callerId, '+2348099999999');

      expect(result).toBeNull();
    });

    it('does not query at all for input too short to identify anyone', async () => {
      const result = await service.findByPhone(callerId, '0803');

      expect(result).toBeNull();
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('returns null for the caller looking up their own phone', async () => {
      prisma.user.findMany.mockResolvedValue([user({ id: callerId })]);

      const result = await service.findByPhone(callerId, '+2348012345678');

      expect(result).toBeNull();
    });

    it('returns null for a non-active user', async () => {
      prisma.user.findMany.mockResolvedValue([user({ status: UserStatus.BLOCKED })]);

      const result = await service.findByPhone(callerId, '+2348012345678');

      expect(result).toBeNull();
    });

    // Registration stores the phone unnormalized, so one person can hold two
    // accounts under two spellings. Naming either would be guessing who
    // receives the money.
    it('refuses to choose when two accounts answer to the same number', async () => {
      prisma.user.findMany.mockResolvedValue([
        user({ phone: '+2348012345678' }),
        user({ id: '33333333-3333-4333-8333-333333333333', phone: '08012345678' }),
      ]);

      const result = await service.findByPhone(callerId, '08012345678');

      expect(result).toBeNull();
    });

    it('still resolves when the only other match is the caller themselves', async () => {
      prisma.user.findMany.mockResolvedValue([user({ id: callerId }), user()]);

      const result = await service.findByPhone(callerId, '08012345678');

      expect(result?.id).toBe(recipientId);
    });
  });

  describe('listRecent', () => {
    it("derives distinct recipients from the caller's own TRANSFER debit ledger metadata", async () => {
      prisma.walletLedgerEntry.findMany.mockResolvedValue([
        { metadata: { toOwnerId: recipientId } },
        { metadata: { toOwnerId: recipientId } },
      ]);
      prisma.user.findMany.mockResolvedValue([user()]);

      const result = await service.listRecent(callerId);

      expect(prisma.walletLedgerEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            wallet: { ownerId: callerId },
            type: WalletTransactionType.TRANSFER,
            direction: WalletDirection.DEBIT,
          },
        }),
      );
      expect(result).toEqual([
        {
          id: recipientId,
          firstName: 'Chidi',
          lastName: 'Okoro',
          maskedPhone: '+2348012****78',
        },
      ]);
    });

    it('returns an empty list when there is no transfer history', async () => {
      prisma.walletLedgerEntry.findMany.mockResolvedValue([]);

      const result = await service.listRecent(callerId);

      expect(result).toEqual([]);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
  });
});
