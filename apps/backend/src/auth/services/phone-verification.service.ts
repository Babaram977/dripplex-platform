import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { IdentityVerificationType, RegistrationChannel } from '@prisma/client';

import { AUTH_AUDIT_ACTIONS } from '../../audit/audit.constants';
import { AuditService } from '../../audit/audit.service';
import {
  RateLimitedDomainException,
  UnauthorizedDomainException,
} from '../../common/exceptions/domain.exception';
import { AppConfigService } from '../../config/app-config.service';
import {
  NOTIFICATION_SERVICE,
  type NotificationService,
} from '../../notifications/notification.service';
import { RedisService } from '../../redis/redis.service';
import { UsersService } from '../../users/users.service';
import {
  IDENTITY_VERIFICATION_REPOSITORY,
  type IdentityVerificationRepository,
} from '../repositories/identity-verification.repository';

import type { AuditContext } from '../../audit/audit.service';
import type { PhoneVerificationResponse } from '../auth-registration.types';

const PHONE_VERIFICATION_CHANNELS = new Set<RegistrationChannel>([
  RegistrationChannel.MERCHANT_PORTAL,
  RegistrationChannel.RIDER_PORTAL,
  RegistrationChannel.DRIVER_PORTAL,
]);

@Injectable()
export class PhoneVerificationService {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
    private readonly appConfig: AppConfigService,
    private readonly redis: RedisService,
    @Inject(IDENTITY_VERIFICATION_REPOSITORY)
    private readonly verificationRepository: IdentityVerificationRepository,
    @Inject(NOTIFICATION_SERVICE)
    private readonly notificationService: NotificationService,
  ) {}

  public async sendOtp(phone: string, context: AuditContext): Promise<{ submitted: true }> {
    return await this.dispatch(phone, context, false);
  }

  public async resendOtp(phone: string, context: AuditContext): Promise<{ submitted: true }> {
    return await this.dispatch(phone, context, true);
  }

  public async verify(
    phone: string,
    otp: string,
    context: AuditContext,
  ): Promise<PhoneVerificationResponse> {
    const normalizedPhone = phone.trim();
    const user = await this.usersService.findByPhone(normalizedPhone);

    // Anti-enumeration: identical failure for unknown phones
    if (!user || user.deletedAt || !user.phone) {
      await this.auditService.record(AUTH_AUDIT_ACTIONS.PHONE_VERIFICATION_FAILED, context, {
        metadata: { reason: 'invalid_otp' },
      });
      throw new UnauthorizedDomainException('Invalid or expired OTP');
    }

    const lockKey = this.lockoutKey(normalizedPhone);
    const locked = await this.redis.get(lockKey);
    if (locked) {
      const retryAfter = Math.max(await this.redis.ttl(lockKey), 1);
      throw new RateLimitedDomainException('OTP verification locked', retryAfter);
    }

    const challenge = await this.verificationRepository.findActiveByUserAndType(
      user.id,
      IdentityVerificationType.PHONE,
    );

    if (!challenge?.otpHash) {
      await this.auditService.record(
        AUTH_AUDIT_ACTIONS.PHONE_VERIFICATION_FAILED,
        { ...context, userId: user.id },
        { metadata: { reason: 'no_active_challenge' } },
      );
      throw new UnauthorizedDomainException('Invalid or expired OTP');
    }

    if (challenge.expiresAt.getTime() <= Date.now()) {
      await this.verificationRepository.markConsumed(challenge.id);
      await this.auditService.record(
        AUTH_AUDIT_ACTIONS.VERIFICATION_EXPIRED,
        { ...context, userId: user.id },
        {
          resource: 'identity_verification',
          resourceId: challenge.id,
          metadata: { type: 'PHONE' },
        },
      );
      await this.auditService.record(
        AUTH_AUDIT_ACTIONS.PHONE_VERIFICATION_FAILED,
        { ...context, userId: user.id },
        {
          resource: 'identity_verification',
          resourceId: challenge.id,
          metadata: { reason: 'otp_expired' },
        },
      );
      throw new UnauthorizedDomainException('Invalid or expired OTP');
    }

    if (challenge.attemptCount >= this.appConfig.identityVerificationMaxAttempts) {
      await this.redis.set(lockKey, '1', this.appConfig.identityVerificationLockoutSeconds);
      await this.auditService.record(
        AUTH_AUDIT_ACTIONS.PHONE_VERIFICATION_FAILED,
        { ...context, userId: user.id },
        {
          resource: 'identity_verification',
          resourceId: challenge.id,
          metadata: { reason: 'attempts_exceeded' },
        },
      );
      throw new RateLimitedDomainException(
        'OTP verification attempts exceeded',
        this.appConfig.identityVerificationLockoutSeconds,
      );
    }

    const updatedChallenge = await this.verificationRepository.incrementAttemptCount(challenge.id);
    const otpMatches = this.otpHashesMatch(challenge.otpHash, otp);

    if (!otpMatches) {
      if (updatedChallenge.attemptCount >= this.appConfig.identityVerificationMaxAttempts) {
        await this.redis.set(lockKey, '1', this.appConfig.identityVerificationLockoutSeconds);
      }
      await this.auditService.record(
        AUTH_AUDIT_ACTIONS.PHONE_VERIFICATION_FAILED,
        { ...context, userId: user.id },
        {
          resource: 'identity_verification',
          resourceId: challenge.id,
          metadata: { reason: 'invalid_otp', attempts: updatedChallenge.attemptCount },
        },
      );
      throw new UnauthorizedDomainException('Invalid or expired OTP');
    }

    // Reused OTP: already consumed elsewhere (shouldn't happen for active lookup)
    if (challenge.consumedAt) {
      await this.auditService.record(
        AUTH_AUDIT_ACTIONS.PHONE_VERIFICATION_FAILED,
        { ...context, userId: user.id },
        {
          resource: 'identity_verification',
          resourceId: challenge.id,
          metadata: { reason: 'otp_reused' },
        },
      );
      throw new UnauthorizedDomainException('Invalid or expired OTP');
    }

    await this.verificationRepository.markConsumed(challenge.id);
    await this.redis.del(lockKey);

    const updated = await this.usersService.markPhoneVerified(user.id);
    const activated = await this.usersService.activateIfVerificationsComplete(
      user.id,
      this.requiresPhoneVerification(user.registrationChannel),
    );

    await this.auditService.record(
      AUTH_AUDIT_ACTIONS.PHONE_VERIFIED,
      { ...context, userId: user.id },
      { resource: 'user', resourceId: user.id },
    );

    return {
      verified: true,
      phone: activated.phone ?? normalizedPhone,
      status: activated.status,
      phoneVerifiedAt: (updated.phoneVerifiedAt ?? new Date()).toISOString(),
    };
  }

  private async dispatch(
    phone: string,
    context: AuditContext,
    isResend: boolean,
  ): Promise<{ submitted: true }> {
    const normalizedPhone = phone.trim();
    await this.enforceHourlyLimit(normalizedPhone);
    if (isResend) {
      await this.enforceResendCooldown(normalizedPhone);
    }

    const user = await this.usersService.findByPhone(normalizedPhone);
    if (user && !user.deletedAt && user.phone) {
      await this.verificationRepository.invalidateActiveForUser(
        user.id,
        IdentityVerificationType.PHONE,
      );

      const otp = this.generateOtp(6);
      const otpHash = this.hashOtp(otp);
      const expiresAt = new Date(Date.now() + this.appConfig.phoneOtpTtlSeconds * 1000);

      await this.verificationRepository.create({
        userId: user.id,
        type: IdentityVerificationType.PHONE,
        otpHash,
        expiresAt,
      });

      await this.notificationService.sendPhoneOtp({
        phone: normalizedPhone,
        otp,
        expiresInSeconds: this.appConfig.phoneOtpTtlSeconds,
      });

      await this.auditService.record(
        AUTH_AUDIT_ACTIONS.PHONE_OTP_SENT,
        { ...context, userId: user.id },
        {
          resource: 'user',
          resourceId: user.id,
          metadata: { channel: 'sms', resend: isResend },
        },
      );
    }

    return { submitted: true };
  }

  private generateOtp(length: number): string {
    const max = 10 ** length;
    const value = randomInt(0, max);
    return value.toString().padStart(length, '0');
  }

  private hashOtp(otp: string): string {
    return createHash('sha256').update(otp).digest('hex');
  }

  private otpHashesMatch(storedHash: string, presentedOtp: string): boolean {
    const presentedHash = this.hashOtp(presentedOtp);
    const storedBuffer = Buffer.from(storedHash, 'hex');
    const presentedBuffer = Buffer.from(presentedHash, 'hex');
    if (storedBuffer.length !== presentedBuffer.length) {
      return false;
    }
    return timingSafeEqual(storedBuffer, presentedBuffer);
  }

  private async enforceHourlyLimit(phone: string): Promise<void> {
    const key = `auth:phone:otp:hourly:${phone}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, 3600);
    }
    if (count > this.appConfig.phoneOtpMaxPerHour) {
      const retryAfter = Math.max(await this.redis.ttl(key), 1);
      throw new RateLimitedDomainException('Phone OTP rate limit exceeded', retryAfter);
    }
  }

  private async enforceResendCooldown(phone: string): Promise<void> {
    const key = `auth:phone:otp:cooldown:${phone}`;
    const acquired = await this.redis.setNx(
      key,
      '1',
      this.appConfig.identityVerificationResendCooldownSeconds,
    );
    if (!acquired) {
      const retryAfter = Math.max(await this.redis.ttl(key), 1);
      throw new RateLimitedDomainException('Phone OTP resend cooldown active', retryAfter);
    }
  }

  private lockoutKey(phone: string): string {
    return `auth:phone:otp:lockout:${phone}`;
  }

  private requiresPhoneVerification(channel: RegistrationChannel | null): boolean {
    if (!channel) {
      return false;
    }
    return PHONE_VERIFICATION_CHANNELS.has(channel);
  }
}
