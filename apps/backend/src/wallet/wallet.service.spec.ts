import { Prisma, WalletDirection, WalletOwnerType, WalletTransactionType } from '@prisma/client';

import {
  ConflictDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';

import { WalletService } from './wallet.service';

import type { AuditService } from '../audit/audit.service';
import type { DomainEventBus } from '../events/domain-event-bus';
import type { PrismaService } from '../prisma/prisma.service';

const now = new Date('2026-07-21T12:00:00.000Z');
const ownerId = '11111111-1111-4111-8111-111111111111';
const toOwnerId = '22222222-2222-4222-8222-222222222222';
const walletId = '33333333-3333-4333-8333-333333333333';
const destinationWalletId = '44444444-4444-4444-8444-444444444444';

interface WalletPrismaMock {
  wallet: {
    upsert: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    findUniqueOrThrow: jest.Mock;
  };
  walletLedgerEntry: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    aggregate: jest.Mock;
  };
  $transaction: jest.Mock;
}

function wallet(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: walletId,
    ownerType: WalletOwnerType.CUSTOMER,
    ownerId,
    currency: 'NGN',
    availableBalance: new Prisma.Decimal(0),
    pendingBalance: new Prisma.Decimal(0),
    version: 0,
    dailyLimit: null,
    singleTransactionLimit: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function ledger(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    walletId,
    type: WalletTransactionType.CREDIT,
    amount: new Prisma.Decimal(100),
    direction: WalletDirection.CREDIT,
    balanceAfter: new Prisma.Decimal(100),
    referenceType: null,
    referenceId: null,
    description: null,
    metadata: null,
    createdAt: now,
    ...overrides,
  };
}

describe('WalletService', () => {
  let prisma: WalletPrismaMock;
  let auditService: { record: jest.Mock };
  let eventBus: { emit: jest.Mock };
  let service: WalletService;

  beforeEach(() => {
    prisma = {
      wallet: {
        upsert: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      walletLedgerEntry: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      },
      $transaction: jest.fn(
        async (callback: (tx: WalletPrismaMock) => Promise<unknown>) => await callback(prisma),
      ),
    };
    auditService = { record: jest.fn().mockResolvedValue(undefined) };
    eventBus = { emit: jest.fn().mockResolvedValue(undefined) };
    service = new WalletService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
      eventBus as unknown as DomainEventBus,
    );
  });

  it('creates a wallet with normalized currency', async () => {
    prisma.wallet.upsert.mockResolvedValue(wallet({ currency: 'NGN' }));

    const result = await service.getOrCreateWallet(WalletOwnerType.CUSTOMER, ownerId, 'ngn');

    expect(result.currency).toBe('NGN');
    expect(prisma.wallet.upsert).toHaveBeenCalledWith({
      where: {
        ownerType_ownerId_currency: {
          ownerType: WalletOwnerType.CUSTOMER,
          ownerId,
          currency: 'NGN',
        },
      },
      update: { deletedAt: null },
      create: { ownerType: WalletOwnerType.CUSTOMER, ownerId, currency: 'NGN' },
    });
  });

  it('credits wallet and creates a ledger entry in one transaction', async () => {
    prisma.wallet.upsert.mockResolvedValue(wallet());
    prisma.wallet.updateMany.mockResolvedValue({ count: 1 });
    prisma.walletLedgerEntry.create.mockResolvedValue(ledger());
    prisma.wallet.findUniqueOrThrow.mockResolvedValue(
      wallet({ availableBalance: new Prisma.Decimal(100), version: 1 }),
    );

    const result = await service.credit({
      ownerType: WalletOwnerType.CUSTOMER,
      ownerId,
      amount: 100,
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.walletLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        walletId,
        type: WalletTransactionType.CREDIT,
        direction: WalletDirection.CREDIT,
        balanceAfter: new Prisma.Decimal(100),
      }),
    });
    expect(result.availableBalance).toBe(100);
  });

  it('does not apply duplicate referenced mutations twice', async () => {
    prisma.wallet.upsert.mockResolvedValue(
      wallet({ availableBalance: new Prisma.Decimal(100), version: 1 }),
    );
    prisma.walletLedgerEntry.findFirst.mockResolvedValue(
      ledger({
        referenceType: 'order',
        referenceId: '66666666-6666-4666-8666-666666666666',
      }),
    );
    prisma.wallet.findUniqueOrThrow.mockResolvedValue(
      wallet({ availableBalance: new Prisma.Decimal(100), version: 1 }),
    );

    const result = await service.credit({
      ownerType: WalletOwnerType.CUSTOMER,
      ownerId,
      amount: 100,
      referenceType: 'order',
      referenceId: '66666666-6666-4666-8666-666666666666',
    });

    expect(result.availableBalance).toBe(100);
    expect(prisma.walletLedgerEntry.findFirst).toHaveBeenCalledWith({
      where: {
        walletId,
        referenceType: 'order',
        referenceId: '66666666-6666-4666-8666-666666666666',
      },
    });
    expect(prisma.wallet.updateMany).not.toHaveBeenCalled();
    expect(prisma.walletLedgerEntry.create).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it('uses context user id as wallet mutation audit actor and keeps owner metadata', async () => {
    const adminId = '77777777-7777-4777-8777-777777777777';
    prisma.wallet.upsert.mockResolvedValue(wallet());
    prisma.walletLedgerEntry.findFirst.mockResolvedValue(null);
    prisma.wallet.updateMany.mockResolvedValue({ count: 1 });
    prisma.walletLedgerEntry.create.mockResolvedValue(ledger());
    prisma.wallet.findUniqueOrThrow.mockResolvedValue(
      wallet({ availableBalance: new Prisma.Decimal(100), version: 1 }),
    );

    await service.credit({
      ownerType: WalletOwnerType.CUSTOMER,
      ownerId,
      amount: 100,
      referenceType: 'admin_adjustment',
      referenceId: '88888888-8888-4888-8888-888888888888',
      context: { userId: adminId, ipAddress: '127.0.0.1' },
    });

    expect(auditService.record).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ userId: adminId, ipAddress: '127.0.0.1' }),
      expect.objectContaining({
        metadata: expect.objectContaining({
          ownerType: WalletOwnerType.CUSTOMER,
          ownerId,
          referenceType: 'admin_adjustment',
          referenceId: '88888888-8888-4888-8888-888888888888',
        }),
      }),
    );
  });

  it('emits WALLET_CREDITED after credit', async () => {
    prisma.wallet.upsert.mockResolvedValue(wallet());
    prisma.wallet.updateMany.mockResolvedValue({ count: 1 });
    prisma.walletLedgerEntry.create.mockResolvedValue(ledger());
    prisma.wallet.findUniqueOrThrow.mockResolvedValue(
      wallet({ availableBalance: new Prisma.Decimal(100), version: 1 }),
    );

    await service.credit({ ownerType: WalletOwnerType.CUSTOMER, ownerId, amount: 100 });

    expect(eventBus.emit).toHaveBeenCalledWith(
      'WalletCredited',
      expect.objectContaining({ amount: 100 }),
    );
  });

  it('debits wallet and creates a debit ledger entry', async () => {
    prisma.wallet.upsert.mockResolvedValue(
      wallet({ availableBalance: new Prisma.Decimal(100), version: 3 }),
    );
    prisma.wallet.updateMany.mockResolvedValue({ count: 1 });
    prisma.walletLedgerEntry.create.mockResolvedValue(
      ledger({
        type: WalletTransactionType.DEBIT,
        direction: WalletDirection.DEBIT,
        balanceAfter: new Prisma.Decimal(60),
      }),
    );
    prisma.wallet.findUniqueOrThrow.mockResolvedValue(
      wallet({ availableBalance: new Prisma.Decimal(60), version: 4 }),
    );

    const result = await service.debit({
      ownerType: WalletOwnerType.CUSTOMER,
      ownerId,
      amount: 40,
    });

    expect(result.availableBalance).toBe(60);
    expect(prisma.walletLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ direction: WalletDirection.DEBIT }),
    });
  });

  it('rejects debit with insufficient funds', async () => {
    prisma.wallet.upsert.mockResolvedValue(wallet({ availableBalance: new Prisma.Decimal(10) }));

    await expect(
      service.debit({ ownerType: WalletOwnerType.CUSTOMER, ownerId, amount: 25 }),
    ).rejects.toBeInstanceOf(ValidationDomainException);
  });

  it('rejects stale optimistic-lock updates', async () => {
    prisma.wallet.upsert.mockResolvedValue(wallet({ availableBalance: new Prisma.Decimal(100) }));
    prisma.wallet.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.credit({ ownerType: WalletOwnerType.CUSTOMER, ownerId, amount: 25 }),
    ).rejects.toBeInstanceOf(ConflictDomainException);
  });

  it.each([
    ['refund', WalletTransactionType.REFUND, WalletDirection.CREDIT],
    ['settlement', WalletTransactionType.SETTLEMENT, WalletDirection.CREDIT],
    ['cashback', WalletTransactionType.CASHBACK, WalletDirection.CREDIT],
    ['withdrawal', WalletTransactionType.WITHDRAWAL, WalletDirection.DEBIT],
  ] as const)('supports %s mutations', async (method, type, direction) => {
    prisma.wallet.upsert.mockResolvedValue(
      wallet({
        availableBalance: new Prisma.Decimal(direction === WalletDirection.DEBIT ? 100 : 0),
      }),
    );
    prisma.wallet.updateMany.mockResolvedValue({ count: 1 });
    prisma.walletLedgerEntry.create.mockResolvedValue(ledger({ type, direction }));
    prisma.wallet.findUniqueOrThrow.mockResolvedValue(
      wallet({ availableBalance: new Prisma.Decimal(50) }),
    );

    await service[method]({ ownerType: WalletOwnerType.CUSTOMER, ownerId, amount: 50 });

    expect(prisma.walletLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type, direction }),
    });
  });

  it('transfers by debiting source and crediting destination in one transaction', async () => {
    prisma.wallet.upsert
      .mockResolvedValueOnce(wallet({ availableBalance: new Prisma.Decimal(100) }))
      .mockResolvedValueOnce(
        wallet({
          id: destinationWalletId,
          ownerId: toOwnerId,
          availableBalance: new Prisma.Decimal(0),
        }),
      );
    prisma.wallet.updateMany.mockResolvedValue({ count: 1 });
    prisma.walletLedgerEntry.create
      .mockResolvedValueOnce(
        ledger({
          type: WalletTransactionType.TRANSFER,
          direction: WalletDirection.DEBIT,
          balanceAfter: new Prisma.Decimal(70),
        }),
      )
      .mockResolvedValueOnce(
        ledger({
          walletId: destinationWalletId,
          type: WalletTransactionType.TRANSFER,
          direction: WalletDirection.CREDIT,
          balanceAfter: new Prisma.Decimal(30),
        }),
      );
    prisma.wallet.findUniqueOrThrow
      .mockResolvedValueOnce(wallet({ availableBalance: new Prisma.Decimal(70) }))
      .mockResolvedValueOnce(
        wallet({
          id: destinationWalletId,
          ownerId: toOwnerId,
          availableBalance: new Prisma.Decimal(30),
        }),
      );

    const result = await service.transfer({
      fromOwnerType: WalletOwnerType.CUSTOMER,
      fromOwnerId: ownerId,
      toOwnerType: WalletOwnerType.CUSTOMER,
      toOwnerId,
      amount: 30,
    });

    expect(result.source.availableBalance).toBe(70);
    expect(result.destination.availableBalance).toBe(30);
    expect(prisma.walletLedgerEntry.create).toHaveBeenCalledTimes(2);
  });

  it('rejects transfers to the same wallet', async () => {
    await expect(
      service.transfer({
        fromOwnerType: WalletOwnerType.CUSTOMER,
        fromOwnerId: ownerId,
        toOwnerType: WalletOwnerType.CUSTOMER,
        toOwnerId: ownerId,
        amount: 10,
      }),
    ).rejects.toBeInstanceOf(ValidationDomainException);
  });

  it('lists wallet history', async () => {
    prisma.wallet.upsert.mockResolvedValue(wallet());
    prisma.walletLedgerEntry.findMany.mockResolvedValue([ledger()]);
    prisma.walletLedgerEntry.count.mockResolvedValue(1);

    const result = await service.listHistory(WalletOwnerType.CUSTOMER, ownerId, 1, 20);

    expect(result.items).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  it('reconciles matching balances', async () => {
    prisma.wallet.upsert.mockResolvedValue(wallet({ availableBalance: new Prisma.Decimal(70) }));
    prisma.walletLedgerEntry.aggregate
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(100) } })
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(30) } });

    const result = await service.reconcileWallet(WalletOwnerType.CUSTOMER, ownerId);

    expect(result.reconciled).toBe(true);
    expect(result.ledgerBalance).toBe(70);
  });

  it('reports reconciliation differences', async () => {
    prisma.wallet.upsert.mockResolvedValue(wallet({ availableBalance: new Prisma.Decimal(65) }));
    prisma.walletLedgerEntry.aggregate
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(100) } })
      .mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal(30) } });

    const result = await service.reconcileWallet(WalletOwnerType.CUSTOMER, ownerId);

    expect(result.reconciled).toBe(false);
    expect(result.difference).toBe(-5);
  });

  it('rejects non-positive amounts', async () => {
    await expect(
      service.credit({ ownerType: WalletOwnerType.CUSTOMER, ownerId, amount: 0 }),
    ).rejects.toBeInstanceOf(ValidationDomainException);
  });

  describe('setLimits', () => {
    it('persists daily and single transaction limits', async () => {
      prisma.wallet.upsert.mockResolvedValue(wallet());
      prisma.wallet.update.mockResolvedValue(
        wallet({
          dailyLimit: new Prisma.Decimal(50000),
          singleTransactionLimit: new Prisma.Decimal(20000),
        }),
      );

      const result = await service.setLimits(WalletOwnerType.CUSTOMER, ownerId, {
        dailyLimit: 50000,
        singleTransactionLimit: 20000,
      });

      expect(prisma.wallet.update).toHaveBeenCalledWith({
        where: { id: walletId },
        data: { dailyLimit: 50000, singleTransactionLimit: 20000 },
      });
      expect(result.dailyLimit).toBe(50000);
      expect(result.singleTransactionLimit).toBe(20000);
    });

    it('clears limits when set to null', async () => {
      prisma.wallet.upsert.mockResolvedValue(wallet({ dailyLimit: new Prisma.Decimal(50000) }));
      prisma.wallet.update.mockResolvedValue(wallet());

      await service.setLimits(WalletOwnerType.CUSTOMER, ownerId, {
        dailyLimit: null,
        singleTransactionLimit: null,
      });

      expect(prisma.wallet.update).toHaveBeenCalledWith({
        where: { id: walletId },
        data: { dailyLimit: null, singleTransactionLimit: null },
      });
    });

    it('rejects a zero or negative limit', async () => {
      prisma.wallet.upsert.mockResolvedValue(wallet());
      await expect(
        service.setLimits(WalletOwnerType.CUSTOMER, ownerId, {
          dailyLimit: 0,
          singleTransactionLimit: null,
        }),
      ).rejects.toBeInstanceOf(ValidationDomainException);
    });
  });

  describe('assertWithinLimits', () => {
    it('passes when no limits are configured', async () => {
      prisma.wallet.upsert.mockResolvedValue(wallet());
      await expect(
        service.assertWithinLimits(WalletOwnerType.CUSTOMER, ownerId, 1_000_000),
      ).resolves.toBeUndefined();
    });

    it('rejects an amount over the single transaction limit', async () => {
      prisma.wallet.upsert.mockResolvedValue(
        wallet({ singleTransactionLimit: new Prisma.Decimal(5000) }),
      );
      await expect(
        service.assertWithinLimits(WalletOwnerType.CUSTOMER, ownerId, 5001),
      ).rejects.toBeInstanceOf(ValidationDomainException);
    });

    it('rejects an amount that would exceed the daily limit given prior spend today', async () => {
      prisma.wallet.upsert.mockResolvedValue(wallet({ dailyLimit: new Prisma.Decimal(10000) }));
      prisma.walletLedgerEntry.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal(8000) },
      });

      await expect(
        service.assertWithinLimits(WalletOwnerType.CUSTOMER, ownerId, 2001),
      ).rejects.toBeInstanceOf(ValidationDomainException);
      await expect(
        service.assertWithinLimits(WalletOwnerType.CUSTOMER, ownerId, 2000),
      ).resolves.toBeUndefined();
    });
  });

  describe('getStatement', () => {
    it('aggregates money in/out/net for the given month', async () => {
      prisma.wallet.upsert.mockResolvedValue(wallet());
      prisma.walletLedgerEntry.findMany.mockResolvedValue([
        ledger({ direction: WalletDirection.CREDIT, amount: new Prisma.Decimal(5000) }),
        ledger({ direction: WalletDirection.DEBIT, amount: new Prisma.Decimal(1500) }),
        ledger({ direction: WalletDirection.DEBIT, amount: new Prisma.Decimal(390) }),
      ]);

      const result = await service.getStatement(WalletOwnerType.CUSTOMER, ownerId, 8, 2026);

      expect(result.totalIn).toBe(5000);
      expect(result.totalOut).toBe(1890);
      expect(result.net).toBe(3110);
      expect(result.transactions).toHaveLength(3);
    });
  });
});
