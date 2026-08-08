import { randomInt, randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';

import { AuditService } from '../../audit/audit.service';
import {
  ForbiddenDomainException,
  NotFoundDomainException,
} from '../../common/exceptions/domain.exception';
import {
  DEFAULT_GPS_ANOMALY_SPEED_KMH_THRESHOLD,
  DEFAULT_IDENTITY_VERIFICATION_LOCKOUT_THRESHOLD,
  DEFAULT_RANDOM_SPOT_CHECK_DENOMINATOR,
  DRIVER_AUDIT_ACTIONS,
} from '../driver.constants';

import { DriverIdentityVerificationService } from './driver-identity-verification.service';

// `randomInt` can't be jest.spyOn'd directly — node:crypto exports it as a
// non-configurable property. Mock the module instead, keeping every other
// export (createHash, randomUUID, ...) real.
jest.mock('node:crypto', () => ({
  ...jest.requireActual('node:crypto'),
  randomInt: jest.fn(),
}));

import type { DriverSecuritySettingsService } from './driver-security-settings.service';
import type { IdentityVerificationProvider } from './identity-verification-provider.adapter';
import type { AuditLogRepository } from '../../audit/repositories/audit-log.repository';
import type { PrismaService } from '../../prisma/prisma.service';
import type { DriverSecuritySettings } from '@prisma/client';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://dripplex:dripplex@localhost:5432/dripplex?schema=public';

const IDLE_HOURS = 8;

function makeSecuritySettings(
  overrides: Partial<DriverSecuritySettings> = {},
): jest.Mocked<Pick<DriverSecuritySettingsService, 'getEffective'>> {
  const settings: DriverSecuritySettings = {
    id: 'settings-fixture',
    idleHours: IDLE_HOURS,
    gpsAnomalySpeedKmh: DEFAULT_GPS_ANOMALY_SPEED_KMH_THRESHOLD,
    lockoutThreshold: DEFAULT_IDENTITY_VERIFICATION_LOCKOUT_THRESHOLD,
    spotCheckDenominator: DEFAULT_RANDOM_SPOT_CHECK_DENOMINATOR,
    newDeviceVerificationEnabled: true,
    adminForceVerificationEnabled: true,
    updatedBy: null,
    updatedAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
  return { getEffective: jest.fn().mockResolvedValue(settings) };
}

describe('DriverIdentityVerificationService', () => {
  let databaseAvailable = false;
  let prisma: PrismaService;
  let service: DriverIdentityVerificationService;
  let auditRecord: jest.Mock;
  let provider: jest.Mocked<IdentityVerificationProvider>;
  const createdUserIds: string[] = [];

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
    if (databaseAvailable && createdUserIds.length > 0) {
      await prisma.driverIdentityVerification.deleteMany({
        where: { driverId: { in: createdUserIds } },
      });
      await prisma.driverVerifiedDevice.deleteMany({ where: { driverId: { in: createdUserIds } } });
      await prisma.fraudSignal.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.driverAvailability
        .deleteMany({ where: { driverId: { in: createdUserIds } } })
        .catch(() => undefined);
      await prisma.driverProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  beforeEach(() => {
    if (!databaseAvailable) return;
    const auditLogRepository: jest.Mocked<AuditLogRepository> = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    const auditService = new AuditService(auditLogRepository);
    auditRecord = jest.spyOn(auditService, 'record') as unknown as jest.Mock;
    const securitySettings = makeSecuritySettings() as unknown as DriverSecuritySettingsService;
    provider = {
      provider: 'SMILE_ID',
      enroll: jest.fn(),
      verify: jest.fn(),
    };
    service = new DriverIdentityVerificationService(
      prisma,
      auditService,
      securitySettings,
      provider,
    );
    // Never-zero by default so the 1-in-20 random spot-check never
    // interferes with unrelated tests that call assertNotRequired (which
    // always rolls it) — individual spot-check tests override this.
    (randomInt as jest.Mock).mockReturnValue(1);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function createDriver(
    overrides: {
      lastIdentityVerifiedAt?: Date | null;
      identityVerificationRequiredReason?:
        | 'ONBOARDING'
        | 'IDLE_TIMEOUT'
        | 'NEW_DEVICE'
        | 'SUSPICIOUS_ACTIVITY'
        | 'ACCOUNT_RECOVERY'
        | 'MANUAL_ADMIN'
        | null;
    } = {},
  ): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `driver-idv-test-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Idv',
        lastName: 'Driver',
      },
    });
    createdUserIds.push(user.id);
    await prisma.driverProfile.create({
      data: {
        userId: user.id,
        status: 'APPROVED',
        isApproved: true,
        lastIdentityVerifiedAt:
          overrides.lastIdentityVerifiedAt === undefined
            ? new Date()
            : overrides.lastIdentityVerifiedAt,
        identityVerificationRequiredReason: overrides.identityVerificationRequiredReason ?? null,
      },
    });
    return user.id;
  }

  it('requires ONBOARDING when the driver has never been verified', async () => {
    if (!databaseAvailable) return;
    const driverId = await createDriver({ lastIdentityVerifiedAt: null });

    const check = await service.checkRequired(driverId, undefined);

    expect(check).toEqual({
      required: true,
      reason: 'ONBOARDING',
      lastVerifiedAt: null,
      locked: false,
    });
  });

  it('does not require verification when recently verified with no other risk signal', async () => {
    if (!databaseAvailable) return;
    const driverId = await createDriver();

    const check = await service.checkRequired(driverId, undefined);

    expect(check.required).toBe(false);
    expect(check.reason).toBeNull();
  });

  it('an already-flagged reason wins over every other check (priority order)', async () => {
    if (!databaseAvailable) return;
    // Flagged AND idle-timed-out AND has an open fraud signal — flag must win.
    const staleDate = new Date(Date.now() - (IDLE_HOURS + 1) * 60 * 60 * 1000);
    const driverId = await createDriver({
      lastIdentityVerifiedAt: staleDate,
      identityVerificationRequiredReason: 'ACCOUNT_RECOVERY',
    });
    await prisma.fraudSignal.create({
      data: {
        userId: driverId,
        signalType: 'test-signal',
        riskScore: 90,
        riskLevel: 'HIGH',
        status: 'OPEN',
      },
    });

    const check = await service.checkRequired(driverId, undefined);

    expect(check.reason).toBe('ACCOUNT_RECOVERY');
  });

  it('idle-timeout boundary: just under the threshold does not trigger, just over it does', async () => {
    if (!databaseAvailable) return;
    // A tiny idle window (not the shared 8h fixture) keeps the ±2s offsets
    // below from ever risking a same-day-vs-yesterday (FIRST_LOGIN_OF_DAY)
    // ambiguity around the Lagos midnight boundary.
    const tinyIdleHours = 1 / 1800; // 2 seconds
    const tinySecuritySettings = makeSecuritySettings({
      idleHours: tinyIdleHours,
    }) as unknown as DriverSecuritySettingsService;
    const tinyIdleService = new DriverIdentityVerificationService(
      prisma,
      new AuditService({ create: jest.fn().mockResolvedValue(undefined) }),
      tinySecuritySettings,
      provider,
    );
    const idleMs = tinyIdleHours * 60 * 60 * 1000;

    const underThreshold = await createDriver({
      lastIdentityVerifiedAt: new Date(Date.now() - idleMs + 500),
    });
    const overThreshold = await createDriver({
      lastIdentityVerifiedAt: new Date(Date.now() - idleMs - 500),
    });

    const underCheck = await tinyIdleService.checkRequired(underThreshold, undefined);
    const overCheck = await tinyIdleService.checkRequired(overThreshold, undefined);

    expect(underCheck.required).toBe(false);
    expect(overCheck).toMatchObject({ required: true, reason: 'IDLE_TIMEOUT' });
  });

  it('requires FIRST_LOGIN_OF_DAY when verified yesterday even within the idle window', async () => {
    if (!databaseAvailable) return;
    // Verified 2 hours ago (well within the 8h idle window) but the
    // fixture forces a different Lagos calendar day than "now".
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const driverId = await createDriver({ lastIdentityVerifiedAt: twoHoursAgo });
    // Force a day rollover by directly setting the stored date to
    // yesterday at the same wall-clock time, independent of idle hours.
    await prisma.driverProfile.update({
      where: { userId: driverId },
      data: { lastIdentityVerifiedAt: new Date(twoHoursAgo.getTime() - 24 * 60 * 60 * 1000) },
    });

    const check = await service.checkRequired(driverId, undefined);

    expect(check).toMatchObject({ required: true, reason: 'FIRST_LOGIN_OF_DAY' });
  });

  it('requires NEW_DEVICE when the device fingerprint is unrecognized', async () => {
    if (!databaseAvailable) return;
    const driverId = await createDriver();

    const check = await service.checkRequired(driverId, { deviceId: 'device-unknown' });

    expect(check).toMatchObject({ required: true, reason: 'NEW_DEVICE' });
  });

  it('does not require NEW_DEVICE once the device has been recorded as verified', async () => {
    if (!databaseAvailable) return;
    const driverId = await createDriver();
    await prisma.driverVerifiedDevice.create({
      data: {
        driverId,
        deviceFingerprint: DriverIdentityVerificationService.fingerprint('device-known'),
      },
    });

    const check = await service.checkRequired(driverId, { deviceId: 'device-known' });

    expect(check.required).toBe(false);
  });

  it('skips NEW_DEVICE entirely when newDeviceVerificationEnabled is disabled', async () => {
    if (!databaseAvailable) return;
    const disabledSettings = makeSecuritySettings({
      newDeviceVerificationEnabled: false,
    }) as unknown as DriverSecuritySettingsService;
    const disabledService = new DriverIdentityVerificationService(
      prisma,
      new AuditService({ create: jest.fn().mockResolvedValue(undefined) }),
      disabledSettings,
      provider,
    );
    const driverId = await createDriver();

    const check = await disabledService.checkRequired(driverId, { deviceId: 'device-unknown' });

    expect(check.required).toBe(false);
  });

  it('requires SUSPICIOUS_ACTIVITY when an open fraud signal exists for the driver', async () => {
    if (!databaseAvailable) return;
    const driverId = await createDriver();
    await prisma.fraudSignal.create({
      data: {
        userId: driverId,
        signalType: 'test-signal',
        riskScore: 75,
        riskLevel: 'MEDIUM',
        status: 'UNDER_REVIEW',
      },
    });

    const check = await service.checkRequired(driverId, undefined);

    expect(check).toMatchObject({ required: true, reason: 'SUSPICIOUS_ACTIVITY' });
  });

  it('ignores a resolved fraud signal', async () => {
    if (!databaseAvailable) return;
    const driverId = await createDriver();
    await prisma.fraudSignal.create({
      data: {
        userId: driverId,
        signalType: 'test-signal',
        riskScore: 20,
        riskLevel: 'LOW',
        status: 'CLEARED',
      },
    });

    const check = await service.checkRequired(driverId, undefined);

    expect(check.required).toBe(false);
  });

  it('requires GPS_ANOMALY when implied speed since the last known position exceeds 150 km/h', async () => {
    if (!databaseAvailable) return;
    const driverId = await createDriver();
    // Lagos, 10 minutes ago.
    await prisma.driverAvailability.create({
      data: {
        driverId,
        online: false,
        acceptingRides: false,
        vehicleType: 'ECONOMY',
        latitude: 6.5244,
        longitude: 3.3792,
        updatedAt: new Date(Date.now() - 10 * 60 * 1000),
      },
    });

    // ~55 km away, 10 minutes later → ~330 km/h implied.
    const check = await service.checkRequired(driverId, { latitude: 6.9744, longitude: 3.3792 });

    expect(check).toMatchObject({ required: true, reason: 'GPS_ANOMALY' });
  });

  it('does not flag GPS_ANOMALY for a realistic driving speed', async () => {
    if (!databaseAvailable) return;
    const driverId = await createDriver();
    await prisma.driverAvailability.create({
      data: {
        driverId,
        online: false,
        acceptingRides: false,
        vehicleType: 'ECONOMY',
        latitude: 6.5244,
        longitude: 3.3792,
        updatedAt: new Date(Date.now() - 60 * 60 * 1000),
      },
    });

    // Same ~55 km, but over an hour → ~55 km/h, well under the threshold.
    const check = await service.checkRequired(driverId, { latitude: 6.9744, longitude: 3.3792 });

    expect(check.required).toBe(false);
  });

  it('skips the GPS-anomaly check within the jitter guard window', async () => {
    if (!databaseAvailable) return;
    const driverId = await createDriver();
    await prisma.driverAvailability.create({
      data: {
        driverId,
        online: false,
        acceptingRides: false,
        vehicleType: 'ECONOMY',
        latitude: 6.5244,
        longitude: 3.3792,
        updatedAt: new Date(Date.now() - 30 * 1000), // 30s ago, under the 5min floor
      },
    });

    const check = await service.checkRequired(driverId, { latitude: 6.9744, longitude: 3.3792 });

    expect(check.required).toBe(false);
  });

  it('rolls a RANDOM_SPOT_CHECK only when rollSpotCheck is true and the roll lands on it', async () => {
    if (!databaseAvailable) return;
    const driverId = await createDriver();
    (randomInt as jest.Mock).mockReturnValue(0);

    const rolled = await service.checkRequired(driverId, { rollSpotCheck: true });
    const notRolled = await service.checkRequired(driverId, { rollSpotCheck: false });

    expect(rolled).toMatchObject({ required: true, reason: 'RANDOM_SPOT_CHECK' });
    expect(notRolled.required).toBe(false);
  });

  it('throws NotFoundDomainException for a user with no driver profile', async () => {
    if (!databaseAvailable) return;
    const user = await prisma.user.create({
      data: {
        email: `driver-idv-noprofile-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'No',
        lastName: 'Profile',
      },
    });
    createdUserIds.push(user.id);

    await expect(service.checkRequired(user.id, undefined)).rejects.toThrow(
      NotFoundDomainException,
    );
  });

  it('assertNotRequired throws ForbiddenDomainException when verification is required', async () => {
    if (!databaseAvailable) return;
    const driverId = await createDriver({ lastIdentityVerifiedAt: null });

    await expect(service.assertNotRequired(driverId, undefined)).rejects.toThrow(
      ForbiddenDomainException,
    );
  });

  it('assertNotRequired resolves silently when verification is not required', async () => {
    if (!databaseAvailable) return;
    const driverId = await createDriver();

    await expect(service.assertNotRequired(driverId, undefined)).resolves.toBeUndefined();
  });

  it('submit(): a PASSED result clears the flag, updates lastIdentityVerifiedAt, and records the device', async () => {
    if (!databaseAvailable) return;
    const driverId = await createDriver({ lastIdentityVerifiedAt: null });
    provider.enroll.mockResolvedValue({
      status: 'PASSED',
      confidenceScore: 98.5,
      providerReference: 'smile-job-1',
    });

    const record = await service.submit(
      { driverId, selfieImageBase64: 'x'.repeat(200), deviceId: 'device-a' },
      { userId: driverId },
    );

    expect(record.status).toBe('PASSED');
    expect(record.trigger).toBe('ONBOARDING');
    expect(Number(record.confidenceScore)).toBeCloseTo(98.5);
    expect(record.providerReference).toBe('smile-job-1');

    const profile = await prisma.driverProfile.findUniqueOrThrow({ where: { userId: driverId } });
    expect(profile.lastIdentityVerifiedAt).not.toBeNull();
    expect(profile.identityVerificationRequiredReason).toBeNull();

    const device = await prisma.driverVerifiedDevice.findUnique({
      where: {
        driverId_deviceFingerprint: {
          driverId,
          deviceFingerprint: DriverIdentityVerificationService.fingerprint('device-a'),
        },
      },
    });
    expect(device).not.toBeNull();

    expect(auditRecord).toHaveBeenCalledWith(
      DRIVER_AUDIT_ACTIONS.IDENTITY_VERIFICATION_PASSED,
      expect.objectContaining({ userId: driverId }),
      expect.objectContaining({ resource: 'driver_identity_verification', resourceId: record.id }),
    );
  });

  it('submit(): a FAILED result keeps the driver flagged and forces availability offline', async () => {
    if (!databaseAvailable) return;
    // Use a tiny idle window (2 seconds) rather than the shared 8h fixture so
    // `lastIdentityVerifiedAt` is only ~2.5s in the past. That keeps it on the
    // same Lagos calendar day as "now" — guaranteeing IDLE_TIMEOUT wins over the
    // higher-priority FIRST_LOGIN_OF_DAY trigger without depending on the
    // wall-clock time the test happens to run at (mirrors the boundary test).
    const tinyIdleHours = 1 / 1800; // 2 seconds
    const tinySecuritySettings = makeSecuritySettings({
      idleHours: tinyIdleHours,
    }) as unknown as DriverSecuritySettingsService;
    const localAudit = new AuditService({ create: jest.fn().mockResolvedValue(undefined) });
    const localAuditRecord = jest.spyOn(localAudit, 'record');
    const tinyIdleService = new DriverIdentityVerificationService(
      prisma,
      localAudit,
      tinySecuritySettings,
      provider,
    );
    const idleMs = tinyIdleHours * 60 * 60 * 1000;
    const driverId = await createDriver({
      lastIdentityVerifiedAt: new Date(Date.now() - idleMs - 500),
    });
    await prisma.driverAvailability.create({
      data: { driverId, online: true, acceptingRides: true, vehicleType: 'ECONOMY' },
    });
    provider.verify.mockResolvedValue({ status: 'FAILED', failureReason: 'face mismatch' });

    const record = await tinyIdleService.submit(
      { driverId, selfieImageBase64: 'x'.repeat(200) },
      { userId: driverId },
    );

    expect(record.status).toBe('FAILED');
    expect(record.trigger).toBe('IDLE_TIMEOUT');
    expect(record.failureReason).toBe('face mismatch');

    const profile = await prisma.driverProfile.findUniqueOrThrow({ where: { userId: driverId } });
    expect(profile.identityVerificationRequiredReason).toBe('IDLE_TIMEOUT');

    const availability = await prisma.driverAvailability.findUniqueOrThrow({ where: { driverId } });
    expect(availability.online).toBe(false);
    expect(availability.acceptingRides).toBe(false);

    expect(localAuditRecord).toHaveBeenCalledWith(
      DRIVER_AUDIT_ACTIONS.IDENTITY_VERIFICATION_FAILED,
      expect.objectContaining({ userId: driverId }),
      expect.objectContaining({
        resource: 'driver_identity_verification',
        resourceId: record.id,
        metadata: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
  });

  it('submit(): a provider error is recorded as ERROR and fails closed like a FAILED result', async () => {
    if (!databaseAvailable) return;
    const driverId = await createDriver();
    await prisma.driverAvailability.create({
      data: { driverId, online: true, acceptingRides: true, vehicleType: 'ECONOMY' },
    });
    provider.verify.mockRejectedValue(new Error('Smile ID is not configured'));

    const record = await service.submit(
      { driverId, selfieImageBase64: 'x'.repeat(200) },
      { userId: driverId },
    );

    expect(record.status).toBe('ERROR');
    expect(record.failureReason).toBe('Smile ID is not configured');

    const availability = await prisma.driverAvailability.findUniqueOrThrow({ where: { driverId } });
    expect(availability.online).toBe(false);
  });

  it('requireVerification sets the flag directly and is a no-op for non-drivers', async () => {
    if (!databaseAvailable) return;
    const driverId = await createDriver();

    await service.requireVerification(driverId, 'ACCOUNT_RECOVERY', {});

    const profile = await prisma.driverProfile.findUniqueOrThrow({ where: { userId: driverId } });
    expect(profile.identityVerificationRequiredReason).toBe('ACCOUNT_RECOVERY');
    expect(auditRecord).toHaveBeenCalledWith(
      DRIVER_AUDIT_ACTIONS.IDENTITY_VERIFICATION_REQUESTED,
      expect.objectContaining({ userId: driverId }),
      expect.objectContaining({ metadata: { trigger: 'ACCOUNT_RECOVERY' } }),
    );

    const nonDriver = await prisma.user.create({
      data: {
        email: `driver-idv-nondriver-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'Not',
        lastName: 'Driver',
      },
    });
    createdUserIds.push(nonDriver.id);

    await expect(
      service.requireVerification(nonDriver.id, 'ACCOUNT_RECOVERY', {}),
    ).resolves.toBeUndefined();
  });

  it('locks the account after 5 consecutive failures and refuses further submit() attempts', async () => {
    if (!databaseAvailable) return;
    const driverId = await createDriver();
    provider.verify.mockResolvedValue({ status: 'FAILED', failureReason: 'no match' });

    for (
      let attempt = 1;
      attempt <= DEFAULT_IDENTITY_VERIFICATION_LOCKOUT_THRESHOLD;
      attempt += 1
    ) {
      await service.submit({ driverId, selfieImageBase64: 'x'.repeat(200) }, { userId: driverId });
    }

    const profile = await prisma.driverProfile.findUniqueOrThrow({ where: { userId: driverId } });
    expect(profile.failedVerificationAttempts).toBe(
      DEFAULT_IDENTITY_VERIFICATION_LOCKOUT_THRESHOLD,
    );
    expect(profile.identityVerificationLockedAt).not.toBeNull();
    expect(auditRecord).toHaveBeenCalledWith(
      DRIVER_AUDIT_ACTIONS.IDENTITY_VERIFICATION_LOCKED,
      expect.objectContaining({ userId: driverId }),
      expect.anything(),
    );

    provider.verify.mockClear();
    await expect(
      service.submit({ driverId, selfieImageBase64: 'x'.repeat(200) }, { userId: driverId }),
    ).rejects.toThrow(ForbiddenDomainException);
    expect(provider.verify).not.toHaveBeenCalled();

    const check = await service.checkRequired(driverId, undefined);
    expect(check.locked).toBe(true);
  });

  it('a PASSED result resets the failure counter', async () => {
    if (!databaseAvailable) return;
    const driverId = await createDriver();
    provider.verify.mockResolvedValueOnce({ status: 'FAILED', failureReason: 'no match' });
    await service.submit({ driverId, selfieImageBase64: 'x'.repeat(200) }, { userId: driverId });

    provider.verify.mockResolvedValueOnce({ status: 'PASSED', confidenceScore: 99 });
    await service.submit({ driverId, selfieImageBase64: 'x'.repeat(200) }, { userId: driverId });

    const profile = await prisma.driverProfile.findUniqueOrThrow({ where: { userId: driverId } });
    expect(profile.failedVerificationAttempts).toBe(0);
  });

  it('unlock() clears the lock and resets the failure counter', async () => {
    if (!databaseAvailable) return;
    const driverId = await createDriver();
    provider.verify.mockResolvedValue({ status: 'FAILED', failureReason: 'no match' });
    for (
      let attempt = 1;
      attempt <= DEFAULT_IDENTITY_VERIFICATION_LOCKOUT_THRESHOLD;
      attempt += 1
    ) {
      await service.submit({ driverId, selfieImageBase64: 'x'.repeat(200) }, { userId: driverId });
    }

    await service.unlock(driverId, { userId: driverId });

    const profile = await prisma.driverProfile.findUniqueOrThrow({ where: { userId: driverId } });
    expect(profile.identityVerificationLockedAt).toBeNull();
    expect(profile.failedVerificationAttempts).toBe(0);
    expect(auditRecord).toHaveBeenCalledWith(
      DRIVER_AUDIT_ACTIONS.IDENTITY_VERIFICATION_UNLOCKED,
      expect.objectContaining({ userId: driverId }),
      expect.anything(),
    );

    const check = await service.checkRequired(driverId, undefined);
    expect(check.locked).toBe(false);
  });

  it('requireVerification(MANUAL_ADMIN) throws when adminForceVerificationEnabled is disabled', async () => {
    if (!databaseAvailable) return;
    const disabledSettings = makeSecuritySettings({
      adminForceVerificationEnabled: false,
    }) as unknown as DriverSecuritySettingsService;
    const disabledService = new DriverIdentityVerificationService(
      prisma,
      new AuditService({ create: jest.fn().mockResolvedValue(undefined) }),
      disabledSettings,
      provider,
    );
    const driverId = await createDriver();

    await expect(disabledService.requireVerification(driverId, 'MANUAL_ADMIN', {})).rejects.toThrow(
      ForbiddenDomainException,
    );

    const profile = await prisma.driverProfile.findUniqueOrThrow({ where: { userId: driverId } });
    expect(profile.identityVerificationRequiredReason).toBeNull();
  });

  it('unlock() throws NotFoundDomainException for a user with no driver profile', async () => {
    if (!databaseAvailable) return;
    const user = await prisma.user.create({
      data: {
        email: `driver-idv-unlock-noprofile-${randomUUID()}@dripplex.test`,
        passwordHash: 'not-a-real-hash',
        firstName: 'No',
        lastName: 'Profile',
      },
    });
    createdUserIds.push(user.id);

    await expect(service.unlock(user.id, {})).rejects.toThrow(NotFoundDomainException);
  });
});
