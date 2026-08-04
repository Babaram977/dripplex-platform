import { createHash, randomInt } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import {
  DriverVerificationStatus,
  DriverVerificationTrigger,
  FraudReviewStatus,
  type DriverIdentityVerification,
} from '@prisma/client';

import { AuditService, type AuditContext } from '../../audit/audit.service';
import {
  ForbiddenDomainException,
  NotFoundDomainException,
} from '../../common/exceptions/domain.exception';
import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DRIVER_AUDIT_ACTIONS, GPS_ANOMALY_MIN_INTERVAL_MS } from '../driver.constants';

import { impliedSpeedKmh, lagosDateKey } from './geo.util';
import {
  IDENTITY_VERIFICATION_PROVIDER,
  type IdentityVerificationProvider,
} from './identity-verification-provider.adapter';

export interface VerificationRequiredCheck {
  required: boolean;
  reason: DriverVerificationTrigger | null;
  lastVerifiedAt: Date | null;
  /** DPX-DS-001: true = a support-review lock, not a normal retry-able
   * requirement. The caller must not offer the capture flow. */
  locked: boolean;
}

export interface CheckRequiredOptions {
  deviceId?: string;
  latitude?: number;
  longitude?: number;
  /** Only true on an actual "go online" attempt — never on a passive status
   * read, which must stay side-effect-free and deterministic. */
  rollSpotCheck?: boolean;
}

export interface SubmitVerificationInput {
  driverId: string;
  selfieImageBase64: string;
  idDocumentImageBase64?: string;
  idNumber?: string;
  deviceId?: string;
  ipAddress?: string;
  /** Driver-001 Security Standard audit field #9 (session ID) — the
   * `AuthSession.id` behind the caller's access token, sourced from
   * `AuthenticatedUser.sid`. */
  sessionId?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Driver-001 / DPX-DS-001 (docs/DRIVER-001-IDENTITY-VERIFICATION-DESIGN.md) —
 * the risk engine, enforcement, and audit trail for driver facial/identity
 * verification. Provider-agnostic: depends on the `IdentityVerificationProvider`
 * interface, not `SmileIdProvider` directly.
 */
@Injectable()
export class DriverIdentityVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly appConfig: AppConfigService,
    @Inject(IDENTITY_VERIFICATION_PROVIDER)
    private readonly provider: IdentityVerificationProvider,
  ) {}

  /** SHA-256 of a client-supplied device identifier. Never raw UA alone —
   * spoofable, but the same trust level as every other device-recognition
   * signal already in this platform (e.g. AuthSession's device parsing for
   * Wallet's trusted-devices list). */
  public static fingerprint(deviceId: string): string {
    return createHash('sha256').update(deviceId).digest('hex');
  }

  /** Run on every "go online" call, and on status reads (with
   * `rollSpotCheck: false`). Priority order per
   * docs/DRIVER-001-IDENTITY-VERIFICATION-DESIGN.md's risk engine section —
   * first match wins. */
  public async checkRequired(
    driverId: string,
    options: CheckRequiredOptions = {},
  ): Promise<VerificationRequiredCheck> {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId: driverId },
      select: {
        lastIdentityVerifiedAt: true,
        identityVerificationRequiredReason: true,
        identityVerificationLockedAt: true,
      },
    });
    if (!profile) {
      throw new NotFoundDomainException('Driver profile not found');
    }

    if (profile.identityVerificationLockedAt) {
      return {
        required: true,
        reason: profile.identityVerificationRequiredReason,
        lastVerifiedAt: profile.lastIdentityVerifiedAt,
        locked: true,
      };
    }

    if (profile.identityVerificationRequiredReason !== null) {
      return {
        required: true,
        reason: profile.identityVerificationRequiredReason,
        lastVerifiedAt: profile.lastIdentityVerifiedAt,
        locked: false,
      };
    }

    if (!profile.lastIdentityVerifiedAt) {
      return {
        required: true,
        reason: DriverVerificationTrigger.ONBOARDING,
        lastVerifiedAt: null,
        locked: false,
      };
    }

    const now = new Date();

    if (lagosDateKey(profile.lastIdentityVerifiedAt) !== lagosDateKey(now)) {
      return {
        required: true,
        reason: DriverVerificationTrigger.FIRST_LOGIN_OF_DAY,
        lastVerifiedAt: profile.lastIdentityVerifiedAt,
        locked: false,
      };
    }

    const idleMs = this.appConfig.identityVerificationIdleHours * 60 * 60 * 1000;
    if (now.getTime() - profile.lastIdentityVerifiedAt.getTime() > idleMs) {
      return {
        required: true,
        reason: DriverVerificationTrigger.IDLE_TIMEOUT,
        lastVerifiedAt: profile.lastIdentityVerifiedAt,
        locked: false,
      };
    }

    if (options.deviceId) {
      const known = await this.prisma.driverVerifiedDevice.findUnique({
        where: {
          driverId_deviceFingerprint: {
            driverId,
            deviceFingerprint: DriverIdentityVerificationService.fingerprint(options.deviceId),
          },
        },
      });
      if (!known) {
        return {
          required: true,
          reason: DriverVerificationTrigger.NEW_DEVICE,
          lastVerifiedAt: profile.lastIdentityVerifiedAt,
          locked: false,
        };
      }
    }

    if (options.latitude !== undefined && options.longitude !== undefined) {
      const availability = await this.prisma.driverAvailability.findUnique({
        where: { driverId },
        select: { latitude: true, longitude: true, updatedAt: true },
      });
      if (availability?.latitude !== null && availability?.longitude !== null && availability) {
        const elapsedMs = now.getTime() - availability.updatedAt.getTime();
        if (elapsedMs >= GPS_ANOMALY_MIN_INTERVAL_MS) {
          const speedKmh = impliedSpeedKmh(
            {
              latitude: Number(availability.latitude),
              longitude: Number(availability.longitude),
              at: availability.updatedAt,
            },
            { latitude: options.latitude, longitude: options.longitude, at: now },
          );
          if (speedKmh > this.appConfig.driverIdvGpsAnomalySpeedKmh) {
            return {
              required: true,
              reason: DriverVerificationTrigger.GPS_ANOMALY,
              lastVerifiedAt: profile.lastIdentityVerifiedAt,
              locked: false,
            };
          }
        }
      }
    }

    const openFraudSignal = await this.prisma.fraudSignal.findFirst({
      where: {
        userId: driverId,
        deletedAt: null,
        status: { in: [FraudReviewStatus.OPEN, FraudReviewStatus.UNDER_REVIEW] },
      },
      select: { id: true },
    });
    if (openFraudSignal) {
      return {
        required: true,
        reason: DriverVerificationTrigger.SUSPICIOUS_ACTIVITY,
        lastVerifiedAt: profile.lastIdentityVerifiedAt,
        locked: false,
      };
    }

    if (options.rollSpotCheck && randomInt(this.appConfig.driverIdvSpotCheckDenominator) === 0) {
      return {
        required: true,
        reason: DriverVerificationTrigger.RANDOM_SPOT_CHECK,
        lastVerifiedAt: profile.lastIdentityVerifiedAt,
        locked: false,
      };
    }

    return {
      required: false,
      reason: null,
      lastVerifiedAt: profile.lastIdentityVerifiedAt,
      locked: false,
    };
  }

  /** Blocks the caller (e.g. `updateDriverAvailability`) if verification is
   * required. Throws rather than silently no-op-ing. Always rolls the
   * random spot-check — this is only ever called from a real "go online"
   * attempt, never a passive status read. */
  public async assertNotRequired(
    driverId: string,
    options: Omit<CheckRequiredOptions, 'rollSpotCheck'> = {},
  ): Promise<void> {
    const check = await this.checkRequired(driverId, { ...options, rollSpotCheck: true });
    if (check.required) {
      throw new ForbiddenDomainException(
        `Identity verification required before going online (${check.reason ?? 'unknown'})`,
        { reason: check.reason, locked: check.locked },
      );
    }
  }

  /** Sets the flag directly — used by MANUAL_ADMIN and the event-driven
   * subscribers (account recovery, credential change, failed-login
   * lockout), which know their trigger without going through
   * `checkRequired`. */
  public async requireVerification(
    driverId: string,
    trigger: DriverVerificationTrigger,
    context: AuditContext,
  ): Promise<void> {
    const profile = await this.prisma.driverProfile.findUnique({ where: { userId: driverId } });
    if (!profile) return;

    await this.prisma.driverProfile.update({
      where: { userId: driverId },
      data: { identityVerificationRequiredReason: trigger },
    });
    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.IDENTITY_VERIFICATION_REQUESTED,
      { ...context, userId: driverId },
      { resource: 'driver_profile', resourceId: profile.id, metadata: { trigger } },
    );
  }

  /** Support-review unlock — clears the lock and resets the failure
   * counter. Does not itself clear `identityVerificationRequiredReason`;
   * the driver still needs to pass a normal verification afterward. */
  public async unlock(driverId: string, context: AuditContext): Promise<void> {
    const profile = await this.prisma.driverProfile.findUnique({ where: { userId: driverId } });
    if (!profile) {
      throw new NotFoundDomainException('Driver profile not found');
    }

    await this.prisma.driverProfile.update({
      where: { userId: driverId },
      data: { identityVerificationLockedAt: null, failedVerificationAttempts: 0 },
    });
    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.IDENTITY_VERIFICATION_UNLOCKED,
      { ...context, userId: driverId },
      { resource: 'driver_profile', resourceId: profile.id },
    );
  }

  public async status(driverId: string, deviceId?: string): Promise<VerificationRequiredCheck> {
    return await this.checkRequired(driverId, {
      ...(deviceId !== undefined ? { deviceId } : {}),
      rollSpotCheck: false,
    });
  }

  public async submit(
    input: SubmitVerificationInput,
    context: AuditContext,
  ): Promise<DriverIdentityVerification> {
    const check = await this.checkRequired(input.driverId, {
      ...(input.deviceId !== undefined ? { deviceId: input.deviceId } : {}),
      ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
      ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
      rollSpotCheck: false,
    });
    if (check.locked) {
      throw new ForbiddenDomainException('Identity verification is locked pending support review', {
        locked: true,
      });
    }
    const trigger = check.reason ?? DriverVerificationTrigger.MANUAL_ADMIN;

    const record = await this.prisma.driverIdentityVerification.create({
      data: {
        driverId: input.driverId,
        provider: this.provider.provider,
        trigger,
        status: DriverVerificationStatus.PENDING,
        ...(input.deviceId !== undefined ? { deviceId: input.deviceId } : {}),
        ...(input.ipAddress !== undefined ? { ipAddress: input.ipAddress } : {}),
        ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
        ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
        ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
      },
    });

    let result;
    try {
      result =
        trigger === DriverVerificationTrigger.ONBOARDING
          ? await this.provider.enroll({
              driverId: input.driverId,
              selfieImageBase64: input.selfieImageBase64,
              ...(input.idDocumentImageBase64 !== undefined
                ? { idDocumentImageBase64: input.idDocumentImageBase64 }
                : {}),
              ...(input.idNumber !== undefined ? { idNumber: input.idNumber } : {}),
            })
          : await this.provider.verify({
              driverId: input.driverId,
              selfieImageBase64: input.selfieImageBase64,
            });
    } catch (error) {
      // Fail closed, not open: a provider error is treated the same as a
      // failed verification for enforcement purposes, recorded distinctly
      // for ops triage.
      const failureReason = error instanceof Error ? error.message : 'Unknown provider error';
      return await this.complete(
        record,
        { status: 'ERROR', failureReason },
        input.driverId,
        input.deviceId,
        context,
      );
    }

    return await this.complete(record, result, input.driverId, input.deviceId, context);
  }

  private async complete(
    record: DriverIdentityVerification,
    result: {
      status: 'PASSED' | 'FAILED' | 'ERROR';
      confidenceScore?: number;
      providerReference?: string;
      failureReason?: string;
    },
    driverId: string,
    deviceId: string | undefined,
    context: AuditContext,
  ): Promise<DriverIdentityVerification> {
    const status =
      result.status === 'PASSED'
        ? DriverVerificationStatus.PASSED
        : result.status === 'ERROR'
          ? DriverVerificationStatus.ERROR
          : DriverVerificationStatus.FAILED;

    const updated = await this.prisma.driverIdentityVerification.update({
      where: { id: record.id },
      data: {
        status,
        completedAt: new Date(),
        ...(result.confidenceScore !== undefined
          ? { confidenceScore: result.confidenceScore }
          : {}),
        ...(result.providerReference !== undefined
          ? { providerReference: result.providerReference }
          : {}),
        ...(result.failureReason !== undefined ? { failureReason: result.failureReason } : {}),
      },
    });

    if (status === DriverVerificationStatus.PASSED) {
      await this.prisma.driverProfile.update({
        where: { userId: driverId },
        data: {
          lastIdentityVerifiedAt: new Date(),
          identityVerificationRequiredReason: null,
          failedVerificationAttempts: 0,
        },
      });
      if (deviceId) {
        await this.prisma.driverVerifiedDevice.upsert({
          where: {
            driverId_deviceFingerprint: {
              driverId,
              deviceFingerprint: DriverIdentityVerificationService.fingerprint(deviceId),
            },
          },
          create: {
            driverId,
            deviceFingerprint: DriverIdentityVerificationService.fingerprint(deviceId),
          },
          update: {},
        });
      }
      await this.auditService.record(
        DRIVER_AUDIT_ACTIONS.IDENTITY_VERIFICATION_PASSED,
        { ...context, userId: driverId },
        { resource: 'driver_identity_verification', resourceId: record.id },
      );
    } else {
      // Failure or provider error: keep offline immediately, keep the
      // required flag set so the driver must retry — unless this pushes
      // them over the lockout threshold, in which case retrying is refused
      // until a support-review unlock (DPX-DS-001).
      const [profileUpdate] = await this.prisma.$transaction([
        this.prisma.driverProfile.update({
          where: { userId: driverId },
          data: {
            identityVerificationRequiredReason: record.trigger,
            failedVerificationAttempts: { increment: 1 },
          },
        }),
        this.prisma.driverAvailability.updateMany({
          where: { driverId },
          data: { online: false, acceptingRides: false },
        }),
      ]);

      let locked = false;
      if (
        profileUpdate.failedVerificationAttempts >= this.appConfig.driverIdvLockoutThreshold &&
        !profileUpdate.identityVerificationLockedAt
      ) {
        await this.prisma.driverProfile.update({
          where: { userId: driverId },
          data: { identityVerificationLockedAt: new Date() },
        });
        locked = true;
        await this.auditService.record(
          DRIVER_AUDIT_ACTIONS.IDENTITY_VERIFICATION_LOCKED,
          { ...context, userId: driverId },
          {
            resource: 'driver_profile',
            resourceId: driverId,
            metadata: { failedAttempts: profileUpdate.failedVerificationAttempts },
          },
        );
      }

      await this.auditService.record(
        DRIVER_AUDIT_ACTIONS.IDENTITY_VERIFICATION_FAILED,
        { ...context, userId: driverId },
        {
          resource: 'driver_identity_verification',
          resourceId: record.id,
          metadata: {
            status,
            failureReason: result.failureReason,
            failedAttempts: profileUpdate.failedVerificationAttempts,
            locked,
          },
        },
      );
    }

    return updated;
  }
}
