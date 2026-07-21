import type { User, UserStatus } from '@prisma/client';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone?: string;
  status: UserStatus;
}

export interface UserWithRbac extends User {
  roles: {
    role: {
      name: string;
      permissions: {
        permission: {
          code: string;
        };
      }[];
    };
  }[];
}

export interface UsersRepository {
  create(input: CreateUserInput): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByPhone(phone: string): Promise<User | null>;
  findByIdWithRbac(id: string): Promise<UserWithRbac | null>;
  markLogin(id: string): Promise<User>;
  markEmailVerified(id: string): Promise<User>;
  softDelete(id: string): Promise<User>;
  list(params: { skip: number; take: number }): Promise<{ items: User[]; total: number }>;
}

export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');
