import { DriverVerificationTrigger } from '@prisma/client';

import { DriverIdentityVerificationService } from './driver-identity-verification.service';

import type { DriverSecuritySettingsService } from './driver-security-settings.service';
import type { IdentityVerificationProvider } from './identity-verification-provider.adapter';
import type { AuditService } from '../../audit/audit.service';
import type { AppConfigService } from '../../config/app-config.service';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * Never demand a check that cannot be satisfied.
 *
 * Production ran for weeks with no `SMILE_ID_*` credentials, and Smile ID is
 * the only wired biometric provider — it throws "Smile ID is not configured"
 * on every call. So every already-verified driver was asked for a fresh selfie
 * on their first login each day, the selfie could not succeed, and the driver
 * could not go online. A check nobody can pass is not a control, it is a
 * locked door.
 *
 * The periodic checks are also the expensive ones: a vendor charges per snap,
 * and re-checking the whole fleet every morning multiplies that by every
 * driver, every day. So Ops can switch them off independently even when a
 * provider IS configured.
 *
 * Onboarding is deliberately NOT covered by either switch — a driver who has
 * never been verified is still required to be, and an operator clears that by
 * manual review.
 */

const DRIVER_ID = '11111111-1111-1111-1111-111111111111';
const YESTERDAY = new Date(Date.now() - 36 * 60 * 60 * 1000);

function build(options: {
  biometricAvailable: boolean;
  periodicEnabled: boolean;
  lastIdentityVerifiedAt: Date | null;
}): DriverIdentityVerificationService {
  const prisma = {
    driverProfile: {
      findUnique: jest.fn().mockResolvedValue({
        lastIdentityVerifiedAt: options.lastIdentityVerifiedAt,
        identityVerificationRequiredReason: null,
        identityVerificationLockedAt: null,
      }),
    },
  } as unknown as PrismaService;

  const securitySettings = {
    getEffective: jest.fn().mockResolvedValue({
      idleHours: 8,
      newDeviceVerificationEnabled: true,
      adminForceVerificationEnabled: true,
      periodicVerificationEnabled: options.periodicEnabled,
    }),
  } as unknown as DriverSecuritySettingsService;

  return new DriverIdentityVerificationService(
    prisma,
    {} as unknown as AuditService,
    securitySettings,
    {
      biometricIdentityVerificationAvailable: options.biometricAvailable,
    } as unknown as AppConfigService,
    {} as unknown as IdentityVerificationProvider,
  );
}

describe('Periodic driver re-verification gate', () => {
  it('does NOT demand a daily selfie when no biometric provider is configured', async () => {
    // The exact production state: verified once by an operator, then locked
    // out every following morning by a check that could never pass.
    const service = build({
      biometricAvailable: false,
      periodicEnabled: true,
      lastIdentityVerifiedAt: YESTERDAY,
    });
    await expect(service.checkRequired(DRIVER_ID)).resolves.toMatchObject({
      required: false,
      locked: false,
    });
  });

  it('does NOT demand one when Ops has switched periodic checks off', async () => {
    // A provider IS configured, but each snap costs money and the platform
    // only wants the check at onboarding.
    const service = build({
      biometricAvailable: true,
      periodicEnabled: false,
      lastIdentityVerifiedAt: YESTERDAY,
    });
    await expect(service.checkRequired(DRIVER_ID)).resolves.toMatchObject({ required: false });
  });

  it('DOES demand one when a provider is configured and Ops left it on', async () => {
    // The control still works where it can actually be satisfied — this is
    // what stops the fix from quietly disabling a real security check.
    const service = build({
      biometricAvailable: true,
      periodicEnabled: true,
      lastIdentityVerifiedAt: YESTERDAY,
    });
    await expect(service.checkRequired(DRIVER_ID)).resolves.toMatchObject({
      required: true,
      reason: DriverVerificationTrigger.FIRST_LOGIN_OF_DAY,
    });
  });

  it('still requires ONBOARDING verification, whatever the switches say', async () => {
    // A driver who has never been verified is not waved through. An operator
    // clears this by manual review, which is the launch path.
    for (const biometricAvailable of [true, false]) {
      for (const periodicEnabled of [true, false]) {
        const service = build({
          biometricAvailable,
          periodicEnabled,
          lastIdentityVerifiedAt: null,
        });
        await expect(service.checkRequired(DRIVER_ID)).resolves.toMatchObject({
          required: true,
          reason: DriverVerificationTrigger.ONBOARDING,
        });
      }
    }
  });
});
