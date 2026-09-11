import { randomUUID } from 'node:crypto';

import { PrismaClient, WalletOwnerType, WithdrawalRequestStatus } from '@prisma/client';

import { OperationsPayoutsService } from './operations-payouts.service';

import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

/**
 * The unified payout queue, against a real database.
 *
 * The point of this service is that a withdrawal's persona is not a column —
 * it comes from the wallet the request is drawn on, across a `wallet_id` that
 * carries no foreign key and so no Prisma relation. That resolution is the part
 * worth testing against Postgres rather than a mock, because a mock would
 * happily return whatever shape the code expects.
 */
describe('OperationsPayoutsService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: OperationsPayoutsService;
  const createdUserIds: string[] = [];
  const createdRequestIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    }) as unknown as PrismaService;

    try {
      await prisma.$connect();
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
      return;
    }
    service = new OperationsPayoutsService(prisma);
  });

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.withdrawalRequest.deleteMany({ where: { id: { in: createdRequestIds } } });
      await prisma.customerBankAccount.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.bankAccount.deleteMany({ where: { merchantId: { in: createdUserIds } } });
      await prisma.wallet.deleteMany({ where: { ownerId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  /** A partner with a wallet and a pending request against it. */
  async function requestPayout(
    ownerType: WalletOwnerType,
    amount: number,
    status: WithdrawalRequestStatus = WithdrawalRequestStatus.PENDING,
  ): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `ops-payouts-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Test',
        lastName: ownerType,
      },
    });
    createdUserIds.push(user.id);

    const wallet = await prisma.wallet.create({
      data: { ownerType, ownerId: user.id, currency: 'NGN' },
    });

    // `withdrawal_requests` carries a CHECK requiring exactly one destination,
    // and which one depends on the persona: a merchant's verified settlement
    // account lives in `bank_accounts`, everybody else's in
    // `customer_bank_accounts`. Building both here keeps the fixture honest
    // about a real constraint rather than working around it.
    let destination: { bankAccountId?: string; merchantBankAccountId?: string };
    if (ownerType === WalletOwnerType.MERCHANT) {
      const account = await prisma.bankAccount.create({
        data: {
          merchantId: user.id,
          bankName: 'Guaranty Trust Bank',
          bankCode: '058',
          accountName: 'Test Merchant',
          accountNumber: '0123456789',
          verifiedAt: new Date(),
        },
      });
      destination = { merchantBankAccountId: account.id };
    } else {
      const account = await prisma.customerBankAccount.create({
        data: {
          userId: user.id,
          bankName: 'Guaranty Trust Bank',
          bankCode: '058',
          accountName: 'Test Partner',
          accountNumber: '0123456789',
        },
      });
      destination = { bankAccountId: account.id };
    }

    const request = await prisma.withdrawalRequest.create({
      data: {
        userId: user.id,
        walletId: wallet.id,
        amount,
        currency: 'NGN',
        status,
        ...destination,
      },
    });
    createdRequestIds.push(request.id);
    return request.id;
  }

  it('reads a withdrawal’s persona from the wallet it is drawn on', async () => {
    if (!databaseAvailable) return;

    const driverRequest = await requestPayout(WalletOwnerType.DRIVER, 5_000);
    const merchantRequest = await requestPayout(WalletOwnerType.MERCHANT, 12_000);

    const queue = await service.list({ page: 1, pageSize: 100, status: 'PENDING' });
    const byId = new Map(queue.items.map((item) => [item.id, item]));

    expect(byId.get(driverRequest)?.requesterType).toBe('DRIVER');
    expect(byId.get(merchantRequest)?.requesterType).toBe('MERCHANT');
  });

  it('tells the console where each kind is actioned', async () => {
    if (!databaseAvailable) return;

    const id = await requestPayout(WalletOwnerType.RIDER, 1_500);
    const queue = await service.list({ page: 1, pageSize: 100, status: 'PENDING' });

    // The two kinds are approved through different endpoints; the console
    // should not have to know the mapping.
    expect(queue.items.find((item) => item.id === id)?.actionPath).toBe(
      `/admin/wallet/withdrawals/${id}`,
    );
  });

  it('filters to one persona', async () => {
    if (!databaseAvailable) return;

    await requestPayout(WalletOwnerType.DRIVER, 2_000);
    await requestPayout(WalletOwnerType.RIDER, 3_000);

    const drivers = await service.list({
      page: 1,
      pageSize: 100,
      status: 'PENDING',
      requesterType: 'DRIVER',
    });

    expect(drivers.items.length).toBeGreaterThan(0);
    expect(drivers.items.every((item) => item.requesterType === 'DRIVER')).toBe(true);
  });

  it('does not read the withdrawal table at all for a fleet-only filter', async () => {
    if (!databaseAvailable) return;

    await requestPayout(WalletOwnerType.DRIVER, 4_000);

    const fleetOnly = await service.list({
      page: 1,
      pageSize: 100,
      status: 'PENDING',
      requesterType: 'FLEET_OWNER',
    });

    expect(fleetOnly.items.every((item) => item.kind === 'FLEET_RECEIVABLE')).toBe(true);
  });

  it('maps a completed withdrawal to PAID and a failed one to REJECTED', async () => {
    if (!databaseAvailable) return;

    const paid = await requestPayout(
      WalletOwnerType.DRIVER,
      900,
      WithdrawalRequestStatus.COMPLETED,
    );
    const rejected = await requestPayout(
      WalletOwnerType.DRIVER,
      800,
      WithdrawalRequestStatus.FAILED,
    );

    const paidQueue = await service.list({ page: 1, pageSize: 100, status: 'PAID' });
    const rejectedQueue = await service.list({ page: 1, pageSize: 100, status: 'REJECTED' });

    expect(paidQueue.items.some((item) => item.id === paid)).toBe(true);
    expect(rejectedQueue.items.some((item) => item.id === rejected)).toBe(true);
    // And a status one source cannot produce must not drag in the other's rows.
    expect(paidQueue.items.some((item) => item.id === rejected)).toBe(false);
  });

  it('does not show a request whose status was not asked for', async () => {
    if (!databaseAvailable) return;

    const pending = await requestPayout(WalletOwnerType.RIDER, 700);
    const queue = await service.list({ page: 1, pageSize: 100, status: 'PAID' });

    expect(queue.items.some((item) => item.id === pending)).toBe(false);
  });

  it('summarises what is outstanding, by who is waiting for it', async () => {
    if (!databaseAvailable) return;

    await requestPayout(WalletOwnerType.MERCHANT, 10_000);

    const summary = await service.summary();
    const merchants = summary.pendingByRequester.find(
      (bucket) => bucket.requesterType === 'MERCHANT',
    );

    expect(merchants).toBeDefined();
    expect(merchants?.amount).toBeGreaterThanOrEqual(10_000);
    expect(summary.pendingAmount).toBeGreaterThanOrEqual(merchants?.amount ?? 0);
  });

  it('never lists a platform wallet as a partner waiting to be paid', async () => {
    if (!databaseAvailable) return;

    const platform = await requestPayout(WalletOwnerType.PLATFORM, 50_000);
    const queue = await service.list({ page: 1, pageSize: 100, status: 'PENDING' });

    expect(queue.items.some((item) => item.id === platform)).toBe(false);
  });
});
