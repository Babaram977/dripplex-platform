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
  findBySessionId(sessionId: string): Promise<AuthSession | null>;
  findActiveSessions(userId: string): Promise<AuthSession[]>;
  updateRefreshTokenHash(input: UpdateSessionActivityInput): Promise<AuthSession>;
  updateLastActiveAt(sessionId: string): Promise<void>;
  updateLastActive(sessionId: string): Promise<void>;
  revokeSession(sessionId: string): Promise<AuthSession>;
  revokeAllForUser(userId: string): Promise<number>;
  revokeAllExcept(userId: string, currentSessionId: string): Promise<number>;
  isOwnedByUser(sessionId: string, userId: string): Promise<boolean>;
}

export const AUTH_SESSION_REPOSITORY = Symbol('AUTH_SESSION_REPOSITORY');
