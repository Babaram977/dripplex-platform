import { isSyntheticEmail } from '../auth/utils/synthetic-email.util';

import type { CustomerKycStatusDto } from '@dripplex/types';
import type { CustomerKyc, User } from '@prisma/client';

/**
 * `record` is null for a user who has never started KYC -- no row is
 * created until `POST /kyc/me/start`, so this returns the NOT_STARTED/
 * LEVEL_0 default shape instead.
 */
export function toCustomerKycStatusDto(
  record: CustomerKyc | null,
  user: Pick<User, 'phoneVerifiedAt' | 'emailVerifiedAt' | 'email'>,
): CustomerKycStatusDto {
  const level0 = user.phoneVerifiedAt !== null;
  const level1 = level0 && (isSyntheticEmail(user.email) || user.emailVerifiedAt !== null);

  if (!record) {
    return {
      level: 'LEVEL_0',
      status: 'NOT_STARTED',
      documentType: null,
      documentNumber: null,
      frontImageUrl: null,
      backImageUrl: null,
      selfieUrl: null,
      remarks: null,
      startedAt: null,
      submittedAt: null,
      reviewStartedAt: null,
      reviewedAt: null,
      verifiedAt: null,
      rejectedAt: null,
      expiresAt: null,
      levelAccess: { level0, level1 },
    };
  }

  return {
    level: record.level,
    status: record.status,
    documentType: record.documentType,
    documentNumber: record.documentNumber,
    frontImageUrl: record.frontImageUrl,
    backImageUrl: record.backImageUrl,
    selfieUrl: record.selfieUrl,
    remarks: record.remarks,
    startedAt: record.startedAt ? record.startedAt.toISOString() : null,
    submittedAt: record.submittedAt ? record.submittedAt.toISOString() : null,
    reviewStartedAt: record.reviewStartedAt ? record.reviewStartedAt.toISOString() : null,
    reviewedAt: record.reviewedAt ? record.reviewedAt.toISOString() : null,
    verifiedAt: record.verifiedAt ? record.verifiedAt.toISOString() : null,
    rejectedAt: record.rejectedAt ? record.rejectedAt.toISOString() : null,
    expiresAt: record.expiresAt ? record.expiresAt.toISOString() : null,
    levelAccess: { level0, level1 },
  };
}
