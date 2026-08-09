import { PrismaClient } from '@prisma/client';

import { ROLE_PERMISSION_GRANTS } from '../../prisma/seed-data/role-permissions';
import { AuditService } from '../audit/audit.service';
import { PERMISSIONS_KEY } from '../common/decorators/permissions.decorator';

import { COMMERCIAL_PERMISSIONS, DEFAULT_PLATFORM_COMMISSION_RATE } from './commercial.constants';
import { AdminPlatformCommissionSettingsController } from './controllers/admin-platform-commission-settings.controller';
import { PlatformCommissionSettingsService } from './platform-commission-settings.service';

import type { AuditLogRepository } from '../audit/repositories/audit-log.repository';
import type { PrismaService } from '../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

const ADMIN_ID = '99999999-9999-9999-9999-999999999901';

describe('PlatformCommissionSettingsService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let auditRecord: jest.Mock;
  let service: PlatformCommissionSettingsService;

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

  afterAll(async () => {
    if (databaseAvailable) {
      // Restore the singleton to its seed-default behavior for other suites.
      await prisma.platformCommissionSetting.deleteMany({}).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    if (!databaseAvailable) return;
    await prisma.platformCommissionSetting.deleteMany({});
    const auditLogRepository: jest.Mocked<AuditLogRepository> = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    const auditService = new AuditService(auditLogRepository);
    auditRecord = jest.spyOn(auditService, 'record') as unknown as jest.Mock;
    service = new PlatformCommissionSettingsService(prisma, auditService);
  });

  it('defaults to the founder-locked launch rate of 15%', async () => {
    if (!databaseAvailable) return;
    const setting = await service.getEffective();
    expect(Number(setting.commissionRate)).toBe(0.15);
    expect(DEFAULT_PLATFORM_COMMISSION_RATE).toBe(0.15);
    expect(await service.getEffectiveRate()).toBe(0.15);
  });

  it('is a stable singleton — repeated reads return the same row', async () => {
    if (!databaseAvailable) return;
    const a = await service.getEffective();
    const b = await service.getEffective();
    expect(a.id).toBe(b.id);
    const count = await prisma.platformCommissionSetting.count();
    expect(count).toBe(1);
  });

  it('updates the rate, records who changed it, and audits the change', async () => {
    if (!databaseAvailable) return;
    await service.getEffective(); // seed at 0.15
    const updated = await service.update(0.2, ADMIN_ID, { userId: ADMIN_ID });

    expect(Number(updated.commissionRate)).toBe(0.2);
    expect(updated.updatedBy).toBe(ADMIN_ID);
    expect(await service.getEffectiveRate()).toBe(0.2);
    expect(auditRecord).toHaveBeenCalledWith(
      'platform_commission_setting.updated',
      expect.objectContaining({ userId: ADMIN_ID }),
      expect.objectContaining({
        resource: 'platform_commission_settings',
        metadata: expect.objectContaining({
          previousRate: 0.15,
          newRate: 0.2,
          changedBy: ADMIN_ID,
        }),
      }),
    );
  });

  describe('authorization contract (unauthorized rate changes are blocked)', () => {
    it('the controller requires the dedicated commission-settings permission', () => {
      const required = Reflect.getMetadata(
        PERMISSIONS_KEY,
        AdminPlatformCommissionSettingsController,
      ) as string[] | undefined;
      expect(required).toEqual([COMMERCIAL_PERMISSIONS.ADMIN_COMMISSION_SETTINGS_MANAGE]);
    });

    it('only administrator / super_administrator hold the permission (not line ops or customers)', () => {
      const perm = COMMERCIAL_PERMISSIONS.ADMIN_COMMISSION_SETTINGS_MANAGE;
      const grants = ROLE_PERMISSION_GRANTS as Record<string, readonly string[]>;
      expect(grants['administrator']).toContain(perm);
      expect(grants['super_administrator']).toContain(perm);
      expect(grants['operations_staff'] ?? []).not.toContain(perm);
      expect(grants['customer'] ?? []).not.toContain(perm);
      expect(grants['driver'] ?? []).not.toContain(perm);
    });
  });
});
