import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import type {
  CreatePasswordResetTokenInput,
  PasswordResetTokenRepository,
} from './password-reset.repository';
import type { PasswordResetToken } from '@prisma/client';

@Injectable()
export class PrismaPasswordResetTokenRepository implements PasswordResetTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async create(input: CreatePasswordResetTokenInput): Promise<PasswordResetToken> {
    return await this.prisma.passwordResetToken.create({
      data: {
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
    });
  }

  public async findActiveByTokenHash(tokenHash: string): Promise<PasswordResetToken | null> {
    return await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  public async findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null> {
    return await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
  }

  public async invalidateActiveForUser(userId: string): Promise<number> {
    const result = await this.prisma.passwordResetToken.updateMany({
      where: {
        userId,
        consumedAt: null,
      },
      data: {
        consumedAt: new Date(),
      },
    });
    return result.count;
  }

  public async markConsumed(id: string): Promise<PasswordResetToken> {
    return await this.prisma.passwordResetToken.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  }
}
