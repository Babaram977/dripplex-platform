import { createHash } from 'node:crypto';

import { IdentityVerificationType, UserStatus } from '@prisma/client';

import { AUTH_AUDIT_ACTIONS } from '../../audit/audit.constants';
import {
  RateLimitedDomainException,
  UnauthorizedDomainException,
} from '../../common/exceptions/domain.exception';

import { PhoneVerificationService } from './phone-verification.service';

import type { AuditService } from '../../audit/audit.service';
import type { AppConfigService } from '../../config/app-config.service';
import type { NotificationService } from '../../notifications/notification.service';
import type { RedisService } from '../../redis/redis.service';
import type { UsersService } from '../../users/users.service';
import type { IdentityVerificationRepository } from '../repositories/identity-verification.repository';

describe('PhoneVerificationService', () => {
  const usersService = {
    findByPhone: jest.fn(),
    markPhoneVerified: jest.fn(),
    activateIfVerificationsComplete: jest.fn(),
  } as unknown as jest.Mocked<UsersService>;

  const auditService = { record: jest.fn() } as unknown as jest.Mocked<AuditService>;

  const appConfig = {
    phoneOtpTtlSeconds: 300,
    phoneOtpMaxPerHour: 5,
    identityVerificationMaxAttempts: 10,
    identityVerificationLockoutSeconds: 1800,
    identityVerificationResendCooldownSeconds: 60,
  } as unknown as AppConfigService;

  const redis = {
    incr: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    setNx: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  } as unknown as jest.Mocked<RedisService>;

  const verificationRepository = {
    invalidateActiveForUser: jest.fn(),
    create: jest.fn(),
    findActiveByUserAndType: jest.fn(),
    markConsumed: jest.fn(),
    incrementAttemptCount: jest.fn(),
  } as unknown as jest.Mocked<IdentityVerificationRepository>;

  const notificationService = {
    sendPhoneOtp: jest.fn(),
  } as unknown as jest.Mocked<NotificationService>;

  const service = new PhoneVerificationService(
    usersService,
    auditService,
    appConfig,
    redis,
    verificationRepository,
    notificationService,
  );

  const user = {
    id: '11111111-1111-1111-1111-111111111111',
    phone: '+2348012345678',
    email: 'ada@example.com',
    status: UserStatus.PENDING_VERIFICATION,
    registrationChannel: null,
    deletedAt: null,
  };

  const otp = '123456';
  const otpHash = createHash('sha256').update(otp).digest('hex');

  beforeEach(() => {
    jest.clearAllMocks();
    (redis.incr as jest.Mock).mockResolvedValue(1);
    (redis.expire as jest.Mock).mockResolvedValue(undefined);
    (redis.setNx as jest.Mock).mockResolvedValue(true);
    (redis.get as jest.Mock).mockResolvedValue(null);
    (auditService.record as jest.Mock).mockResolvedValue(undefined);
    (notificationService.sendPhoneOtp as jest.Mock).mockResolvedValue(undefined);
  });

  it('always returns submitted for send-otp (anti-enumeration)', async () => {
    (usersService.findByPhone as jest.Mock).mockResolvedValue(null);

    await expect(service.sendOtp('+2348099999999', {})).resolves.toEqual({ submitted: true });
    expect(verificationRepository.create).not.toHaveBeenCalled();
  });

  it('stores hashed OTP and notifies for existing users', async () => {
    (usersService.findByPhone as jest.Mock).mockResolvedValue(user);
    (verificationRepository.invalidateActiveForUser as jest.Mock).mockResolvedValue(0);
    (verificationRepository.create as jest.Mock).mockResolvedValue({ id: 'otp-1' });

    await service.sendOtp('+2348012345678', {});

    expect(verificationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        type: IdentityVerificationType.PHONE,
        otpHash: expect.any(String),
      }),
    );
    expect(notificationService.sendPhoneOtp).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '+2348012345678', otp: expect.stringMatching(/^\d{6}$/) }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      AUTH_AUDIT_ACTIONS.PHONE_OTP_SENT,
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('verifies a valid OTP successfully', async () => {
    (usersService.findByPhone as jest.Mock).mockResolvedValue(user);
    (verificationRepository.findActiveByUserAndType as jest.Mock).mockResolvedValue({
      id: 'otp-1',
      userId: user.id,
      type: IdentityVerificationType.PHONE,
      otpHash,
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      attemptCount: 0,
    });
    (verificationRepository.incrementAttemptCount as jest.Mock).mockResolvedValue({
      attemptCount: 1,
    });
    (verificationRepository.markConsumed as jest.Mock).mockResolvedValue({});
    (usersService.markPhoneVerified as jest.Mock).mockResolvedValue({
      ...user,
      phoneVerifiedAt: new Date('2026-07-21T12:00:00.000Z'),
    });
    (usersService.activateIfVerificationsComplete as jest.Mock).mockResolvedValue({
      ...user,
      status: UserStatus.ACTIVE,
      phone: user.phone,
    });

    const result = await service.verify('+2348012345678', otp, {});

    expect(result.verified).toBe(true);
    expect(auditService.record).toHaveBeenCalledWith(
      AUTH_AUDIT_ACTIONS.PHONE_VERIFIED,
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('rejects invalid OTP', async () => {
    (usersService.findByPhone as jest.Mock).mockResolvedValue(user);
    (verificationRepository.findActiveByUserAndType as jest.Mock).mockResolvedValue({
      id: 'otp-1',
      userId: user.id,
      otpHash,
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      attemptCount: 0,
    });
    (verificationRepository.incrementAttemptCount as jest.Mock).mockResolvedValue({
      attemptCount: 1,
    });

    await expect(service.verify('+2348012345678', '000000', {})).rejects.toBeInstanceOf(
      UnauthorizedDomainException,
    );
    expect(auditService.record).toHaveBeenCalledWith(
      AUTH_AUDIT_ACTIONS.PHONE_VERIFICATION_FAILED,
      expect.any(Object),
      expect.objectContaining({
        metadata: expect.objectContaining({ reason: 'invalid_otp' }),
      }),
    );
  });

  it('rejects expired OTP', async () => {
    (usersService.findByPhone as jest.Mock).mockResolvedValue(user);
    (verificationRepository.findActiveByUserAndType as jest.Mock).mockResolvedValue({
      id: 'otp-1',
      userId: user.id,
      otpHash,
      consumedAt: null,
      expiresAt: new Date(Date.now() - 1_000),
      attemptCount: 0,
    });

    await expect(service.verify('+2348012345678', otp, {})).rejects.toBeInstanceOf(
      UnauthorizedDomainException,
    );
    expect(auditService.record).toHaveBeenCalledWith(
      AUTH_AUDIT_ACTIONS.VERIFICATION_EXPIRED,
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('enforces retry limits', async () => {
    (usersService.findByPhone as jest.Mock).mockResolvedValue(user);
    (verificationRepository.findActiveByUserAndType as jest.Mock).mockResolvedValue({
      id: 'otp-1',
      userId: user.id,
      otpHash,
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      attemptCount: 10,
    });

    await expect(service.verify('+2348012345678', otp, {})).rejects.toBeInstanceOf(
      RateLimitedDomainException,
    );
  });

  it('invalidates previous OTP on resend', async () => {
    (usersService.findByPhone as jest.Mock).mockResolvedValue(user);
    (verificationRepository.invalidateActiveForUser as jest.Mock).mockResolvedValue(1);
    (verificationRepository.create as jest.Mock).mockResolvedValue({ id: 'otp-2' });

    await service.resendOtp('+2348012345678', {});

    expect(verificationRepository.invalidateActiveForUser).toHaveBeenCalledWith(
      user.id,
      IdentityVerificationType.PHONE,
    );
    expect(redis.setNx).toHaveBeenCalled();
  });

  it('rate limits phone OTP sends', async () => {
    (redis.incr as jest.Mock).mockResolvedValue(6);
    (redis.ttl as jest.Mock).mockResolvedValue(50);

    await expect(service.sendOtp('+2348012345678', {})).rejects.toBeInstanceOf(
      RateLimitedDomainException,
    );
  });

  it('rejects verification for unknown phone without revealing existence', async () => {
    (usersService.findByPhone as jest.Mock).mockResolvedValue(null);

    await expect(service.verify('+2348099999999', otp, {})).rejects.toBeInstanceOf(
      UnauthorizedDomainException,
    );
  });
});
