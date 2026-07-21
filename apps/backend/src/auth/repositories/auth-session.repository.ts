import type { AuthSession, RegistrationChannel } from '@prisma/client';

export interface CreateAuthSessionInput {
  userId: string;
  portal: RegistrationChannel;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
}

export interface AuthSessionRepository {
  create(input: CreateAuthSessionInput): Promise<AuthSession>;
}

export const AUTH_SESSION_REPOSITORY = Symbol('AUTH_SESSION_REPOSITORY');
