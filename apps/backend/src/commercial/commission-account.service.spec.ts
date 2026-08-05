import { CommissionOwnerType, PrismaClient } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { ValidationDomainException } from '../common/exceptions/domain.exception';

import { CommercialCreditSettingsService } from './commercial-credit-settings.service';
import { COMMERCIAL_AUDIT_ACTIONS } from './commercial.constants';
import { CommissionAccountService } from './commission-account.service';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex_dev?schema=public';

const MERCHANT_ID = '22222222-2222-2222-2222-222222222222';
const ADMIN_ID = '33333333-3333-3333-3333-333333333333';

describe('CommissionAccountService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: CommissionAccountService;
  let creditSettings: CommercialCreditSettingsService;
  let auditRecord: jest.Mock;

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

  beforeEach(async () => {
    if (!databaseAvailable) return;
    const auditLogRepository: jest.Mocked<AuditLogRepository> = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    const auditService = new AuditService(auditLogRepository);
    auditRecord = jest.spyOn(auditService, 'record') as unknown as jest.Mock;
    creditSettings = new CommercialCreditSettingsService(prisma, auditService);
    service = new CommissionAccountService(prisma, auditService, creditSettings);

    // A ₦5,000 merchant credit limit — small and round, so accrual math in
    // each test is easy to verify against a known blocking threshold.
    await creditSettings.update(CommissionOwnerType.MERCHANT, 5_000, ADMIN_ID, {});
  });

  it('getOrCreateAccount() seeds a new account from the currently-effective credit limit', async () => {
    if (!databaseAvailable) return;

    const account = await service.getOrCreateAccount(CommissionOwnerType.MERCHANT, MERCHANT_ID);

    expect(account.ownerType).toBe(CommissionOwnerType.MERCHANT);
    expect(account.ownerId).toBe(MERCHANT_ID);
    expect(Number(account.outstandingBalance)).toBe(0);
    expect(Number(account.creditLimit)).toBe(5_000);
    expect(account.blocked).toBe(false);
  });

  it('accrue() adds to the outstanding balance and writes an ACCRUAL ledger entry', async () => {
    if (!databaseAvailable) return;

    const account = await service.accrue({
      ownerType: CommissionOwnerType.MERCHANT,
      ownerId: MERCHANT_ID,
      amount: 1_000,
      referenceType: 'order',
      referenceId: '55555555-5555-5555-5555-555555555555',
    });

    expect(Number(account.outstandingBalance)).toBe(1_000);
    expect(account.blocked).toBe(false);

    const { items } = await service.listLedgerEntries(
      CommissionOwnerType.MERCHANT,
      MERCHANT_ID,
      1,
      10,
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.type).toBe('ACCRUAL');
    expect(Number(items[0]?.amount)).toBe(1_000);
    expect(Number(items[0]?.balanceAfter)).toBe(1_000);
  });

  it('accrue() with the same referenceType/referenceId is exactly-once (replay is a no-op)', async () => {
    if (!databaseAvailable) return;

    await service.accrue({
      ownerType: CommissionOwnerType.MERCHANT,
      ownerId: MERCHANT_ID,
      amount: 1_000,
      referenceType: 'order',
      referenceId: '55555555-5555-5555-5555-555555555555',
    });
    const replayed = await service.accrue({
      ownerType: CommissionOwnerType.MERCHANT,
      ownerId: MERCHANT_ID,
      amount: 1_000,
      referenceType: 'order',
      referenceId: '55555555-5555-5555-5555-555555555555',
    });

    expect(Number(replayed.outstandingBalance)).toBe(1_000);

    const { items } = await service.listLedgerEntries(
      CommissionOwnerType.MERCHANT,
      MERCHANT_ID,
      1,
      10,
    );
    expect(items).toHaveLength(1);
  });

  it('accrue() past the credit limit sets blocked=true and audit-logs BLOCKED', async () => {
    if (!databaseAvailable) return;

    const account = await service.accrue({
      ownerType: CommissionOwnerType.MERCHANT,
      ownerId: MERCHANT_ID,
      amount: 6_000,
      referenceType: 'order',
      referenceId: '55555555-5555-5555-5555-555555555555',
    });

    expect(account.blocked).toBe(true);
    expect(account.blockedAt).not.toBeNull();
    expect(auditRecord).toHaveBeenCalledWith(
      COMMERCIAL_AUDIT_ACTIONS.BLOCKED,
      expect.anything(),
      expect.objectContaining({ resource: 'commission_account' }),
    );
  });

  it('recordPayment() reduces the balance and unblocks once at/below the credit limit', async () => {
    if (!databaseAvailable) return;
    await service.accrue({
      ownerType: CommissionOwnerType.MERCHANT,
      ownerId: MERCHANT_ID,
      amount: 6_000,
      referenceType: 'order',
      referenceId: '55555555-5555-5555-5555-555555555555',
    });

    const paidDown = await service.recordPayment({
      ownerType: CommissionOwnerType.MERCHANT,
      ownerId: MERCHANT_ID,
      amount: 2_000,
      recordedBy: ADMIN_ID,
    });

    expect(Number(paidDown.outstandingBalance)).toBe(4_000);
    expect(paidDown.blocked).toBe(false);
    expect(auditRecord).toHaveBeenCalledWith(
      COMMERCIAL_AUDIT_ACTIONS.PAYMENT_RECORDED,
      expect.objectContaining({ userId: ADMIN_ID }),
      expect.objectContaining({ resource: 'commission_account' }),
    );
    expect(auditRecord).toHaveBeenCalledWith(
      COMMERCIAL_AUDIT_ACTIONS.UNBLOCKED,
      expect.anything(),
      expect.objectContaining({ resource: 'commission_account' }),
    );
  });

  it('recordPayment() exceeding the outstanding balance is rejected', async () => {
    if (!databaseAvailable) return;
    await service.accrue({
      ownerType: CommissionOwnerType.MERCHANT,
      ownerId: MERCHANT_ID,
      amount: 1_000,
      referenceType: 'order',
      referenceId: '55555555-5555-5555-5555-555555555555',
    });

    await expect(
      service.recordPayment({
        ownerType: CommissionOwnerType.MERCHANT,
        ownerId: MERCHANT_ID,
        amount: 2_000,
        recordedBy: ADMIN_ID,
      }),
    ).rejects.toThrow(ValidationDomainException);
  });

  it('accrue() with a non-positive amount is rejected', async () => {
    if (!databaseAvailable) return;

    await expect(
      service.accrue({
        ownerType: CommissionOwnerType.MERCHANT,
        ownerId: MERCHANT_ID,
        amount: 0,
      }),
    ).rejects.toThrow(ValidationDomainException);
  });

  it('MERCHANT and DRIVER accounts for different owners never mix balances', async () => {
    if (!databaseAvailable) return;
    const driverId = '44444444-4444-4444-4444-444444444444';

    await service.accrue({
      ownerType: CommissionOwnerType.MERCHANT,
      ownerId: MERCHANT_ID,
      amount: 1_000,
      referenceType: 'order',
      referenceId: '55555555-5555-5555-5555-555555555555',
    });
    await service.accrue({
      ownerType: CommissionOwnerType.DRIVER,
      ownerId: driverId,
      amount: 2_500,
      referenceType: 'ride',
      referenceId: '66666666-6666-6666-6666-666666666666',
    });

    const merchantAccount = await service.getOrCreateAccount(
      CommissionOwnerType.MERCHANT,
      MERCHANT_ID,
    );
    const driverAccount = await service.getOrCreateAccount(CommissionOwnerType.DRIVER, driverId);

    expect(Number(merchantAccount.outstandingBalance)).toBe(1_000);
    expect(Number(driverAccount.outstandingBalance)).toBe(2_500);
  });
});
