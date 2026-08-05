import { CommissionOwnerType, PrismaClient } from '@prisma/client';

import { AuditService } from '../audit/audit.service';

import { CommercialCreditSettingsService } from './commercial-credit-settings.service';
import {
  COMMERCIAL_AUDIT_ACTIONS,
  DEFAULT_DRIVER_CREDIT_LIMIT,
  DEFAULT_MERCHANT_CREDIT_LIMIT,
} from './commercial.constants';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex_dev?schema=public';

const ADMIN_ID = '11111111-1111-1111-1111-111111111111';

describe('CommercialCreditSettingsService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: CommercialCreditSettingsService;
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
    auditRecord = jest.spyOn(auditService, 'record') as unknown as jest.Mock;
    service = new CommercialCreditSettingsService(prisma, auditService);
  });

  it('getEffective(MERCHANT) creates the row seeded from DEFAULT_MERCHANT_CREDIT_LIMIT on first read', async () => {
    if (!databaseAvailable) return;

    const setting = await service.getEffective(CommissionOwnerType.MERCHANT);

    expect(setting.ownerType).toBe(CommissionOwnerType.MERCHANT);
    expect(Number(setting.creditLimit)).toBe(DEFAULT_MERCHANT_CREDIT_LIMIT);
  });

  it('getEffective(DRIVER) creates the row seeded from DEFAULT_DRIVER_CREDIT_LIMIT on first read', async () => {
    if (!databaseAvailable) return;

    const setting = await service.getEffective(CommissionOwnerType.DRIVER);

    expect(setting.ownerType).toBe(CommissionOwnerType.DRIVER);
    expect(Number(setting.creditLimit)).toBe(DEFAULT_DRIVER_CREDIT_LIMIT);
  });

  it('getEffective(RIDER) shares the driver default (§1.3 treats Driver/Rider as one credit-policy concept)', async () => {
    if (!databaseAvailable) return;

    const setting = await service.getEffective(CommissionOwnerType.RIDER);

    expect(Number(setting.creditLimit)).toBe(DEFAULT_DRIVER_CREDIT_LIMIT);
  });

  it('getEffective() returns the same row on subsequent reads, not a fresh one', async () => {
    if (!databaseAvailable) return;

    const first = await service.getEffective(CommissionOwnerType.MERCHANT);
    const second = await service.getEffective(CommissionOwnerType.MERCHANT);

    expect(second.id).toBe(first.id);
    expect(second.createdAt).toEqual(first.createdAt);
  });

  it('MERCHANT and DRIVER settings are independent rows', async () => {
    if (!databaseAvailable) return;

    await service.update(CommissionOwnerType.MERCHANT, 50_000, ADMIN_ID, { userId: ADMIN_ID });
    const driverSetting = await service.getEffective(CommissionOwnerType.DRIVER);

    expect(Number(driverSetting.creditLimit)).toBe(DEFAULT_DRIVER_CREDIT_LIMIT);
  });

  it('update() changes the limit, records who changed it, and audit-logs the before/after', async () => {
    if (!databaseAvailable) return;
    await service.getEffective(CommissionOwnerType.MERCHANT);

    const updated = await service.update(CommissionOwnerType.MERCHANT, 25_000, ADMIN_ID, {
      userId: ADMIN_ID,
    });

    expect(Number(updated.creditLimit)).toBe(25_000);
    expect(updated.updatedBy).toBe(ADMIN_ID);

    expect(auditRecord).toHaveBeenCalledWith(
      COMMERCIAL_AUDIT_ACTIONS.CREDIT_SETTING_UPDATED,
      expect.objectContaining({ userId: ADMIN_ID }),
      expect.objectContaining({
        resource: 'commercial_credit_settings',
        metadata: expect.objectContaining({
          ownerType: CommissionOwnerType.MERCHANT,
          previousCreditLimit: DEFAULT_MERCHANT_CREDIT_LIMIT,
          newCreditLimit: 25_000,
          changedBy: ADMIN_ID,
        }),
      }),
    );
  });

  it('update() seeds the row first if it does not exist yet', async () => {
    if (!databaseAvailable) return;

    const updated = await service.update(CommissionOwnerType.DRIVER, 15_000, ADMIN_ID, {});

    expect(Number(updated.creditLimit)).toBe(15_000);
  });
});
