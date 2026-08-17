import { randomUUID } from 'node:crypto';

import { Test } from '@nestjs/testing';
import {
  CommissionOwnerType,
  PrismaClient,
  WalletOwnerType,
  WithdrawalRequestStatus,
} from '@prisma/client';

import { AppModule } from '../app.module';
import { CommercialCreditSettingsService } from '../commercial/commercial-credit-settings.service';
import { CommissionAccountService } from '../commercial/commission-account.service';
import { DeliveryService } from '../delivery/delivery.service';

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
  let commissions: CommissionAccountService;

  /** The module, or a clear failure — never a silent non-null assertion. */
  const app = (): TestingModule => {
    if (!moduleRef) {
      throw new Error('testing module was not created');
    }
    return moduleRef;
  };
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
    commissions = moduleRef.get(CommissionAccountService);

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

    expect(request.payout?.status).toBe(WithdrawalRequestStatus.PENDING);
    expect(request.commissionSettled).toBe(0);

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

  it('subtracts commission owed before anything reaches the bank', async () => {
    if (!databaseAvailable) return;

    // The account already exists — the earlier payout created it on the way
    // past — so set the balance rather than assuming this test creates it.
    await prisma.commissionAccount.upsert({
      where: {
        ownerType_ownerId: { ownerType: CommissionOwnerType.RIDER, ownerId: riderId },
      },
      create: {
        ownerType: CommissionOwnerType.RIDER,
        ownerId: riderId,
        outstandingBalance: 1_500,
        creditLimit: 20_000,
      },
      update: { outstandingBalance: 1_500, creditLimit: 20_000, blocked: false },
    });

    const balanceBefore = (await wallets.getWallet(WalletOwnerType.RIDER, riderId))
      .availableBalance;
    const result = await withdrawals.create(riderId, WalletOwnerType.RIDER, {
      amount: 4_000,
      bankAccountId: riderBankAccountId,
      pin: PIN,
    });

    // ₦4,000 asked for, ₦1,500 owed → ₦2,500 to the bank.
    expect(result.commissionSettled).toBe(1_500);
    expect(result.payout?.amount).toBe(2_500);

    // The debt is actually cleared, not merely reported.
    const account = await prisma.commissionAccount.findFirstOrThrow({
      where: { ownerType: CommissionOwnerType.RIDER, ownerId: riderId },
    });
    expect(Number(account.outstandingBalance)).toBe(0);

    // And the wallet is down by the whole ₦4,000 — the settled part left the
    // balance too, it did not vanish from the books.
    const balanceAfter = (await wallets.getWallet(WalletOwnerType.RIDER, riderId)).availableBalance;
    expect(balanceAfter).toBe(balanceBefore - 4_000);
  });

  it('creates no bank transfer when the debt swallows the whole request', async () => {
    if (!databaseAvailable) return;

    await prisma.commissionAccount.updateMany({
      where: { ownerType: CommissionOwnerType.RIDER, ownerId: riderId },
      data: { outstandingBalance: 3_000 },
    });

    const result = await withdrawals.create(riderId, WalletOwnerType.RIDER, {
      amount: 1_000,
      bankAccountId: riderBankAccountId,
      pin: PIN,
    });

    expect(result.commissionSettled).toBe(1_000);
    // Nothing to send, so no line telling Operations to transfer ₦0.
    expect(result.payout).toBeNull();

    const account = await prisma.commissionAccount.findFirstOrThrow({
      where: { ownerType: CommissionOwnerType.RIDER, ownerId: riderId },
    });
    expect(Number(account.outstandingBalance)).toBe(2_000);
  });

  it('leaves a customer payout alone — they owe DrippleX nothing', async () => {
    if (!databaseAvailable) return;

    const customerId = await makeUser('Mamman');
    await pins.set(customerId, PIN);
    const bank = await prisma.customerBankAccount.create({
      data: {
        userId: customerId,
        bankName: 'Zenith',
        accountName: 'Mamman Payout',
        accountNumber: '1122334455',
        isDefault: true,
      },
    });
    await wallets.credit({
      ownerType: WalletOwnerType.CUSTOMER,
      ownerId: customerId,
      amount: 4_000,
      currency: 'NGN',
      referenceType: 'test_seed',
      referenceId: randomUUID(),
      description: 'Top-up',
    });

    const result = await withdrawals.create(customerId, WalletOwnerType.CUSTOMER, {
      amount: 3_000,
      bankAccountId: bank.id,
      pin: PIN,
    });

    expect(result.commissionSettled).toBe(0);
    expect(result.payout?.amount).toBe(3_000);
  });

  it('stays blocked until the balance is zero, not merely under the limit', async () => {
    if (!databaseAvailable) return;

    const settings = app().get(CommercialCreditSettingsService);
    const creditLimit = Number(
      (await settings.getEffective(CommissionOwnerType.DRIVER)).creditLimit,
    );

    // Cross the limit — that is what blocks them.
    await commissions.accrue({
      ownerType: CommissionOwnerType.DRIVER,
      ownerId: driverId,
      amount: creditLimit + 1_000,
      referenceType: 'test_accrual',
      referenceId: randomUUID(),
      description: 'Cash collected on DrippleX behalf',
    });
    let account = await prisma.commissionAccount.findFirstOrThrow({
      where: { ownerType: CommissionOwnerType.DRIVER, ownerId: driverId },
    });
    expect(account.blocked).toBe(true);

    // Pay down to just under the limit. Before this change that released them,
    // which let a driver ride the ceiling forever without ever settling.
    await commissions.recordPayment({
      ownerType: CommissionOwnerType.DRIVER,
      ownerId: driverId,
      amount: 1_001,
      referenceType: 'test_payment',
      referenceId: randomUUID(),
      description: 'Partial settlement',
    });
    account = await prisma.commissionAccount.findFirstOrThrow({
      where: { ownerType: CommissionOwnerType.DRIVER, ownerId: driverId },
    });
    expect(Number(account.outstandingBalance)).toBeLessThan(creditLimit);
    expect(account.blocked).toBe(true);

    // Only zero releases them.
    await commissions.recordPayment({
      ownerType: CommissionOwnerType.DRIVER,
      ownerId: driverId,
      amount: Number(account.outstandingBalance),
      referenceType: 'test_payment',
      referenceId: randomUUID(),
      description: 'Final settlement',
    });
    account = await prisma.commissionAccount.findFirstOrThrow({
      where: { ownerType: CommissionOwnerType.DRIVER, ownerId: driverId },
    });
    expect(Number(account.outstandingBalance)).toBe(0);
    expect(account.blocked).toBe(false);
  });

  it('will not let a blocked rider go online, and lets them back once settled', async () => {
    if (!databaseAvailable) return;

    const deliveries = app().get(DeliveryService);
    const settings = app().get(CommercialCreditSettingsService);
    const creditLimit = Number(
      (await settings.getEffective(CommissionOwnerType.RIDER)).creditLimit,
    );

    await commissions.accrue({
      ownerType: CommissionOwnerType.RIDER,
      ownerId: riderId,
      amount: creditLimit + 500,
      referenceType: 'test_accrual',
      referenceId: randomUUID(),
      description: 'Cash collected on DrippleX behalf',
    });

    await expect(
      deliveries.updateRiderAvailability(riderId, { online: true, acceptingOrders: true }),
    ).rejects.toThrow(/settled the cash you owe/i);

    // Going OFFLINE is never blocked — a rider must always be able to stop.
    await expect(
      deliveries.updateRiderAvailability(riderId, { online: false, acceptingOrders: false }),
    ).resolves.toBeDefined();

    const account = await prisma.commissionAccount.findFirstOrThrow({
      where: { ownerType: CommissionOwnerType.RIDER, ownerId: riderId },
    });
    await commissions.recordPayment({
      ownerType: CommissionOwnerType.RIDER,
      ownerId: riderId,
      amount: Number(account.outstandingBalance),
      referenceType: 'test_payment',
      referenceId: randomUUID(),
      description: 'Settled in full',
    });

    await expect(
      deliveries.updateRiderAvailability(riderId, { online: true, acceptingOrders: true }),
    ).resolves.toBeDefined();
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
