import type { AuthSession, RegistrationChannel } from '@prisma/client';

export interface CreateAuthSessionInput {
  userId: string;
  portal: RegistrationChannel;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
}

export interface UpdateSessionActivityInput {
  sessionId: string;
  refreshTokenHash: string;
}

export interface AuthSessionRepository {
  create(input: CreateAuthSessionInput): Promise<AuthSession>;
  findById(id: string): Promise<AuthSession | null>;
  updateRefreshTokenHash(input: UpdateSessionActivityInput): Promise<AuthSession>;
  updateLastActiveAt(sessionId: string): Promise<void>;
  revokeSession(sessionId: string): Promise<AuthSession>;
  revokeAllForUser(userId: string): Promise<number>;
}

export const AUTH_SESSION_REPOSITORY = Symbol('AUTH_SESSION_REPOSITORY');
