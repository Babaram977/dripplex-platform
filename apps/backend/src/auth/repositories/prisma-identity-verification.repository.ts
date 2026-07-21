import { Injectable } from '@nestjs/common';
import { type IdentityVerification, type IdentityVerificationType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import type {
  CreateIdentityVerificationInput,
  IdentityVerificationRepository,
} from './identity-verification.repository';

@Injectable()
export class PrismaIdentityVerificationRepository implements IdentityVerificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async create(input: CreateIdentityVerificationInput): Promise<IdentityVerification> {
    return await this.prisma.identityVerification.create({
      data: {
        userId: input.userId,
        type: input.type,
        expiresAt: input.expiresAt,
        ...(input.tokenHash !== undefined ? { tokenHash: input.tokenHash } : {}),
        ...(input.otpHash !== undefined ? { otpHash: input.otpHash } : {}),
      },
    });
  }

  public async findByTokenHash(tokenHash: string): Promise<IdentityVerification | null> {
    return await this.prisma.identityVerification.findUnique({
      where: { tokenHash },
    });
  }

  public async findActiveByUserAndType(
    userId: string,
    type: IdentityVerificationType,
  ): Promise<IdentityVerification | null> {
    return await this.prisma.identityVerification.findFirst({
      where: {
        userId,
        type,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async invalidateActiveForUser(
    userId: string,
    type: IdentityVerificationType,
  ): Promise<number> {
    const result = await this.prisma.identityVerification.updateMany({
      where: {
        userId,
        type,
        consumedAt: null,
      },
      data: {
        consumedAt: new Date(),
      },
    });
    return result.count;
  }

  public async markConsumed(id: string): Promise<IdentityVerification> {
    return await this.prisma.identityVerification.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  }

  public async incrementAttemptCount(id: string): Promise<IdentityVerification> {
    return await this.prisma.identityVerification.update({
      where: { id },
      data: { attemptCount: { increment: 1 } },
    });
  }
}
