import { type JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import {
  ConflictDomainException,
  UnauthorizedDomainException,
} from '../common/exceptions/domain.exception';

import { AuthService } from './auth.service';

import type { AppConfigService } from '../config/app-config.service';
import type { RedisService } from '../redis/redis.service';
import type { UsersService } from '../users/users.service';
import type { Logger } from 'nestjs-pino';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  const usersService = {
    findByEmail: jest.fn(),
    findByPhone: jest.fn(),
    createUser: jest.fn(),
    markLogin: jest.fn(),
    markEmailVerified: jest.fn(),
    findByIdWithRbac: jest.fn(),
  } as unknown as jest.Mocked<UsersService>;

  const jwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  } as unknown as jest.Mocked<JwtService>;

  const appConfig = {
    bcryptSaltRounds: 12,
    jwtAccessSecret: 'access-secret-with-at-least-32-chars!!',
    jwtRefreshSecret: 'refresh-secret-with-at-least-32-chars!',
    jwtAccessTtl: '15m',
    jwtRefreshTtl: '7d',
    otpTtlSeconds: 300,
    otpLength: 6,
    isProduction: false,
  } as unknown as AppConfigService;

  const redis = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  } as unknown as jest.Mocked<RedisService>;

  const logger = {
    debug: jest.fn(),
    log: jest.fn(),
  } as unknown as Logger;

  const service = new AuthService(usersService, jwtService, appConfig, redis, logger);

  const userRecord = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'user@dripplex.com',
    phone: null,
    passwordHash: 'hashed',
    firstName: 'Ada',
    lastName: 'Lovelace',
    status: UserStatus.ACTIVE,
    emailVerifiedAt: null,
    phoneVerifiedAt: null,
    lastLoginAt: null,
    registrationChannel: null,
    passwordChangedAt: null,
    blockedAt: null,
    blockedReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    roles: [
      {
        role: {
          name: 'customer',
          permissions: [{ permission: { code: 'users:read' } }],
        },
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (jwtService.signAsync as jest.Mock)
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');
    (usersService.findByIdWithRbac as jest.Mock).mockResolvedValue(userRecord);
  });

  it('registers a new user and returns tokens', async () => {
    (usersService.findByEmail as jest.Mock).mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
    (usersService.createUser as jest.Mock).mockResolvedValue(userRecord);

    const result = await service.register({
      email: 'user@dripplex.com',
      password: 'Password1',
      firstName: 'Ada',
      lastName: 'Lovelace',
    });

    expect(result.tokens.accessToken).toBe('access-token');
    expect(result.user.email).toBe('user@dripplex.com');
    expect(result.user.permissions).toContain('users:read');
  });

  it('rejects duplicate email registration', async () => {
    (usersService.findByEmail as jest.Mock).mockResolvedValue(userRecord);

    await expect(
      service.register({
        email: 'user@dripplex.com',
        password: 'Password1',
        firstName: 'Ada',
        lastName: 'Lovelace',
      }),
    ).rejects.toBeInstanceOf(ConflictDomainException);
  });

  it('rejects invalid login credentials', async () => {
    (usersService.findByEmail as jest.Mock).mockResolvedValue(userRecord);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login({ email: 'user@dripplex.com', password: 'Password1' }),
    ).rejects.toBeInstanceOf(UnauthorizedDomainException);
  });

  it('logs in a valid user', async () => {
    (usersService.findByEmail as jest.Mock).mockResolvedValue(userRecord);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (usersService.markLogin as jest.Mock).mockResolvedValue(userRecord);

    const result = await service.login({
      email: 'user@dripplex.com',
      password: 'Password1',
    });

    expect(result.tokens.refreshToken).toBe('refresh-token');
    expect(usersService.markLogin).toHaveBeenCalledWith(userRecord.id);
  });

  it('stores a hashed OTP on request', async () => {
    (usersService.findByEmail as jest.Mock).mockResolvedValue(userRecord);
    (redis.set as jest.Mock).mockResolvedValue(undefined);

    const result = await service.requestOtp({ email: 'user@dripplex.com' });

    expect(result.expiresInSeconds).toBe(300);
    expect(redis.set).toHaveBeenCalledWith('auth:otp:user@dripplex.com', expect.any(String), 300);
  });
});
