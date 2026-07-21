import { createHash, randomInt } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

import { AUTH_AUDIT_ACTIONS } from '../../audit/audit.constants';
import { AuditService } from '../../audit/audit.service';
import {
  OtpAttemptsExceededDomainException,
  OtpExpiredDomainException,
  OtpInvalidDomainException,
  RateLimitedDomainException,
} from '../../common/exceptions/domain.exception';
import { AppConfigService } from '../../config/app-config.service';
import { RedisService } from '../../redis/redis.service';

import type { AuditContext } from '../../audit/audit.service';
import type { OtpPurpose } from '../auth-registration.types';

function withUserId(context: AuditContext, userId?: string): AuditContext {
  if (userId === undefined) {
    return context;
  }
  return { ...context, userId };
}

export interface OtpDispatchResult {
  expiresInSeconds: number;
  channel: 'email' | 'sms';
}

@Injectable()
export class OtpService {
  constructor(
    private readonly redis: RedisService,
    private readonly appConfig: AppConfigService,
    private readonly auditService: AuditService,
    private readonly logger: Logger,
  ) {}

  public async generateAndStore(
    purpose: OtpPurpose,
    identifier: string,
    context: AuditContext,
    userId?: string,
  ): Promise<OtpDispatchResult> {
    const normalizedIdentifier = this.normalizeIdentifier(purpose, identifier);
    await this.enforceResendPolicy(purpose, normalizedIdentifier);

    const otp = this.generateOtp(this.appConfig.otpLength);
    const otpHash = this.hashOtp(otp);
    const otpKey = this.otpStorageKey(purpose, normalizedIdentifier);
    const ttlSeconds = this.ttlForPurpose(purpose);

    await this.redis.set(otpKey, otpHash, ttlSeconds);
    await this.redis.del(this.attemptsKey(otpKey));
    await this.redis.del(this.lockoutKey(otpKey));

    if (!this.appConfig.isProduction) {
      this.logger.debug(
        { purpose, identifier: normalizedIdentifier, otp },
        'OTP generated for development',
      );
    } else {
      this.logger.log({ purpose, identifier: normalizedIdentifier }, 'OTP generated');
    }

    await this.auditService.record(AUTH_AUDIT_ACTIONS.OTP_SENT, withUserId(context, userId), {
      resource: 'otp',
      metadata: { purpose, channel: this.channelForPurpose(purpose) } as Record<string, string>,
    });

    return {
      expiresInSeconds: ttlSeconds,
      channel: this.channelForPurpose(purpose),
    };
  }

  public async verify(
    purpose: OtpPurpose,
    identifier: string,
    otp: string,
    context: AuditContext,
    userId?: string,
  ): Promise<void> {
    const normalizedIdentifier = this.normalizeIdentifier(purpose, identifier);
    const otpKey = this.otpStorageKey(purpose, normalizedIdentifier);
    await this.enforceAttemptPolicy(otpKey);

    const storedHash = await this.redis.get(otpKey);
    if (!storedHash) {
      await this.auditService.record(AUTH_AUDIT_ACTIONS.OTP_FAILED, withUserId(context, userId), {
        resource: 'otp',
        metadata: { purpose, reason: 'expired' },
      });
      throw new OtpExpiredDomainException();
    }

    const providedHash = this.hashOtp(otp);
    if (providedHash !== storedHash) {
      const attemptsExceeded = await this.recordFailedAttempt(otpKey, purpose, context, userId);
      if (attemptsExceeded) {
        throw new OtpAttemptsExceededDomainException();
      }
      throw new OtpInvalidDomainException();
    }

    await this.redis.del(otpKey);
    await this.redis.del(this.attemptsKey(otpKey));
    await this.redis.del(this.lockoutKey(otpKey));

    await this.auditService.record(AUTH_AUDIT_ACTIONS.OTP_VERIFIED, withUserId(context, userId), {
      resource: 'otp',
      metadata: { purpose } satisfies Record<string, string>,
    });
  }

  public hashOtp(otp: string): string {
    return createHash('sha256').update(otp).digest('hex');
  }

  public otpStorageKey(purpose: OtpPurpose, identifier: string): string {
    switch (purpose) {
      case 'email_verification':
        return `auth:otp:email:${identifier}`;
      case 'phone_verification':
        return `auth:otp:phone:${identifier}`;
      case 'password_reset':
        return `auth:otp:reset:${identifier}`;
      case 'login_step_up':
        return `auth:otp:stepup:${identifier}`;
    }
  }

  private async enforceResendPolicy(purpose: OtpPurpose, identifier: string): Promise<void> {
    const purposeKey = this.purposeKeySegment(purpose);
    const cooldownKey = `auth:otp:cooldown:${purposeKey}:${identifier}`;
    const cooldownActive = await this.redis.setNx(
      cooldownKey,
      '1',
      this.appConfig.otpResendCooldownSeconds,
    );
    if (!cooldownActive) {
      const retryAfter = Math.max(await this.redis.ttl(cooldownKey), 1);
      throw new RateLimitedDomainException('OTP resend cooldown active', retryAfter);
    }

    const hourlyKey = `auth:otp:hourly:${purposeKey}:${identifier}`;
    const hourlyCount = await this.redis.incr(hourlyKey);
    if (hourlyCount === 1) {
      await this.redis.expire(hourlyKey, 3600);
    }
    if (hourlyCount > this.appConfig.otpHourlyLimit) {
      const retryAfter = Math.max(await this.redis.ttl(hourlyKey), 1);
      throw new RateLimitedDomainException('OTP hourly limit exceeded', retryAfter);
    }

    const dailyKey = `auth:otp:daily:${purposeKey}:${identifier}`;
    const dailyCount = await this.redis.incr(dailyKey);
    if (dailyCount === 1) {
      await this.redis.expire(dailyKey, 86_400);
    }
    if (dailyCount > this.appConfig.otpDailyLimit) {
      const retryAfter = Math.max(await this.redis.ttl(dailyKey), 1);
      throw new RateLimitedDomainException('OTP daily limit exceeded', retryAfter);
    }
  }

  private async enforceAttemptPolicy(otpKey: string): Promise<void> {
    const lockoutKey = this.lockoutKey(otpKey);
    const locked = await this.redis.get(lockoutKey);
    if (locked) {
      const retryAfter = Math.max(await this.redis.ttl(lockoutKey), 1);
      throw new OtpAttemptsExceededDomainException('OTP verification locked', retryAfter);
    }
  }

  private async recordFailedAttempt(
    otpKey: string,
    purpose: OtpPurpose,
    context: AuditContext,
    userId?: string,
  ): Promise<boolean> {
    const attemptsKey = this.attemptsKey(otpKey);
    const attempts = await this.redis.incr(attemptsKey);
    if (attempts === 1) {
      await this.redis.expire(attemptsKey, this.ttlForPurpose(purpose));
    }

    await this.auditService.record(AUTH_AUDIT_ACTIONS.OTP_FAILED, withUserId(context, userId), {
      resource: 'otp',
      metadata: { purpose, attempts } satisfies Record<string, string | number>,
    });

    if (attempts >= this.appConfig.otpMaxVerifyAttempts) {
      await this.redis.set(this.lockoutKey(otpKey), '1', this.appConfig.otpLockoutSeconds);
      return true;
    }

    return false;
  }

  private generateOtp(length: number): string {
    const max = 10 ** length;
    const value = randomInt(0, max);
    return value.toString().padStart(length, '0');
  }

  private ttlForPurpose(purpose: OtpPurpose): number {
    switch (purpose) {
      case 'email_verification':
      case 'password_reset':
        return this.appConfig.otpEmailTtlSeconds;
      case 'phone_verification':
      case 'login_step_up':
        return this.appConfig.otpSmsTtlSeconds;
    }
  }

  private channelForPurpose(purpose: OtpPurpose): 'email' | 'sms' {
    return purpose === 'phone_verification' || purpose === 'login_step_up' ? 'sms' : 'email';
  }

  private normalizeIdentifier(purpose: OtpPurpose, identifier: string): string {
    if (purpose === 'phone_verification') {
      return identifier.trim();
    }
    return identifier.trim().toLowerCase();
  }

  private purposeKeySegment(purpose: OtpPurpose): string {
    switch (purpose) {
      case 'email_verification':
        return 'email_verification';
      case 'phone_verification':
        return 'phone_verification';
      case 'password_reset':
        return 'password_reset';
      case 'login_step_up':
        return 'login_step_up';
    }
  }

  private attemptsKey(otpKey: string): string {
    return `auth:otp:attempts:${otpKey}`;
  }

  private lockoutKey(otpKey: string): string {
    return `auth:otp:lockout:${otpKey}`;
  }
}
