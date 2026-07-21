import type { IdentityVerification, IdentityVerificationType } from '@prisma/client';

export interface CreateIdentityVerificationInput {
  userId: string;
  type: IdentityVerificationType;
  tokenHash?: string;
  otpHash?: string;
  expiresAt: Date;
}

export interface IdentityVerificationRepository {
  create(input: CreateIdentityVerificationInput): Promise<IdentityVerification>;
  findByTokenHash(tokenHash: string): Promise<IdentityVerification | null>;
  findActiveByUserAndType(
    userId: string,
    type: IdentityVerificationType,
  ): Promise<IdentityVerification | null>;
  invalidateActiveForUser(userId: string, type: IdentityVerificationType): Promise<number>;
  markConsumed(id: string): Promise<IdentityVerification>;
  incrementAttemptCount(id: string): Promise<IdentityVerification>;
}

export const IDENTITY_VERIFICATION_REPOSITORY = Symbol('IDENTITY_VERIFICATION_REPOSITORY');
