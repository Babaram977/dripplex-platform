import { createHash } from 'node:crypto';

import { UserStatus } from '@prisma/client';

import { AUTH_AUDIT_ACTIONS } from '../../audit/audit.constants';
import {
  ConflictDomainException,
  RateLimitedDomainException,
  UnauthorizedDomainException,
  ValidationDomainException,
} from '../../common/exceptions/domain.exception';

import { ProfileService } from './profile.service';

import type { AuditService } from '../../audit/audit.service';
import type { AppConfigService } from '../../config/app-config.service';
import type { NotificationService } from '../../notifications/notification.service';
import type { RedisService } from '../../redis/redis.service';
import type { UsersService } from '../../users/users.service';
import type { AuthService } from '../auth.service';
import type { AuthUserProfile } from '../auth.types';

describe('ProfileService', () => {
  const usersService = {
    getByIdOrThrow: jest.fn(),
    findByPhone: jest.fn(),
    findByEmail: jest.fn(),
    updateProfile: jest.fn(),
    updatePhone: jest.fn(),
    updateEmail: jest.fn(),
  } as unknown as jest.Mocked<UsersService>;

  const profile: AuthUserProfile = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'ada@example.com',
    phone: '+2348012345678',
    firstName: 'Ada',
    lastName: 'Lovelace',
    profilePhotoUrl: null,
    dateOfBirth: null,
    gender: null,
    status: UserStatus.ACTIVE,
    roles: [],
    permissions: [],
  };

  const authService = {
    getProfile: jest.fn(),
  } as unknown as jest.Mocked<AuthService>;

  const auditService = { record: jest.fn() } as unknown as jest.Mocked<AuditService>;

  const appConfig = {
    phoneOtpTtlSeconds: 300,
    phoneOtpMaxPerHour: 5,
    emailVerificationTtlSeconds: 900,
    emailVerificationMaxPerHour: 5,
    otpLength: 6,
    identityVerificationMaxAttempts: 5,
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

  const notificationService = {
    sendPhoneOtp: jest.fn(),
    sendEmailOtp: jest.fn(),
  } as unknown as jest.Mocked<NotificationService>;

  const service = new ProfileService(
    usersService,
    authService,
    auditService,
    appConfig,
    redis,
    notificationService,
  );

  const user = {
    id: profile.id,
    email: profile.email,
    phone: profile.phone,
    deletedAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (redis.incr as jest.Mock).mockResolvedValue(1);
    (redis.expire as jest.Mock).mockResolvedValue(undefined);
    (redis.setNx as jest.Mock).mockResolvedValue(true);
    (redis.get as jest.Mock).mockResolvedValue(null);
    (redis.set as jest.Mock).mockResolvedValue(undefined);
    (redis.del as jest.Mock).mockResolvedValue(undefined);
    (auditService.record as jest.Mock).mockResolvedValue(undefined);
    (authService.getProfile as jest.Mock).mockResolvedValue(profile);
    (usersService.getByIdOrThrow as jest.Mock).mockResolvedValue(user);
  });

  describe('updateProfile', () => {
    it('updates allowed fields and records an audit entry', async () => {
      (usersService.updateProfile as jest.Mock).mockResolvedValue(user);

      const result = await service.updateProfile(profile.id, { firstName: 'Grace' }, {});

      expect(usersService.updateProfile).toHaveBeenCalledWith(profile.id, {
        firstName: 'Grace',
      });
      expect(auditService.record).toHaveBeenCalledWith(
        AUTH_AUDIT_ACTIONS.PROFILE_UPDATED,
        expect.any(Object),
        expect.objectContaining({ metadata: { fields: ['firstName'] } }),
      );
      expect(result).toBe(profile);
    });

    it('rejects a dateOfBirth outside the allowed age range', async () => {
      await expect(
        service.updateProfile(profile.id, { dateOfBirth: '2020-01-01' }, {}),
      ).rejects.toBeInstanceOf(ValidationDomainException);
      expect(usersService.updateProfile).not.toHaveBeenCalled();
    });

    it('is a no-op when no fields are provided', async () => {
      const result = await service.updateProfile(profile.id, {}, {});
      expect(usersService.updateProfile).not.toHaveBeenCalled();
      expect(result).toBe(profile);
    });
  });

  describe('phone change', () => {
    it('rejects requesting the same phone number', async () => {
      const currentPhone: string = user.phone ?? '';
      await expect(service.requestPhoneChange(profile.id, currentPhone, {})).rejects.toBeInstanceOf(
        ValidationDomainException,
      );
    });

    it('rejects a phone already used by another account', async () => {
      (usersService.findByPhone as jest.Mock).mockResolvedValue({ id: 'someone-else' });

      await expect(
        service.requestPhoneChange(profile.id, '+2348099999999', {}),
      ).rejects.toBeInstanceOf(ConflictDomainException);
    });

    it('sends an OTP to the new phone and records the request', async () => {
      (usersService.findByPhone as jest.Mock).mockResolvedValue(null);
      (notificationService.sendPhoneOtp as jest.Mock).mockResolvedValue(undefined);

      const result = await service.requestPhoneChange(profile.id, '+2348099999999', {});

      expect(result).toEqual({ expiresInSeconds: 300 });
      expect(notificationService.sendPhoneOtp).toHaveBeenCalledWith(
        expect.objectContaining({ phone: '+2348099999999', otp: expect.stringMatching(/^\d{6}$/) }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        AUTH_AUDIT_ACTIONS.PROFILE_PHONE_CHANGE_REQUESTED,
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('confirms with a valid OTP and applies the change', async () => {
      const otp = '654321';
      const otpHash = createHash('sha256').update(otp).digest('hex');
      (redis.get as jest.Mock).mockImplementation((key: string) =>
        key.includes('lockout')
          ? Promise.resolve(null)
          : Promise.resolve(JSON.stringify({ value: '+2348099999999', otpHash, attemptCount: 0 })),
      );
      (usersService.updatePhone as jest.Mock).mockResolvedValue(user);

      const result = await service.confirmPhoneChange(profile.id, otp, {});

      expect(usersService.updatePhone).toHaveBeenCalledWith(profile.id, '+2348099999999');
      expect(auditService.record).toHaveBeenCalledWith(
        AUTH_AUDIT_ACTIONS.PROFILE_PHONE_CHANGED,
        expect.any(Object),
        expect.any(Object),
      );
      expect(result).toBe(profile);
    });

    it('rejects an invalid OTP', async () => {
      const otpHash = createHash('sha256').update('111111').digest('hex');
      (redis.get as jest.Mock).mockImplementation((key: string) =>
        key.includes('lockout')
          ? Promise.resolve(null)
          : Promise.resolve(JSON.stringify({ value: '+2348099999999', otpHash, attemptCount: 0 })),
      );
      (redis.ttl as jest.Mock).mockResolvedValue(120);

      await expect(service.confirmPhoneChange(profile.id, '000000', {})).rejects.toBeInstanceOf(
        UnauthorizedDomainException,
      );
      expect(usersService.updatePhone).not.toHaveBeenCalled();
    });

    it('rejects when no pending change exists', async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);

      await expect(service.confirmPhoneChange(profile.id, '000000', {})).rejects.toBeInstanceOf(
        UnauthorizedDomainException,
      );
    });

    it('locks out after too many failed attempts', async () => {
      const otpHash = createHash('sha256').update('111111').digest('hex');
      (redis.get as jest.Mock).mockImplementation((key: string) =>
        key.includes('lockout')
          ? Promise.resolve(null)
          : Promise.resolve(JSON.stringify({ value: '+2348099999999', otpHash, attemptCount: 5 })),
      );

      await expect(service.confirmPhoneChange(profile.id, '000000', {})).rejects.toBeInstanceOf(
        RateLimitedDomainException,
      );
    });
  });

  describe('email change', () => {
    it('rejects an email already used by another account', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue({ id: 'someone-else' });

      await expect(
        service.requestEmailChange(profile.id, 'new@example.com', {}),
      ).rejects.toBeInstanceOf(ConflictDomainException);
    });

    it('sends an OTP to the new email and records the request', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(null);

      const result = await service.requestEmailChange(profile.id, 'new@example.com', {});

      expect(result).toEqual({ expiresInSeconds: 900 });
      expect(notificationService.sendEmailOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          otp: expect.stringMatching(/^\d{6}$/),
        }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        AUTH_AUDIT_ACTIONS.PROFILE_EMAIL_CHANGE_REQUESTED,
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('confirms with a valid OTP and applies the change', async () => {
      const otp = '111222';
      const otpHash = createHash('sha256').update(otp).digest('hex');
      (redis.get as jest.Mock).mockImplementation((key: string) =>
        key.includes('lockout')
          ? Promise.resolve(null)
          : Promise.resolve(JSON.stringify({ value: 'new@example.com', otpHash, attemptCount: 0 })),
      );
      (usersService.updateEmail as jest.Mock).mockResolvedValue(user);

      const result = await service.confirmEmailChange(profile.id, otp, {});

      expect(usersService.updateEmail).toHaveBeenCalledWith(profile.id, 'new@example.com');
      expect(auditService.record).toHaveBeenCalledWith(
        AUTH_AUDIT_ACTIONS.PROFILE_EMAIL_CHANGED,
        expect.any(Object),
        expect.any(Object),
      );
      expect(result).toBe(profile);
    });
  });
});
