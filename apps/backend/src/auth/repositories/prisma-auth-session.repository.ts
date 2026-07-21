import { Injectable } from '@nestjs/common';


import { PrismaService } from '../../prisma/prisma.service';

import type {
  AuthSessionRepository,
  CreateAuthSessionInput,
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
}
