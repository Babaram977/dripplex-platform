import { randomUUID } from 'node:crypto';

import { Test } from '@nestjs/testing';
import {
  CommissionOwnerType,
  PrismaClient,
  WalletOwnerType,
  WithdrawalRequestStatus,
} from '@prisma/client';

import { AppModule } from '../app.module';

import { SettlementReportService, lagosWeekStart } from './settlement-report.service';
import { WalletPinService } from './wallet-pin.service';
import { WalletService } from './wallet.service';
import { WithdrawalService } from './withdrawal.service';

import type { TestingModule } from '@nestjs/testing';

/**
 * DPX-PAYOUT-001 — a rider and a driver getting paid.
 *
 * The defect this pins is not "can a payout be requested". It is that the
 * withdrawal path hard-coded `WalletOwnerType.CUSTOMER`, so a driver asking
 * for their earnings would have debited an empty customer wallet while the
 * DRIVER wallet holding the money sat untouched — either failing for
 * insufficient funds or, worse, succeeding against some unrelated balance.
 */
describe('partner payouts (real database)', () => {
  const databaseUrl = process.env['DATABASE_URL'] ?? '';
  let prisma: PrismaClient;
  let moduleRef: TestingModule | null = null;
  let withdrawals: WithdrawalService;
  let wallets: WalletService;
  let pins: WalletPinService;
  let settlement: SettlementReportService;
  let databaseAvailable = false;

  const createdUserIds: string[] = [];
  let riderId = '';
  let driverId = '';
  let riderBankAccountId = '';
  let driverBankAccountId = '';
  const PIN = '4731';

  const makeUser = async (first: string): Promise<string> => {
    const user = await prisma.user.create({
      data: {
        email: `${first.toLowerCase()}-${randomUUID()}@example.test`,
        passwordHash: 'x',
        firstName: first,
        lastName: 'Payout',
      },
    });
    createdUserIds.push(user.id);
    return user.id;
  };

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    try {
      await prisma.$connect();
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
      return;
    }

    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    withdrawals = moduleRef.get(WithdrawalService);
    wallets = moduleRef.get(WalletService);
    pins = moduleRef.get(WalletPinService);
    settlement = moduleRef.get(SettlementReportService);

    riderId = await makeUser('Tunde');
    driverId = await makeUser('Sani');

    await pins.set(riderId, PIN);
    await pins.set(driverId, PIN);

    const riderBank = await prisma.customerBankAccount.create({
      data: {
        userId: riderId,
        bankName: 'GTBank',
        accountName: 'Tunde Payout',
        accountNumber: '0123456789',
        isDefault: true,
      },
    });
    riderBankAccountId = riderBank.id;
    const driverBank = await prisma.customerBankAccount.create({
      data: {
        userId: driverId,
        bankName: 'Access Bank',
        accountName: 'Sani Payout',
        accountNumber: '9876543210',
        isDefault: true,
      },
    });
    driverBankAccountId = driverBank.id;

    // Earnings land in the RIDER / DRIVER wallets, exactly as the settlement
    // services credit them after a delivery or a trip.
    await wallets.credit({
      ownerType: WalletOwnerType.RIDER,
      ownerId: riderId,
      amount: 12_000,
      currency: 'NGN',
      referenceType: 'test_seed',
      referenceId: randomUUID(),
      description: 'Delivery earnings',
    });
    await wallets.credit({
      ownerType: WalletOwnerType.DRIVER,
      ownerId: driverId,
      amount: 30_000,
      currency: 'NGN',
      referenceType: 'test_seed',
      referenceId: randomUUID(),
      description: 'Trip earnings',
    });
  }, 90_000);

  afterAll(async () => {
    if (databaseAvailable) {
      await prisma.withdrawalRequest.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.customerBankAccount.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.walletLedgerEntry.deleteMany({
        where: { wallet: { ownerId: { in: createdUserIds } } },
      });
      await prisma.wallet.deleteMany({ where: { ownerId: { in: createdUserIds } } });
      await prisma.commissionLedgerEntry.deleteMany({
        where: { account: { ownerId: { in: createdUserIds } } },
      });
      await prisma.commissionAccount.deleteMany({ where: { ownerId: { in: createdUserIds } } });
      await prisma.walletPin.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await moduleRef?.close();
    await prisma.$disconnect();
  });

  it("debits the rider's own wallet, not a customer wallet", async () => {
    if (!databaseAvailable) return;

    const before = await wallets.getWallet(WalletOwnerType.RIDER, riderId);
    const request = await withdrawals.create(riderId, WalletOwnerType.RIDER, {
      amount: 5_000,
      bankAccountId: riderBankAccountId,
      pin: PIN,
    });

    expect(request.status).toBe(WithdrawalRequestStatus.PENDING);

    const after = await wallets.getWallet(WalletOwnerType.RIDER, riderId);
    expect(after.availableBalance).toBe(before.availableBalance - 5_000);

    // The customer wallet — the one the old code would have reached for — is
    // untouched, and specifically was not created or driven negative.
    const customerWallet = await prisma.wallet.findFirst({
      where: { ownerType: WalletOwnerType.CUSTOMER, ownerId: riderId },
    });
    expect(customerWallet === null || Number(customerWallet.availableBalance) === 0).toBe(true);
  });

  it('debits the driver wallet for a driver payout', async () => {
    if (!databaseAvailable) return;

    await withdrawals.create(driverId, WalletOwnerType.DRIVER, {
      amount: 20_000,
      bankAccountId: driverBankAccountId,
      pin: PIN,
    });

    const after = await wallets.getWallet(WalletOwnerType.DRIVER, driverId);
    expect(after.availableBalance).toBe(10_000);
  });

  it('refuses a payout larger than what has been earned', async () => {
    if (!databaseAvailable) return;

    await expect(
      withdrawals.create(riderId, WalletOwnerType.RIDER, {
        amount: 900_000,
        bankAccountId: riderBankAccountId,
        pin: PIN,
      }),
    ).rejects.toThrow();
  });

  it('refuses a payout on a wrong PIN', async () => {
    if (!databaseAvailable) return;

    await expect(
      withdrawals.create(riderId, WalletOwnerType.RIDER, {
        amount: 1_000,
        bankAccountId: riderBankAccountId,
        pin: '0000',
      }),
    ).rejects.toThrow();
  });

  it("refuses to pay into somebody else's bank account", async () => {
    if (!databaseAvailable) return;

    await expect(
      withdrawals.create(riderId, WalletOwnerType.RIDER, {
        amount: 1_000,
        bankAccountId: driverBankAccountId,
        pin: PIN,
      }),
    ).rejects.toThrow();
  });

  it('lists both partners on the settlement report, with where to send the money', async () => {
    if (!databaseAvailable) return;

    const report = await settlement.weekly();
    const mine = report.lines.filter((line) => createdUserIds.includes(line.userId));

    const rider = mine.find((line) => line.partnerType === 'RIDER');
    const driver = mine.find((line) => line.partnerType === 'DRIVER');

    expect(rider).toMatchObject({
      name: 'Tunde Payout',
      bankName: 'GTBank',
      accountNumber: '0123456789',
      amount: 5_000,
    });
    expect(driver).toMatchObject({
      name: 'Sani Payout',
      bankName: 'Access Bank',
      accountNumber: '9876543210',
      amount: 20_000,
    });
  });

  it('reports outstanding cash commission beside the payout, without deducting it', async () => {
    if (!databaseAvailable) return;

    await prisma.commissionAccount.create({
      data: {
        ownerType: CommissionOwnerType.RIDER,
        ownerId: riderId,
        outstandingBalance: 1_500,
        creditLimit: 20_000,
      },
    });

    const report = await settlement.weekly();
    const rider = report.lines.find((line) => line.userId === riderId);

    expect(rider?.outstandingCommission).toBe(1_500);
    // Still the full amount requested — netting off is a policy decision that
    // has not been made, so the report states both numbers and decides neither.
    expect(rider?.amount).toBe(5_000);
  });

  it('does not put a paid request back on next week’s report', async () => {
    if (!databaseAvailable) return;

    const before = await settlement.weekly();
    const driverLine = before.lines.find((line) => line.userId === driverId);
    if (!driverLine) {
      throw new Error('expected the driver to be on the settlement report');
    }

    await withdrawals.adminComplete(driverId, driverLine.withdrawalId, 'Paid by transfer');

    const after = await settlement.weekly();
    expect(after.lines.find((line) => line.userId === driverId)).toBeUndefined();
  });

  it('anchors the week on Monday in Lagos, not on UTC', () => {
    // 00:30 Monday in Lagos is 23:30 Sunday UTC. A UTC-anchored week would put
    // this request in the *previous* run and make the rider wait another seven
    // days for money they asked for on the right day.
    const justAfterLagosMidnightMonday = new Date('2026-08-16T23:30:00.000Z'); // Sun 23:30 UTC
    const start = lagosWeekStart(justAfterLagosMidnightMonday);

    // Lagos-local Monday 00:00 == Sunday 23:00 UTC.
    expect(start.toISOString()).toBe('2026-08-16T23:00:00.000Z');
    expect(justAfterLagosMidnightMonday.getTime()).toBeGreaterThanOrEqual(start.getTime());
  });
});
