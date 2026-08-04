import type { VerificationRequiredCheck } from './driver-identity-verification.service';
import type { DriverIdentityVerificationDto, IdentityVerificationStatusDto } from '@dripplex/types';
import type { DriverIdentityVerification } from '@prisma/client';

export function toDriverIdentityVerificationDto(
  record: DriverIdentityVerification,
): DriverIdentityVerificationDto {
  return {
    id: record.id,
    driverId: record.driverId,
    provider: record.provider,
    trigger: record.trigger,
    status: record.status,
    confidenceScore: record.confidenceScore !== null ? Number(record.confidenceScore) : null,
    failureReason: record.failureReason,
    sessionId: record.sessionId,
    requestedAt: record.requestedAt.toISOString(),
    completedAt: record.completedAt ? record.completedAt.toISOString() : null,
  };
}

export function toIdentityVerificationStatusDto(
  check: VerificationRequiredCheck,
): IdentityVerificationStatusDto {
  return {
    required: check.required,
    reason: check.reason,
    lastVerifiedAt: check.lastVerifiedAt ? check.lastVerifiedAt.toISOString() : null,
    locked: check.locked,
  };
}
