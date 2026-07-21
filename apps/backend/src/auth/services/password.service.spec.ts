import { UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { AUTH_AUDIT_ACTIONS } from '../../audit/audit.constants';
import {
  RateLimitedDomainException,
  UnauthorizedDomainException,
  ValidationDomainException,
} from '../../common/exceptions/domain.exception';

import { PasswordService } from './password.service';

import type { OtpService } from './otp.service';
import type { PasswordPolicyService } from './password-policy.service';
import type { AuditService } from '../../audit/audit.service';
import type { AppConfigService } from '../../config/app-config.service';
import type { NotificationService } from '../../notifications/notification.service';
import type { RedisService } from '../../redis/redis.service';
import type { UsersService } from '../../users/users.service';
import type { AuthSessionRepository } from '../repositories/auth-session.repository';
import type { PasswordResetTokenRepository } from '../repositories/password-reset.repository';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('PasswordService', () => {
  const usersService = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    updatePassword: jest.fn(),
  } as unknown as jest.Mocked<UsersService>;

  const otpService = {
    generateStoreAndDispatch: jest.fn(),
    verify: jest.fn(),
  } as unknown as jest.Mocked<OtpService>;

  const passwordPolicy = {
    assertValid: jest.fn(),
  } as unknown as jest.Mocked<PasswordPolicyService>;

  const auditService = {
    record: jest.fn(),
  } as unknown as jest.Mocked<AuditService>;

  const appConfig = {
    passwordResetTokenTtlSeconds: 900,
    passwordForgotMaxPerHour: 5,
    bcryptSaltRounds: 12,
  } as unknown as AppConfigService;

  const redis = {
    incr: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
  } as unknown as jest.Mocked<RedisService>;

  const passwordResetTokenRepository = {
    invalidateActiveForUser: jest.fn(),
    create: jest.fn(),
    findByTokenHash: jest.fn(),
    markConsumed: jest.fn(),
  } as unknown as jest.Mocked<PasswordResetTokenRepository>;

  const authSessionRepository = {
    revokeAllForUser: jest.fn(),
  } as unknown as jest.Mocked<AuthSessionRepository>;

  const notificationService = {
    sendPasswordReset: jest.fn(),
    sendPasswordChanged: jest.fn(),
  } as unknown as jest.Mocked<NotificationService>;

  const service = new PasswordService(
    usersService,
    otpService,
    passwordPolicy,
    auditService,
    appConfig,
    redis,
    passwordResetTokenRepository,
    authSessionRepository,
    notificationService,
  );

  const activeUser = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'ada@example.com',
    passwordHash: 'hashed-old',
    status: UserStatus.ACTIVE,
    deletedAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (redis.incr as jest.Mock).mockResolvedValue(1);
    (redis.expire as jest.Mock).mockResolvedValue(undefined);
    (auditService.record as jest.Mock).mockResolvedValue(undefined);
    (passwordPolicy.assertValid as jest.Mock).mockImplementation(() => undefined);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-new');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
  });

  describe('forgotPassword', () => {
    it('always returns submitted true and never reveals account existence', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(null);

      const result = await service.forgotPassword('missing@example.com', {});

      expect(result).toEqual({ submitted: true });
      expect(passwordResetTokenRepository.create).not.toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalledWith(
        AUTH_AUDIT_ACTIONS.PASSWORD_FORGOT,
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('creates a reset token and dispatches notification for active users', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(activeUser);
      (passwordResetTokenRepository.invalidateActiveForUser as jest.Mock).mockResolvedValue(0);
      (passwordResetTokenRepository.create as jest.Mock).mockResolvedValue({ id: 'token-1' });
      (otpService.generateStoreAndDispatch as jest.Mock).mockImplementation(
        async (_p, _e, _c, dispatch) => {
          await dispatch('123456', 900);
          return { expiresInSeconds: 900, channel: 'email', otp: '123456' };
        },
      );

      const result = await service.forgotPassword('ada@example.com', { ipAddress: '127.0.0.1' });

      expect(result).toEqual({ submitted: true });
      expect(passwordResetTokenRepository.invalidateActiveForUser).toHaveBeenCalledWith(
        activeUser.id,
      );
      expect(passwordResetTokenRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: activeUser.id,
          tokenHash: expect.any(String),
        }),
      );
      expect(notificationService.sendPasswordReset).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'ada@example.com',
          otp: '123456',
          resetToken: expect.any(String),
        }),
      );
    });

    it('rate limits forgot-password requests', async () => {
      (redis.incr as jest.Mock).mockResolvedValue(6);
      (redis.ttl as jest.Mock).mockResolvedValue(120);

      await expect(service.forgotPassword('ada@example.com', {})).rejects.toBeInstanceOf(
        RateLimitedDomainException,
      );
    });
  });

  describe('resetPassword', () => {
    const resetToken = 'a'.repeat(64);
    const tokenHash = service.hashToken(resetToken);

    const storedToken = {
      id: 'token-row-1',
      userId: activeUser.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    };

    it('resets password, consumes token, and revokes all sessions', async () => {
      (passwordResetTokenRepository.findByTokenHash as jest.Mock).mockResolvedValue(storedToken);
      (usersService.findById as jest.Mock).mockResolvedValue(activeUser);
      (otpService.verify as jest.Mock).mockResolvedValue(undefined);
      (usersService.updatePassword as jest.Mock).mockResolvedValue(activeUser);
      (passwordResetTokenRepository.markConsumed as jest.Mock).mockResolvedValue(storedToken);
      (authSessionRepository.revokeAllForUser as jest.Mock).mockResolvedValue(2);

      const result = await service.resetPassword(
        {
          email: 'ada@example.com',
          resetToken,
          otp: '123456',
          password: 'NewSecure1',
        },
        {},
      );

      expect(result).toEqual({ reset: true });
      expect(usersService.updatePassword).toHaveBeenCalledWith(activeUser.id, 'hashed-new');
      expect(passwordResetTokenRepository.markConsumed).toHaveBeenCalledWith(storedToken.id);
      expect(authSessionRepository.revokeAllForUser).toHaveBeenCalledWith(activeUser.id);
      expect(auditService.record).toHaveBeenCalledWith(
        AUTH_AUDIT_ACTIONS.SESSIONS_REVOKED_PASSWORD,
        expect.objectContaining({ userId: activeUser.id }),
        expect.any(Object),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        AUTH_AUDIT_ACTIONS.PASSWORD_RESET_SUCCESS,
        expect.objectContaining({ userId: activeUser.id }),
        expect.any(Object),
      );
    });

    it('rejects invalid tokens', async () => {
      (passwordResetTokenRepository.findByTokenHash as jest.Mock).mockResolvedValue(null);

      await expect(
        service.resetPassword(
          { email: 'ada@example.com', resetToken, otp: '123456', password: 'NewSecure1' },
          {},
        ),
      ).rejects.toBeInstanceOf(UnauthorizedDomainException);

      expect(auditService.record).toHaveBeenCalledWith(
        AUTH_AUDIT_ACTIONS.PASSWORD_RESET_FAILED,
        expect.any(Object),
        expect.objectContaining({ metadata: { reason: 'invalid_token' } }),
      );
    });

    it('rejects expired tokens', async () => {
      (passwordResetTokenRepository.findByTokenHash as jest.Mock).mockResolvedValue({
        ...storedToken,
        expiresAt: new Date(Date.now() - 1_000),
      });

      await expect(
        service.resetPassword(
          { email: 'ada@example.com', resetToken, otp: '123456', password: 'NewSecure1' },
          {},
        ),
      ).rejects.toBeInstanceOf(UnauthorizedDomainException);

      expect(auditService.record).toHaveBeenCalledWith(
        AUTH_AUDIT_ACTIONS.PASSWORD_RESET_FAILED,
        expect.any(Object),
        expect.objectContaining({ metadata: { reason: 'token_expired' } }),
      );
    });

    it('rejects reused tokens', async () => {
      (passwordResetTokenRepository.findByTokenHash as jest.Mock).mockResolvedValue({
        ...storedToken,
        consumedAt: new Date(),
      });

      await expect(
        service.resetPassword(
          { email: 'ada@example.com', resetToken, otp: '123456', password: 'NewSecure1' },
          {},
        ),
      ).rejects.toBeInstanceOf(UnauthorizedDomainException);

      expect(auditService.record).toHaveBeenCalledWith(
        AUTH_AUDIT_ACTIONS.PASSWORD_RESET_FAILED,
        expect.any(Object),
        expect.objectContaining({ metadata: { reason: 'token_reused' } }),
      );
    });
  });

  describe('changePassword', () => {
    it('changes password and revokes all sessions', async () => {
      (usersService.findById as jest.Mock).mockResolvedValue(activeUser);
      (usersService.updatePassword as jest.Mock).mockResolvedValue(activeUser);
      (authSessionRepository.revokeAllForUser as jest.Mock).mockResolvedValue(3);

      const result = await service.changePassword(
        activeUser.id,
        { currentPassword: 'SecurePass1', newPassword: 'NewSecure2' },
        {},
      );

      expect(result).toEqual({ changed: true });
      expect(authSessionRepository.revokeAllForUser).toHaveBeenCalledWith(activeUser.id);
      expect(auditService.record).toHaveBeenCalledWith(
        AUTH_AUDIT_ACTIONS.PASSWORD_CHANGED,
        expect.objectContaining({ userId: activeUser.id }),
        expect.any(Object),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        AUTH_AUDIT_ACTIONS.SESSIONS_REVOKED_PASSWORD,
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('rejects wrong current password', async () => {
      (usersService.findById as jest.Mock).mockResolvedValue(activeUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(
          activeUser.id,
          { currentPassword: 'WrongPass1', newPassword: 'NewSecure2' },
          {},
        ),
      ).rejects.toBeInstanceOf(UnauthorizedDomainException);

      expect(auditService.record).toHaveBeenCalledWith(
        AUTH_AUDIT_ACTIONS.PASSWORD_CHANGE_FAILED,
        expect.any(Object),
        expect.objectContaining({ metadata: { reason: 'wrong_current_password' } }),
      );
    });

    it('rejects identical new password', async () => {
      (usersService.findById as jest.Mock).mockResolvedValue(activeUser);

      await expect(
        service.changePassword(
          activeUser.id,
          { currentPassword: 'SecurePass1', newPassword: 'SecurePass1' },
          {},
        ),
      ).rejects.toBeInstanceOf(ValidationDomainException);
    });
  });
});
