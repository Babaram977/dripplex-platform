import { createHash, createHmac } from 'node:crypto';

import { IdentityVerificationType, UserStatus } from '@prisma/client';

import { AUTH_AUDIT_ACTIONS } from '../../audit/audit.constants';
import {
  RateLimitedDomainException,
  UnauthorizedDomainException,
} from '../../common/exceptions/domain.exception';

import { EmailVerificationService } from './email-verification.service';

import type { AuditService } from '../../audit/audit.service';
import type { AppConfigService } from '../../config/app-config.service';
import type { NotificationService } from '../../notifications/notification.service';
import type { RedisService } from '../../redis/redis.service';
import type { UsersService } from '../../users/users.service';
import type { IdentityVerificationRepository } from '../repositories/identity-verification.repository';

describe('EmailVerificationService', () => {
  const usersService = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    markEmailVerified: jest.fn(),
    activateIfVerificationsComplete: jest.fn(),
  } as unknown as jest.Mocked<UsersService>;

  const auditService = { record: jest.fn() } as unknown as jest.Mocked<AuditService>;

  const appConfig = {
    jwtAccessSecret: 'access-secret-with-at-least-32-chars!!',
    emailVerificationTtlSeconds: 600,
    emailVerificationMaxPerHour: 5,
    identityVerificationMaxAttempts: 10,
    identityVerificationLockoutSeconds: 1800,
    identityVerificationResendCooldownSeconds: 60,
  } as unknown as AppConfigService;

  const redis = {
    incr: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    setNx: jest.fn(),
  } as unknown as jest.Mocked<RedisService>;

  const verificationRepository = {
    invalidateActiveForUser: jest.fn(),
    create: jest.fn(),
    findByTokenHash: jest.fn(),
    markConsumed: jest.fn(),
    incrementAttemptCount: jest.fn(),
  } as unknown as jest.Mocked<IdentityVerificationRepository>;

  const notificationService = {
    sendEmailVerification: jest.fn(),
  } as unknown as jest.Mocked<NotificationService>;

  const service = new EmailVerificationService(
    usersService,
    auditService,
    appConfig,
    redis,
    verificationRepository,
    notificationService,
  );

  const user = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'ada@example.com',
    status: UserStatus.PENDING_VERIFICATION,
    registrationChannel: null,
    deletedAt: null,
  };

  const signToken = (nonce = 'noncevaluebase64urltokenxxxxxxxx'): string => {
    const signature = createHmac('sha256', appConfig.jwtAccessSecret)
      .update(nonce)
      .digest('base64url');
    return `${nonce}.${signature}`;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (redis.incr as jest.Mock).mockResolvedValue(1);
    (redis.expire as jest.Mock).mockResolvedValue(undefined);
    (redis.setNx as jest.Mock).mockResolvedValue(true);
    (auditService.record as jest.Mock).mockResolvedValue(undefined);
    (notificationService.sendEmailVerification as jest.Mock).mockResolvedValue(undefined);
  });

  it('always returns submitted for send (anti-enumeration)', async () => {
    (usersService.findByEmail as jest.Mock).mockResolvedValue(null);

    await expect(service.sendVerification('missing@example.com', {})).resolves.toEqual({
      submitted: true,
    });
    expect(verificationRepository.create).not.toHaveBeenCalled();
  });

  it('creates signed token challenge and notifies for existing users', async () => {
    (usersService.findByEmail as jest.Mock).mockResolvedValue(user);
    (verificationRepository.invalidateActiveForUser as jest.Mock).mockResolvedValue(0);
    (verificationRepository.create as jest.Mock).mockResolvedValue({ id: 'challenge-1' });

    await service.sendVerification('ada@example.com', {});

    expect(verificationRepository.invalidateActiveForUser).toHaveBeenCalledWith(
      user.id,
      IdentityVerificationType.EMAIL,
    );
    expect(verificationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        type: IdentityVerificationType.EMAIL,
        tokenHash: expect.any(String),
      }),
    );
    expect(notificationService.sendEmailVerification).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ada@example.com' }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      AUTH_AUDIT_ACTIONS.EMAIL_SENT,
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('verifies a valid signed token successfully', async () => {
    const token = signToken();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    (verificationRepository.findByTokenHash as jest.Mock).mockResolvedValue({
      id: 'challenge-1',
      userId: user.id,
      type: IdentityVerificationType.EMAIL,
      tokenHash,
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      attemptCount: 0,
    });
    (usersService.findById as jest.Mock).mockResolvedValue(user);
    (verificationRepository.markConsumed as jest.Mock).mockResolvedValue({});
    (usersService.markEmailVerified as jest.Mock).mockResolvedValue({
      ...user,
      emailVerifiedAt: new Date('2026-07-21T12:00:00.000Z'),
    });
    (usersService.activateIfVerificationsComplete as jest.Mock).mockResolvedValue({
      ...user,
      status: UserStatus.ACTIVE,
      email: 'ada@example.com',
    });

    const result = await service.verify('ada@example.com', token, {});

    expect(result.verified).toBe(true);
    expect(result.status).toBe(UserStatus.ACTIVE);
    expect(auditService.record).toHaveBeenCalledWith(
      AUTH_AUDIT_ACTIONS.EMAIL_VERIFIED,
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('rejects invalid tokens', async () => {
    await expect(service.verify('ada@example.com', 'not-a-valid-token', {})).rejects.toBeInstanceOf(
      UnauthorizedDomainException,
    );
    expect(auditService.record).toHaveBeenCalledWith(
      AUTH_AUDIT_ACTIONS.EMAIL_VERIFICATION_FAILED,
      expect.any(Object),
      expect.objectContaining({ metadata: { reason: 'invalid_token' } }),
    );
  });

  it('rejects expired tokens', async () => {
    const token = signToken();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    (verificationRepository.findByTokenHash as jest.Mock).mockResolvedValue({
      id: 'challenge-1',
      userId: user.id,
      type: IdentityVerificationType.EMAIL,
      tokenHash,
      consumedAt: null,
      expiresAt: new Date(Date.now() - 1_000),
      attemptCount: 0,
    });

    await expect(service.verify('ada@example.com', token, {})).rejects.toBeInstanceOf(
      UnauthorizedDomainException,
    );
    expect(auditService.record).toHaveBeenCalledWith(
      AUTH_AUDIT_ACTIONS.VERIFICATION_EXPIRED,
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('rejects reused tokens', async () => {
    const token = signToken();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    (verificationRepository.findByTokenHash as jest.Mock).mockResolvedValue({
      id: 'challenge-1',
      userId: user.id,
      type: IdentityVerificationType.EMAIL,
      tokenHash,
      consumedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      attemptCount: 0,
    });

    await expect(service.verify('ada@example.com', token, {})).rejects.toBeInstanceOf(
      UnauthorizedDomainException,
    );
    expect(auditService.record).toHaveBeenCalledWith(
      AUTH_AUDIT_ACTIONS.EMAIL_VERIFICATION_FAILED,
      expect.any(Object),
      expect.objectContaining({ metadata: { reason: 'token_reused' } }),
    );
  });

  it('invalidates previous challenge on resend', async () => {
    (usersService.findByEmail as jest.Mock).mockResolvedValue(user);
    (verificationRepository.invalidateActiveForUser as jest.Mock).mockResolvedValue(1);
    (verificationRepository.create as jest.Mock).mockResolvedValue({ id: 'challenge-2' });

    await service.resendVerification('ada@example.com', {});

    expect(verificationRepository.invalidateActiveForUser).toHaveBeenCalled();
    expect(redis.setNx).toHaveBeenCalled();
  });

  it('rate limits email verification sends', async () => {
    (redis.incr as jest.Mock).mockResolvedValue(6);
    (redis.ttl as jest.Mock).mockResolvedValue(100);

    await expect(service.sendVerification('ada@example.com', {})).rejects.toBeInstanceOf(
      RateLimitedDomainException,
    );
  });
});
