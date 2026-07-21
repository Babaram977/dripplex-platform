import { Injectable } from '@nestjs/common';
import { type User, UserStatus } from '@prisma/client';

import { NotFoundDomainException } from '../../common/exceptions/domain.exception';
import { PrismaService } from '../../prisma/prisma.service';

import type { CreateUserInput, UserWithRbac, UsersRepository } from './users.repository';

@Injectable()
export class PrismaUsersRepository implements UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async create(input: CreateUserInput): Promise<User> {
    return await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        status: input.status,
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.registrationChannel !== undefined
          ? { registrationChannel: input.registrationChannel }
          : {}),
      },
    });
  }

  public async findById(id: string): Promise<User | null> {
    return await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
  }

  public async findByEmail(email: string): Promise<User | null> {
    return await this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    });
  }

  public async findByPhone(phone: string): Promise<User | null> {
    return await this.prisma.user.findFirst({
      where: { phone, deletedAt: null },
    });
  }

  public async findByIdWithRbac(id: string): Promise<UserWithRbac | null> {
    return await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: {
        roles: {
          where: { role: { deletedAt: null } },
          include: {
            role: {
              include: {
                permissions: {
                  where: { permission: { deletedAt: null } },
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  public async markLogin(id: string): Promise<User> {
    return await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  public async markEmailVerified(id: string): Promise<User> {
    return await this.prisma.user.update({
      where: { id },
      data: {
        emailVerifiedAt: new Date(),
      },
    });
  }

  public async markPhoneVerified(id: string): Promise<User> {
    return await this.prisma.user.update({
      where: { id },
      data: {
        phoneVerifiedAt: new Date(),
      },
    });
  }

  public async activateIfVerificationsComplete(
    id: string,
    requiresPhoneVerification: boolean,
  ): Promise<User> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundDomainException('User not found');
    }

    const emailVerified = user.emailVerifiedAt !== null;
    const phoneVerified = user.phoneVerifiedAt !== null;
    const verificationsComplete = emailVerified && (!requiresPhoneVerification || phoneVerified);

    if (!verificationsComplete || user.status === UserStatus.ACTIVE) {
      return user;
    }

    return await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.ACTIVE },
    });
  }

  public async softDelete(id: string): Promise<User> {
    return await this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: UserStatus.INACTIVE,
      },
    });
  }

  public async list(params: {
    skip: number;
    take: number;
  }): Promise<{ items: User[]; total: number }> {
    const where = { deletedAt: null };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total };
  }
}
