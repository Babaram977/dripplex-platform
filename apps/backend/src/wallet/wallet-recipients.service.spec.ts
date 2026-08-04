import { UserStatus, WalletDirection, WalletTransactionType } from '@prisma/client';

import { WalletRecipientsService } from './wallet-recipients.service';

import type { PrismaService } from '../prisma/prisma.service';

const callerId = '11111111-1111-4111-8111-111111111111';
const recipientId = '22222222-2222-4222-8222-222222222222';

interface RecipientsPrismaMock {
  user: {
    findUnique: jest.Mock;
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
      user: { findUnique: jest.fn(), findMany: jest.fn() },
      walletLedgerEntry: { findMany: jest.fn() },
    };
    service = new WalletRecipientsService(prisma as unknown as PrismaService);
  });

  describe('findByPhone', () => {
    it('returns a masked recipient for an exact active-user phone match', async () => {
      prisma.user.findUnique.mockResolvedValue(user());

      const result = await service.findByPhone(callerId, '+2348012345678');

      expect(result).toEqual({
        id: recipientId,
        firstName: 'Chidi',
        lastName: 'Okoro',
        maskedPhone: '+2348012****78',
      });
    });

    it('returns null when no user matches the phone', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.findByPhone(callerId, '+2348099999999');

      expect(result).toBeNull();
    });

    it('returns null for the caller looking up their own phone', async () => {
      prisma.user.findUnique.mockResolvedValue(user({ id: callerId }));

      const result = await service.findByPhone(callerId, '+2348012345678');

      expect(result).toBeNull();
    });

    it('returns null for a non-active user', async () => {
      prisma.user.findUnique.mockResolvedValue(user({ status: UserStatus.BLOCKED }));

      const result = await service.findByPhone(callerId, '+2348012345678');

      expect(result).toBeNull();
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
