import { RegistrationChannel, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { AUTH_AUDIT_ACTIONS } from '../../audit/audit.constants';
import { UnauthorizedDomainException } from '../../common/exceptions/domain.exception';

import { GoogleAuthService } from './google-auth.service';

import type { SessionService } from './session.service';
import type { TokenService } from './token.service';
import type { AuditService } from '../../audit/audit.service';
import type { AppConfigService } from '../../config/app-config.service';
import type { RedisService } from '../../redis/redis.service';
import type { UsersService } from '../../users/users.service';
import type { GoogleProfileData } from '../auth-google.types';
import type { AuthSessionRepository } from '../repositories/auth-session.repository';
import type { RegistrationRepository } from '../repositories/registration.repository';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-random-secret'),
}));

describe('GoogleAuthService', () => {
  const usersService = {
    findByGoogleId: jest.fn(),
    findByEmail: jest.fn(),
    linkGoogleId: jest.fn(),
    markEmailVerified: jest.fn(),
    activateIfVerificationsComplete: jest.fn(),
    recordLoginActivity: jest.fn(),
    findByIdWithRbac: jest.fn(),
    getByIdOrThrow: jest.fn(),
  } as unknown as jest.Mocked<UsersService>;

  const sessionService = {
    createPortalSession: jest.fn(),
  } as unknown as jest.Mocked<SessionService>;

  const tokenService = {
    issueTokenPair: jest.fn(),
    hashRefreshToken: jest.fn(),
  } as unknown as jest.Mocked<TokenService>;

  const auditService = {
    record: jest.fn(),
  } as unknown as jest.Mocked<AuditService>;

  const appConfig = {
    bcryptSaltRounds: 10,
  } as unknown as jest.Mocked<AppConfigService>;

  const redisService = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  } as unknown as jest.Mocked<RedisService>;

  const registrationRepository = {
    registerPortalUser: jest.fn(),
  } as unknown as jest.Mocked<RegistrationRepository>;

  const authSessionRepository = {
    updateRefreshTokenHash: jest.fn(),
  } as unknown as jest.Mocked<AuthSessionRepository>;

  const service = new GoogleAuthService(
    usersService,
    sessionService,
    tokenService,
    auditService,
    appConfig,
    redisService,
    registrationRepository,
    authSessionRepository,
  );

  const context = { ipAddress: '127.0.0.1', userAgent: 'jest' };

  const profile: GoogleProfileData = {
    googleId: 'google-sub-123',
    email: 'ada@example.com',
    emailVerified: true,
    firstName: 'Ada',
    lastName: 'Lovelace',
  };

  const activeUser = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'ada@example.com',
    phone: null,
    firstName: 'Ada',
    lastName: 'Lovelace',
    status: UserStatus.ACTIVE,
    emailVerifiedAt: new Date(),
    deletedAt: null,
    googleId: 'google-sub-123',
  };

  const sessionMetadata = {
    id: '22222222-2222-2222-2222-222222222222',
    portal: 'customer' as const,
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
    createdAt: '2026-08-06T08:00:00.000Z',
    lastActiveAt: '2026-08-06T08:00:00.000Z',
    expiresAt: '2026-08-13T08:00:00.000Z',
  };

  const tokens = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    tokenType: 'Bearer' as const,
    expiresIn: '15m',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    sessionService.createPortalSession.mockResolvedValue(sessionMetadata);
    tokenService.issueTokenPair.mockResolvedValue(tokens);
    tokenService.hashRefreshToken.mockReturnValue('hashed-refresh-token');
    usersService.findByIdWithRbac.mockResolvedValue({
      ...activeUser,
      roles: [],
    } as never);
  });

  describe('completeSignIn', () => {
    it('signs in an existing Google-linked user without touching the registry', async () => {
      usersService.findByGoogleId.mockResolvedValue(activeUser as never);

      const code = await service.completeSignIn(profile, context);

      expect(usersService.findByEmail).not.toHaveBeenCalled();
      expect(registrationRepository.registerPortalUser).not.toHaveBeenCalled();
      expect(sessionService.createPortalSession).toHaveBeenCalledWith({
        userId: activeUser.id,
        portal: RegistrationChannel.CUSTOMER_WEB,
        context: { ...context, userId: activeUser.id },
      });
      expect(tokenService.issueTokenPair).toHaveBeenCalledWith({
        userId: activeUser.id,
        sessionId: sessionMetadata.id,
        role: 'customer',
        portal: RegistrationChannel.CUSTOMER_WEB,
      });
      expect(redisService.set).toHaveBeenCalledWith(
        expect.stringContaining('auth:google:handoff:'),
        expect.any(String),
        60,
      );
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(0);
      expect(auditService.record).toHaveBeenCalledWith(
        AUTH_AUDIT_ACTIONS.GOOGLE_LOGIN_SUCCESS,
        expect.objectContaining({ userId: activeUser.id }),
        expect.objectContaining({ resourceId: activeUser.id }),
      );
    });

    it('links Google to an existing email-matched account and verifies email', async () => {
      const unverifiedUser = { ...activeUser, emailVerifiedAt: null, googleId: null };
      usersService.findByGoogleId.mockResolvedValue(null);
      usersService.findByEmail.mockResolvedValue(unverifiedUser as never);
      usersService.linkGoogleId.mockResolvedValue(unverifiedUser as never);
      usersService.markEmailVerified.mockResolvedValue({
        ...unverifiedUser,
        emailVerifiedAt: new Date(),
      } as never);
      usersService.activateIfVerificationsComplete.mockResolvedValue(activeUser as never);

      const code = await service.completeSignIn(profile, context);

      expect(usersService.linkGoogleId).toHaveBeenCalledWith(unverifiedUser.id, profile.googleId);
      expect(usersService.markEmailVerified).toHaveBeenCalledWith(unverifiedUser.id);
      expect(usersService.activateIfVerificationsComplete).toHaveBeenCalledWith(
        unverifiedUser.id,
        false,
      );
      expect(auditService.record).toHaveBeenCalledWith(
        AUTH_AUDIT_ACTIONS.GOOGLE_ACCOUNT_LINKED,
        expect.objectContaining({ userId: unverifiedUser.id }),
        expect.anything(),
      );
      expect(typeof code).toBe('string');
    });

    it('creates a brand new customer account when no match exists', async () => {
      usersService.findByGoogleId.mockResolvedValue(null);
      usersService.findByEmail.mockResolvedValue(null);
      registrationRepository.registerPortalUser.mockResolvedValue({
        userId: activeUser.id,
        email: activeUser.email,
        status: UserStatus.ACTIVE,
      });
      usersService.getByIdOrThrow.mockResolvedValue(activeUser as never);

      await service.completeSignIn(profile, context);

      expect(bcrypt.hash).toHaveBeenCalled();
      expect(registrationRepository.registerPortalUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: profile.email,
          registrationChannel: RegistrationChannel.CUSTOMER_WEB_GOOGLE,
          roleName: 'customer',
          portal: 'customer',
          googleId: profile.googleId,
          status: UserStatus.ACTIVE,
        }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        AUTH_AUDIT_ACTIONS.GOOGLE_ACCOUNT_CREATED,
        expect.objectContaining({ userId: activeUser.id }),
        expect.anything(),
      );
    });

    it('rejects sign-in for a non-active account and records the failure', async () => {
      usersService.findByGoogleId.mockResolvedValue({
        ...activeUser,
        status: UserStatus.SUSPENDED,
      } as never);

      await expect(service.completeSignIn(profile, context)).rejects.toBeInstanceOf(
        UnauthorizedDomainException,
      );

      expect(auditService.record).toHaveBeenCalledWith(
        AUTH_AUDIT_ACTIONS.GOOGLE_LOGIN_FAILED,
        context,
        expect.objectContaining({ metadata: expect.objectContaining({ email: profile.email }) }),
      );
      expect(sessionService.createPortalSession).not.toHaveBeenCalled();
    });
  });

  describe('exchangeHandoffCode', () => {
    it('returns and deletes the stored login response on a valid code', async () => {
      const storedResponse = { user: { id: activeUser.id }, accessToken: 'access-token' };
      redisService.get.mockResolvedValue(JSON.stringify(storedResponse));

      const result = await service.exchangeHandoffCode('valid-code');

      expect(redisService.get).toHaveBeenCalledWith('auth:google:handoff:valid-code');
      expect(redisService.del).toHaveBeenCalledWith('auth:google:handoff:valid-code');
      expect(result).toEqual(storedResponse);
    });

    it('throws for a missing or expired code, still clearing the key', async () => {
      redisService.get.mockResolvedValue(null);

      await expect(service.exchangeHandoffCode('bad-code')).rejects.toBeInstanceOf(
        UnauthorizedDomainException,
      );
      expect(redisService.del).toHaveBeenCalledWith('auth:google:handoff:bad-code');
    });
  });
});
