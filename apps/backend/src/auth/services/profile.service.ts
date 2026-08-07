import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { AUTH_AUDIT_ACTIONS } from '../../audit/audit.constants';
import { AuditService } from '../../audit/audit.service';
import {
  ConflictDomainException,
  RateLimitedDomainException,
  UnauthorizedDomainException,
  ValidationDomainException,
} from '../../common/exceptions/domain.exception';
import { AppConfigService } from '../../config/app-config.service';
import {
  NOTIFICATION_SERVICE,
  type NotificationService,
} from '../../notifications/notification.service';
import { RedisService } from '../../redis/redis.service';
import { UsersService } from '../../users/users.service';
import { AuthService } from '../auth.service';

import type { AuditContext } from '../../audit/audit.service';
import type { AuthUserProfile } from '../auth.types';
import type { UpdateProfileDto } from '../dto/update-profile.dto';

interface PendingChange {
  value: string;
  otpHash: string;
  attemptCount: number;
}

const MIN_AGE_YEARS = 13;
const MAX_AGE_YEARS = 120;

/**
 * Backs `PATCH /auth/me` and the verification-gated phone/email change flows
 * (DPX-PROFILE-KYC-001, docs/DPX-PROFILE-KYC-001-DESIGN.md, founder decision
 * 2026-08-07). Deliberately its own service rather than an extension of
 * `PhoneVerificationService`/`EmailVerificationService`: those two assume the
 * value being verified is already the user's stored phone/email (true for
 * registration), which doesn't hold for a change to a *new*, not-yet-stored
 * value. This service reuses their OTP primitives (hash/compare, rate
 * limiting shape, notification dispatch) without touching the frozen
 * registration-verification code path.
 */
@Injectable()
export class ProfileService {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
    private readonly appConfig: AppConfigService,
    private readonly redis: RedisService,
    @Inject(NOTIFICATION_SERVICE)
    private readonly notificationService: NotificationService,
  ) {}

  public async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
    context: AuditContext,
  ): Promise<AuthUserProfile> {
    const changedFields = Object.keys(dto).filter(
      (key) => dto[key as keyof UpdateProfileDto] !== undefined,
    );

    if (changedFields.length === 0) {
      return await this.authService.getProfile(userId);
    }

    let dateOfBirth: Date | undefined;
    if (dto.dateOfBirth !== undefined) {
      dateOfBirth = this.parseAndValidateDateOfBirth(dto.dateOfBirth);
    }

    await this.usersService.updateProfile(userId, {
      ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
      ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
      ...(dto.profilePhotoUrl !== undefined ? { profilePhotoUrl: dto.profilePhotoUrl } : {}),
      ...(dateOfBirth !== undefined ? { dateOfBirth } : {}),
      ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
    });

    await this.auditService.record(
      AUTH_AUDIT_ACTIONS.PROFILE_UPDATED,
      { ...context, userId },
      { resource: 'user', resourceId: userId, metadata: { fields: changedFields } },
    );

    return await this.authService.getProfile(userId);
  }

  public async requestPhoneChange(
    userId: string,
    newPhone: string,
    context: AuditContext,
  ): Promise<{ expiresInSeconds: number }> {
    const normalizedPhone = newPhone.trim();
    const user = await this.usersService.getByIdOrThrow(userId);

    if (user.phone === normalizedPhone) {
      throw new ValidationDomainException('New phone number matches your current phone number');
    }

    const owner = await this.usersService.findByPhone(normalizedPhone);
    if (owner && owner.id !== userId) {
      throw new ConflictDomainException('Phone number is already registered to another account');
    }

    await this.enforceHourlyLimit('phone', userId);
    await this.enforceResendCooldown('phone', userId);

    const otp = this.generateOtp(6);
    const otpHash = this.hashOtp(otp);
    const pending: PendingChange = { value: normalizedPhone, otpHash, attemptCount: 0 };

    await this.redis.set(
      this.pendingKey('phone', userId),
      JSON.stringify(pending),
      this.appConfig.phoneOtpTtlSeconds,
    );

    await this.notificationService.sendPhoneOtp({
      phone: normalizedPhone,
      otp,
      expiresInSeconds: this.appConfig.phoneOtpTtlSeconds,
    });

    await this.auditService.record(
      AUTH_AUDIT_ACTIONS.PROFILE_PHONE_CHANGE_REQUESTED,
      { ...context, userId },
      { resource: 'user', resourceId: userId },
    );

    return { expiresInSeconds: this.appConfig.phoneOtpTtlSeconds };
  }

  public async confirmPhoneChange(
    userId: string,
    otp: string,
    context: AuditContext,
  ): Promise<AuthUserProfile> {
    const newPhone = await this.confirmPendingChange('phone', userId, otp, context, {
      requested: AUTH_AUDIT_ACTIONS.PROFILE_PHONE_CHANGE_REQUESTED,
      failed: AUTH_AUDIT_ACTIONS.PROFILE_PHONE_CHANGE_FAILED,
      succeeded: AUTH_AUDIT_ACTIONS.PROFILE_PHONE_CHANGED,
    });

    await this.usersService.updatePhone(userId, newPhone);
    return await this.authService.getProfile(userId);
  }

  public async requestEmailChange(
    userId: string,
    newEmail: string,
    context: AuditContext,
  ): Promise<{ expiresInSeconds: number }> {
    const normalizedEmail = newEmail.trim().toLowerCase();
    const user = await this.usersService.getByIdOrThrow(userId);

    if (user.email.toLowerCase() === normalizedEmail) {
      throw new ValidationDomainException('New email matches your current email');
    }

    const owner = await this.usersService.findByEmail(normalizedEmail);
    if (owner && owner.id !== userId) {
      throw new ConflictDomainException('Email is already registered to another account');
    }

    await this.enforceHourlyLimit('email', userId);
    await this.enforceResendCooldown('email', userId);

    const otp = this.generateOtp(this.appConfig.otpLength);
    const otpHash = this.hashOtp(otp);
    const pending: PendingChange = { value: normalizedEmail, otpHash, attemptCount: 0 };
    const ttlSeconds = this.appConfig.emailVerificationTtlSeconds;

    await this.redis.set(this.pendingKey('email', userId), JSON.stringify(pending), ttlSeconds);

    await this.notificationService.sendEmailOtp({
      email: normalizedEmail,
      otp,
      expiresInSeconds: ttlSeconds,
    });

    await this.auditService.record(
      AUTH_AUDIT_ACTIONS.PROFILE_EMAIL_CHANGE_REQUESTED,
      { ...context, userId },
      { resource: 'user', resourceId: userId },
    );

    return { expiresInSeconds: ttlSeconds };
  }

  public async confirmEmailChange(
    userId: string,
    otp: string,
    context: AuditContext,
  ): Promise<AuthUserProfile> {
    const newEmail = await this.confirmPendingChange('email', userId, otp, context, {
      requested: AUTH_AUDIT_ACTIONS.PROFILE_EMAIL_CHANGE_REQUESTED,
      failed: AUTH_AUDIT_ACTIONS.PROFILE_EMAIL_CHANGE_FAILED,
      succeeded: AUTH_AUDIT_ACTIONS.PROFILE_EMAIL_CHANGED,
    });

    await this.usersService.updateEmail(userId, newEmail);
    return await this.authService.getProfile(userId);
  }

  private async confirmPendingChange(
    kind: 'phone' | 'email',
    userId: string,
    otp: string,
    context: AuditContext,
    actions: { requested: string; failed: string; succeeded: string },
  ): Promise<string> {
    const lockKey = this.lockoutKey(kind, userId);
    const locked = await this.redis.get(lockKey);
    if (locked) {
      const retryAfter = Math.max(await this.redis.ttl(lockKey), 1);
      throw new RateLimitedDomainException(`${kind} change verification locked`, retryAfter);
    }

    const pendingKey = this.pendingKey(kind, userId);
    const raw = await this.redis.get(pendingKey);
    if (!raw) {
      await this.auditService.record(
        actions.failed,
        { ...context, userId },
        { resource: 'user', resourceId: userId, metadata: { reason: 'no_pending_change' } },
      );
      throw new UnauthorizedDomainException('Invalid or expired OTP');
    }

    const pending = JSON.parse(raw) as PendingChange;

    if (pending.attemptCount >= this.appConfig.identityVerificationMaxAttempts) {
      await this.redis.set(lockKey, '1', this.appConfig.identityVerificationLockoutSeconds);
      await this.redis.del(pendingKey);
      await this.auditService.record(
        actions.failed,
        { ...context, userId },
        { resource: 'user', resourceId: userId, metadata: { reason: 'attempts_exceeded' } },
      );
      throw new RateLimitedDomainException(
        `${kind} change verification attempts exceeded`,
        this.appConfig.identityVerificationLockoutSeconds,
      );
    }

    if (!this.otpHashesMatch(pending.otpHash, otp)) {
      pending.attemptCount += 1;
      const ttl = Math.max(await this.redis.ttl(pendingKey), 1);
      await this.redis.set(pendingKey, JSON.stringify(pending), ttl);
      await this.auditService.record(
        actions.failed,
        { ...context, userId },
        {
          resource: 'user',
          resourceId: userId,
          metadata: { reason: 'invalid_otp', attempts: pending.attemptCount },
        },
      );
      throw new UnauthorizedDomainException('Invalid or expired OTP');
    }

    await this.redis.del(pendingKey);
    await this.redis.del(lockKey);

    await this.auditService.record(
      actions.succeeded,
      { ...context, userId },
      { resource: 'user', resourceId: userId },
    );

    return pending.value;
  }

  private parseAndValidateDateOfBirth(value: string): Date {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new ValidationDomainException('dateOfBirth must be a valid date');
    }

    const now = new Date();
    if (parsed.getTime() >= now.getTime()) {
      throw new ValidationDomainException('dateOfBirth must be in the past');
    }

    const ageMs = now.getTime() - parsed.getTime();
    const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
    if (ageYears < MIN_AGE_YEARS || ageYears > MAX_AGE_YEARS) {
      throw new ValidationDomainException(
        `dateOfBirth must indicate an age between ${MIN_AGE_YEARS.toString()} and ${MAX_AGE_YEARS.toString()} years`,
      );
    }

    return parsed;
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

  private async enforceHourlyLimit(kind: 'phone' | 'email', userId: string): Promise<void> {
    const key = `auth:profile:${kind}-change:hourly:${userId}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, 3600);
    }
    const limit =
      kind === 'phone'
        ? this.appConfig.phoneOtpMaxPerHour
        : this.appConfig.emailVerificationMaxPerHour;
    if (count > limit) {
      const retryAfter = Math.max(await this.redis.ttl(key), 1);
      throw new RateLimitedDomainException(`${kind} change rate limit exceeded`, retryAfter);
    }
  }

  private async enforceResendCooldown(kind: 'phone' | 'email', userId: string): Promise<void> {
    const key = `auth:profile:${kind}-change:cooldown:${userId}`;
    const acquired = await this.redis.setNx(
      key,
      '1',
      this.appConfig.identityVerificationResendCooldownSeconds,
    );
    if (!acquired) {
      const retryAfter = Math.max(await this.redis.ttl(key), 1);
      throw new RateLimitedDomainException(`${kind} change resend cooldown active`, retryAfter);
    }
  }

  private pendingKey(kind: 'phone' | 'email', userId: string): string {
    return `auth:profile:${kind}-change:${userId}`;
  }

  private lockoutKey(kind: 'phone' | 'email', userId: string): string {
    return `auth:profile:${kind}-change:lockout:${userId}`;
  }
}
