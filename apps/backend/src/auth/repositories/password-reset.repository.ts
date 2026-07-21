import type { PasswordResetToken } from '@prisma/client';

export interface CreatePasswordResetTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface PasswordResetTokenRepository {
  create(input: CreatePasswordResetTokenInput): Promise<PasswordResetToken>;
  findActiveByTokenHash(tokenHash: string): Promise<PasswordResetToken | null>;
  findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null>;
  invalidateActiveForUser(userId: string): Promise<number>;
  markConsumed(id: string): Promise<PasswordResetToken>;
}

export const PASSWORD_RESET_TOKEN_REPOSITORY = Symbol('PASSWORD_RESET_TOKEN_REPOSITORY');
