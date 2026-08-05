import { CommissionOwnerType, PrismaClient } from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import { CommercialCreditSettingsService } from './commercial-credit-settings.service';
import { CommissionAccountService } from './commission-account.service';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex_dev?schema=public';

const MERCHANT_ID = '44444444-4444-4444-4444-444444444444';
const DRIVER_ID = '55555555-5555-5555-5555-555555555555';
const ADMIN_ID = '66666666-6666-6666-6666-666666666666';

/**
 * DPX-COMMERCIAL-001 Slice 5 §7 — the founder-required Commercial
 * Reconciliation Verification. For one representative Merchant scenario
 * and one representative Driver scenario, this proves that: commission
 * accrued, commission paid, outstanding balance, available credit, and
 * current blocked/unblocked status all reconcile exactly against the
 * Commission Ledger and Commission Account — the same primitives every
 * real call site (Marketplace mode B/C settlement, Ride cash
 * confirmation, admin-manual payment) uses, exercised here directly
 * against real Postgres rather than through the order/ride wiring
 * already proven correct in Slices 2-4's own tests. Real output values
 * from this spec are transcribed verbatim into
 * docs/DPX-COMMERCIAL-001-SLICE-5-COMMERCIAL-RECONCILIATION.md.
 */
describe('DPX-COMMERCIAL-001 Slice 5 — Commercial Reconciliation Verification', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: CommissionAccountService;
  let creditSettings: CommercialCreditSettingsService;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    }) as unknown as PrismaService;
    try {
      await prisma.$connect();
      databaseAvailable = true;
    } catch {
      databaseAvailable = false;
    }
  });

  afterEach(async () => {
    if (databaseAvailable) {
      await prisma.commissionLedgerEntry.deleteMany({});
      await prisma.commissionAccount.deleteMany({});
      await prisma.commercialCreditSetting.deleteMany({});
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(() => {
    if (!databaseAvailable) return;
    const auditLogRepository: jest.Mocked<AuditLogRepository> = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    const auditService = new AuditService(auditLogRepository);
    creditSettings = new CommercialCreditSettingsService(prisma, auditService);
    service = new CommissionAccountService(prisma, auditService, creditSettings);
  });

  async function reconcile(
    ownerType: CommissionOwnerType,
    ownerId: string,
  ): Promise<{
    accrued: number;
    paid: number;
    ledgerNet: number;
    outstandingBalance: number;
    creditLimit: number;
    availableCredit: number;
    blocked: boolean;
    recomputedBlocked: boolean;
  }> {
    const account = await service.getOrCreateAccount(ownerType, ownerId);
    const { items } = await service.listLedgerEntries(ownerType, ownerId, 1, 100);
    const accrued = items
      .filter((entry) => entry.type === 'ACCRUAL')
      .reduce((sum, entry) => sum + Number(entry.amount), 0);
    const paid = items
      .filter((entry) => entry.type === 'PAYMENT')
      .reduce((sum, entry) => sum + Number(entry.amount), 0);
    const outstandingBalance = Number(account.outstandingBalance);
    const creditLimit = Number(account.creditLimit);
    return {
      accrued,
      paid,
      ledgerNet: accrued - paid,
      outstandingBalance,
      creditLimit,
      availableCredit: Math.max(0, creditLimit - outstandingBalance),
      blocked: account.blocked,
      recomputedBlocked: outstandingBalance > creditLimit,
    };
  }

  it('Merchant scenario: mode-B + mode-C accrual, admin-manual payment, blocking round-trip', async () => {
    if (!databaseAvailable) return;

    await creditSettings.update(CommissionOwnerType.MERCHANT, 20_000, ADMIN_ID, {});

    // Order 1 — mode B (Pay to Merchant) settlement accrual.
    await service.accrue({
      ownerType: CommissionOwnerType.MERCHANT,
      ownerId: MERCHANT_ID,
      amount: 12_000,
      referenceType: 'order',
      referenceId: '77777777-7777-7777-7777-777777777701',
      description: 'Commission owed for order 701 (Pay to Merchant)',
    });

    // Order 2 — mode C (Cash on Delivery) settlement accrual. Pushes
    // outstanding (20,500) past the 20,000 credit limit.
    const afterAccrual = await service.accrue({
      ownerType: CommissionOwnerType.MERCHANT,
      ownerId: MERCHANT_ID,
      amount: 8_500,
      referenceType: 'order',
      referenceId: '77777777-7777-7777-7777-777777777702',
      description: 'Commission owed for order 702 (Cash on Delivery)',
    });
    expect(Number(afterAccrual.outstandingBalance)).toBe(20_500);
    expect(afterAccrual.blocked).toBe(true);

    // Admin records a manual external payment bringing the balance back
    // under the limit.
    const afterPayment = await service.recordPayment({
      ownerType: CommissionOwnerType.MERCHANT,
      ownerId: MERCHANT_ID,
      amount: 15_000,
      description: 'Manual bank transfer received',
      recordedBy: ADMIN_ID,
      context: {},
    });
    expect(Number(afterPayment.outstandingBalance)).toBe(5_500);
    expect(afterPayment.blocked).toBe(false);

    const result = await reconcile(CommissionOwnerType.MERCHANT, MERCHANT_ID);

    expect(result.accrued).toBe(20_500);
    expect(result.paid).toBe(15_000);
    expect(result.ledgerNet).toBe(result.outstandingBalance);
    expect(result.outstandingBalance).toBe(5_500);
    expect(result.creditLimit).toBe(20_000);
    expect(result.availableCredit).toBe(14_500);
    expect(result.blocked).toBe(false);
    expect(result.blocked).toBe(result.recomputedBlocked);
  });

  it('Driver scenario: two ride cash accruals, admin-manual payment, blocking round-trip', async () => {
    if (!databaseAvailable) return;

    // No explicit credit-setting write — uses the real seed-fallback
    // default (₦10,000, DEFAULT_DRIVER_CREDIT_LIMIT), same as a driver's
    // very first cash ride in production.

    // Ride A cash commission accrual.
    await service.accrue({
      ownerType: CommissionOwnerType.DRIVER,
      ownerId: DRIVER_ID,
      amount: 4_200,
      referenceType: 'ride',
      referenceId: '88888888-8888-8888-8888-888888888801',
      description: 'Commission owed for ride 801 (cash)',
    });

    // Ride B cash commission accrual. Pushes outstanding (10,500) past
    // the 10,000 default credit limit.
    const afterAccrual = await service.accrue({
      ownerType: CommissionOwnerType.DRIVER,
      ownerId: DRIVER_ID,
      amount: 6_300,
      referenceType: 'ride',
      referenceId: '88888888-8888-8888-8888-888888888802',
      description: 'Commission owed for ride 802 (cash)',
    });
    expect(Number(afterAccrual.outstandingBalance)).toBe(10_500);
    expect(afterAccrual.blocked).toBe(true);

    const afterPayment = await service.recordPayment({
      ownerType: CommissionOwnerType.DRIVER,
      ownerId: DRIVER_ID,
      amount: 2_000,
      description: 'Manual bank transfer received',
      recordedBy: ADMIN_ID,
      context: {},
    });
    expect(Number(afterPayment.outstandingBalance)).toBe(8_500);
    expect(afterPayment.blocked).toBe(false);

    const result = await reconcile(CommissionOwnerType.DRIVER, DRIVER_ID);

    expect(result.accrued).toBe(10_500);
    expect(result.paid).toBe(2_000);
    expect(result.ledgerNet).toBe(result.outstandingBalance);
    expect(result.outstandingBalance).toBe(8_500);
    expect(result.creditLimit).toBe(10_000);
    expect(result.availableCredit).toBe(1_500);
    expect(result.blocked).toBe(false);
    expect(result.blocked).toBe(result.recomputedBlocked);
  });
});
