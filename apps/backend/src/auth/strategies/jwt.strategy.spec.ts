import { RegistrationChannel, UserStatus } from '@prisma/client';

import { UnauthorizedDomainException } from '../../common/exceptions/domain.exception';

import { JwtStrategy } from './jwt.strategy';

import type { AppConfigService } from '../../config/app-config.service';
import type { UsersService } from '../../users/users.service';
import type { JwtPayload } from '../auth.types';
import type { AuthSessionRepository } from '../repositories/auth-session.repository';
import type { SessionActivityService } from '../services/session-activity.service';

describe('JwtStrategy', () => {
  const appConfig = {
    jwtAccessSecret: 'access-secret-with-at-least-32-chars!!',
  } as unknown as AppConfigService;

  const usersService = {
    findByIdWithRbac: jest.fn(),
  } as unknown as jest.Mocked<UsersService>;

  const authSessionRepository = {
    findById: jest.fn(),
  } as unknown as jest.Mocked<AuthSessionRepository>;

  const sessionActivityService = {
    touch: jest.fn(),
  } as unknown as jest.Mocked<SessionActivityService>;

  const strategy = new JwtStrategy(
    appConfig,
    usersService,
    authSessionRepository,
    sessionActivityService,
  );

  const payload: JwtPayload = {
    sub: '11111111-1111-1111-1111-111111111111',
    sid: '22222222-2222-2222-2222-222222222222',
    role: 'customer',
    portal: 'customer',
    typ: 'access',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (sessionActivityService.touch as jest.Mock).mockResolvedValue(undefined);
    (authSessionRepository.findById as jest.Mock).mockResolvedValue({
      id: payload.sid,
      userId: payload.sub,
      portal: RegistrationChannel.CUSTOMER_WEB,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    (usersService.findByIdWithRbac as jest.Mock).mockResolvedValue({
      id: payload.sub,
      email: 'ada@example.com',
      status: UserStatus.ACTIVE,
      deletedAt: null,
      roles: [
        {
          role: {
            name: 'customer',
            permissions: [{ permission: { code: 'auth:sessions:read' } }],
          },
        },
      ],
    });
  });

  it('validates an active session and touches activity', async () => {
    const user = await strategy.validate(payload);

    expect(user.id).toBe(payload.sub);
    expect(user.sid).toBe(payload.sid);
    expect(sessionActivityService.touch).toHaveBeenCalledWith(payload.sid, payload.sub);
  });

  it('rejects revoked sessions', async () => {
    (authSessionRepository.findById as jest.Mock).mockResolvedValue({
      id: payload.sid,
      userId: payload.sub,
      portal: RegistrationChannel.CUSTOMER_WEB,
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedDomainException);
  });

  it('rejects expired sessions', async () => {
    (authSessionRepository.findById as jest.Mock).mockResolvedValue({
      id: payload.sid,
      userId: payload.sub,
      portal: RegistrationChannel.CUSTOMER_WEB,
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1_000),
    });

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedDomainException);
  });

  it('rejects inactive users', async () => {
    (usersService.findByIdWithRbac as jest.Mock).mockResolvedValue({
      id: payload.sub,
      email: 'ada@example.com',
      status: UserStatus.SUSPENDED,
      deletedAt: null,
      roles: [{ role: { name: 'customer', permissions: [] } }],
    });

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedDomainException);
  });
});
