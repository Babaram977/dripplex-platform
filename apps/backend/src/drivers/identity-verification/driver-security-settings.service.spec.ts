import { PrismaClient } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import { type AppConfigService } from '../../config/app-config.service';
import { DRIVER_AUDIT_ACTIONS, DRIVER_SECURITY_SETTINGS_ID } from '../driver.constants';

import { DriverSecuritySettingsService } from './driver-security-settings.service';

import type { AuditLogRepository } from '../../audit/repositories/audit-log.repository';
import type { PrismaService } from '../../prisma/prisma.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

const ADMIN_ID = '11111111-1111-1111-1111-111111111111';

describe('DriverSecuritySettingsService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: DriverSecuritySettingsService;
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
      await prisma.driverSecuritySettings.deleteMany({
        where: { id: DRIVER_SECURITY_SETTINGS_ID },
      });
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
    const appConfig = {
      identityVerificationIdleHours: 2,
      driverIdvLockoutThreshold: 5,
      driverIdvGpsAnomalySpeedKmh: 150,
      driverIdvSpotCheckDenominator: 20,
    } as unknown as AppConfigService;
    service = new DriverSecuritySettingsService(prisma, auditService, appConfig);
  });

  it('getEffective() creates the singleton row seeded from AppConfigService defaults on first read', async () => {
    if (!databaseAvailable) return;

    const settings = await service.getEffective();

    expect(settings.id).toBe(DRIVER_SECURITY_SETTINGS_ID);
    expect(settings.idleHours).toBe(2);
    expect(settings.gpsAnomalySpeedKmh).toBe(150);
    expect(settings.lockoutThreshold).toBe(5);
    expect(settings.spotCheckDenominator).toBe(20);
    expect(settings.newDeviceVerificationEnabled).toBe(true);
    expect(settings.adminForceVerificationEnabled).toBe(true);
  });

  it('getEffective() returns the same row on subsequent reads, not a fresh one', async () => {
    if (!databaseAvailable) return;

    const first = await service.getEffective();
    const second = await service.getEffective();

    expect(second.id).toBe(first.id);
    expect(second.createdAt).toEqual(first.createdAt);
  });

  it('update() patches only the provided fields and records who changed them', async () => {
    if (!databaseAvailable) return;
    await service.getEffective();

    const updated = await service.update(
      { idleHours: 4, newDeviceVerificationEnabled: false },
      ADMIN_ID,
      { userId: ADMIN_ID },
    );

    expect(updated.idleHours).toBe(4);
    expect(updated.newDeviceVerificationEnabled).toBe(false);
    expect(updated.gpsAnomalySpeedKmh).toBe(150);
    expect(updated.updatedBy).toBe(ADMIN_ID);

    expect(auditRecord).toHaveBeenCalledWith(
      DRIVER_AUDIT_ACTIONS.SECURITY_SETTINGS_UPDATED,
      expect.objectContaining({ userId: ADMIN_ID }),
      expect.objectContaining({
        resource: 'driver_security_settings',
        metadata: expect.objectContaining({
          before: expect.objectContaining({ idleHours: 2 }),
          after: expect.objectContaining({ idleHours: 4, newDeviceVerificationEnabled: false }),
        }),
      }),
    );
  });

  it('update() seeds the row first if it does not exist yet', async () => {
    if (!databaseAvailable) return;

    const updated = await service.update({ lockoutThreshold: 3 }, ADMIN_ID, {});

    expect(updated.lockoutThreshold).toBe(3);
    expect(updated.idleHours).toBe(2);
  });
});
