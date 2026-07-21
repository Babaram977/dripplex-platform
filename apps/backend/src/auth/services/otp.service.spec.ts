import { createHash } from 'node:crypto';

import { AUTH_AUDIT_ACTIONS } from '../../audit/audit.constants';
import {
  OtpAttemptsExceededDomainException,
  OtpExpiredDomainException,
  OtpInvalidDomainException,
  RateLimitedDomainException,
} from '../../common/exceptions/domain.exception';

import { OtpService } from './otp.service';

import type { AuditService } from '../../audit/audit.service';
import type { AppConfigService } from '../../config/app-config.service';
import type { RedisService } from '../../redis/redis.service';
import type { Logger } from 'nestjs-pino';

describe('OtpService', () => {
  const redis = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    setNx: jest.fn(),
  } as unknown as jest.Mocked<RedisService>;

  const appConfig = {
    otpLength: 6,
    otpEmailTtlSeconds: 600,
    otpSmsTtlSeconds: 300,
    otpResetTtlSeconds: 900,
    otpMaxVerifyAttempts: 5,
    otpLockoutSeconds: 900,
    otpResendCooldownSeconds: 60,
    otpHourlyLimit: 5,
    otpDailyLimit: 10,
    isProduction: false,
  } as unknown as AppConfigService;

  const auditService = {
    record: jest.fn(),
  } as unknown as jest.Mocked<AuditService>;

  const logger = {
    debug: jest.fn(),
    log: jest.fn(),
  } as unknown as Logger;

  const service = new OtpService(redis, appConfig, auditService, logger);

  beforeEach(() => {
    jest.clearAllMocks();
    (redis.setNx as jest.Mock).mockResolvedValue(true);
    (redis.incr as jest.Mock).mockResolvedValue(1);
    (redis.expire as jest.Mock).mockResolvedValue(undefined);
    (redis.set as jest.Mock).mockResolvedValue(undefined);
    (redis.del as jest.Mock).mockResolvedValue(undefined);
    (redis.get as jest.Mock).mockResolvedValue(null);
    (redis.ttl as jest.Mock).mockResolvedValue(30);
    (auditService.record as jest.Mock).mockResolvedValue(undefined);
  });

  it('generates and stores hashed OTP with audit event', async () => {
    const result = await service.generateAndStore(
      'email_verification',
      'ada@example.com',
      { ipAddress: '127.0.0.1' },
      'user-id',
    );

    expect(result.expiresInSeconds).toBe(600);
    expect(result.channel).toBe('email');
    expect(redis.set).toHaveBeenCalledWith(
      'auth:otp:email:ada@example.com',
      expect.any(String),
      600,
    );
    expect(auditService.record).toHaveBeenCalledWith(
      AUTH_AUDIT_ACTIONS.OTP_SENT,
      expect.objectContaining({ userId: 'user-id' }),
      expect.any(Object),
    );
  });

  it('enforces resend cooldown', async () => {
    (redis.setNx as jest.Mock).mockResolvedValue(false);
    (redis.ttl as jest.Mock).mockResolvedValue(45);

    await expect(
      service.generateAndStore('email_verification', 'ada@example.com', {}),
    ).rejects.toBeInstanceOf(RateLimitedDomainException);
  });

  it('verifies a valid OTP', async () => {
    const otp = '123456';
    const hash = createHash('sha256').update(otp).digest('hex');
    (redis.get as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce(hash);

    await service.verify('email_verification', 'ada@example.com', otp, {}, 'user-id');

    expect(redis.del).toHaveBeenCalledWith('auth:otp:email:ada@example.com');
    expect(auditService.record).toHaveBeenCalledWith(
      AUTH_AUDIT_ACTIONS.OTP_VERIFIED,
      expect.objectContaining({ userId: 'user-id' }),
      expect.any(Object),
    );
  });

  it('rejects expired OTP', async () => {
    (redis.get as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await expect(
      service.verify('email_verification', 'ada@example.com', '123456', {}),
    ).rejects.toBeInstanceOf(OtpExpiredDomainException);
  });

  it('rejects invalid OTP and records failure audit', async () => {
    (redis.get as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce('stored-hash');
    (redis.incr as jest.Mock).mockResolvedValue(1);

    await expect(
      service.verify('email_verification', 'ada@example.com', '123456', {}),
    ).rejects.toBeInstanceOf(OtpInvalidDomainException);

    expect(auditService.record).toHaveBeenCalledWith(
      AUTH_AUDIT_ACTIONS.OTP_FAILED,
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('locks out after maximum attempts', async () => {
    (redis.get as jest.Mock).mockResolvedValueOnce(null).mockResolvedValueOnce('stored-hash');
    (redis.incr as jest.Mock).mockResolvedValue(5);

    await expect(
      service.verify('email_verification', 'ada@example.com', '123456', {}),
    ).rejects.toBeInstanceOf(OtpAttemptsExceededDomainException);
  });
});
