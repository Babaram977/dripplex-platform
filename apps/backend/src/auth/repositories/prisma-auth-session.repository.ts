import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import type {
  AuthSessionRepository,
  CreateAuthSessionInput,
  UpdateSessionActivityInput,
} from './auth-session.repository';
import type { AuthSession } from '@prisma/client';

@Injectable()
export class PrismaAuthSessionRepository implements AuthSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async create(input: CreateAuthSessionInput): Promise<AuthSession> {
    const now = new Date();
    return await this.prisma.authSession.create({
      data: {
        userId: input.userId,
        portal: input.portal,
        expiresAt: input.expiresAt,
        lastActiveAt: now,
        lastSeenAt: now,
        ...(input.ipAddress !== undefined ? { ipAddress: input.ipAddress } : {}),
        ...(input.userAgent !== undefined ? { userAgent: input.userAgent } : {}),
      },
    });
  }

  public async findById(id: string): Promise<AuthSession | null> {
    return await this.prisma.authSession.findUnique({ where: { id } });
  }

  public async updateRefreshTokenHash(input: UpdateSessionActivityInput): Promise<AuthSession> {
    const now = new Date();
    return await this.prisma.authSession.update({
      where: { id: input.sessionId },
      data: {
        refreshTokenHash: input.refreshTokenHash,
        lastActiveAt: now,
        lastSeenAt: now,
      },
    });
  }

  public async updateLastActiveAt(sessionId: string): Promise<void> {
    const now = new Date();
    await this.prisma.authSession.update({
      where: { id: sessionId },
      data: { lastActiveAt: now, lastSeenAt: now },
    });
  }

  public async revokeSession(sessionId: string): Promise<AuthSession> {
    return await this.prisma.authSession.update({
      where: { id: sessionId },
      data: {
        revokedAt: new Date(),
        refreshTokenHash: null,
      },
    });
  }

  public async revokeAllForUser(userId: string): Promise<number> {
    const result = await this.prisma.authSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        refreshTokenHash: null,
      },
    });
    return result.count;
  }
}
