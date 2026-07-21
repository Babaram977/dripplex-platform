import { Inject, Injectable } from '@nestjs/common';

import { NotFoundDomainException } from '../common/exceptions/domain.exception';

import {
  USERS_REPOSITORY,
  type CreateUserInput,
  type UserWithRbac,
  type UsersRepository,
} from './repositories/users.repository';

import type { User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
  ) {}

  public createUser(input: CreateUserInput): Promise<User> {
    return this.usersRepository.create(input);
  }

  public findById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  public findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  public findByPhone(phone: string): Promise<User | null> {
    return this.usersRepository.findByPhone(phone);
  }

  public findByIdWithRbac(id: string): Promise<UserWithRbac | null> {
    return this.usersRepository.findByIdWithRbac(id);
  }

  public markLogin(id: string): Promise<User> {
    return this.usersRepository.markLogin(id);
  }

  public markEmailVerified(id: string): Promise<User> {
    return this.usersRepository.markEmailVerified(id);
  }

  public async getByIdOrThrow(id: string): Promise<User> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundDomainException('User not found');
    }
    return user;
  }

  public async listUsers(
    page: number,
    limit: number,
  ): Promise<{
    items: {
      id: string;
      email: string;
      phone: string | null;
      firstName: string;
      lastName: string;
      status: string;
      createdAt: Date;
    }[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const skip = (page - 1) * limit;
    const { items, total } = await this.usersRepository.list({ skip, take: limit });

    return {
      items: items.map((user) => ({
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
        createdAt: user.createdAt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  public async softDeleteUser(id: string): Promise<User> {
    await this.getByIdOrThrow(id);
    return await this.usersRepository.softDelete(id);
  }
}
