import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

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
import type { EmailVerificationResponse } from '../auth-registration.types';

const PHONE_VERIFICATION_CHANNELS = new Set<RegistrationChannel>([
  RegistrationChannel.MERCHANT_PORTAL,
  RegistrationChannel.RIDER_PORTAL,
  RegistrationChannel.DRIVER_PORTAL,
]);

@Injectable()
export class EmailVerificationService {
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

  public async sendVerification(
    email: string,
    context: AuditContext,
  ): Promise<{ submitted: true }> {
    return await this.dispatch(email, context, false);
  }

  public async resendVerification(
    email: string,
    context: AuditContext,
  ): Promise<{ submitted: true }> {
    return await this.dispatch(email, context, true);
  }

  public async verify(
    email: string,
    token: string,
    context: AuditContext,
  ): Promise<EmailVerificationResponse> {
    const normalizedEmail = email.trim().toLowerCase();

    if (!this.isSignedTokenValid(token)) {
      await this.auditService.record(AUTH_AUDIT_ACTIONS.EMAIL_VERIFICATION_FAILED, context, {
        metadata: { reason: 'invalid_token' },
      });
      throw new UnauthorizedDomainException('Invalid or expired verification token');
    }

    const tokenHash = this.hashValue(token);
    const challenge = await this.verificationRepository.findByTokenHash(tokenHash);

    if (challenge?.type !== IdentityVerificationType.EMAIL) {
      await this.auditService.record(AUTH_AUDIT_ACTIONS.EMAIL_VERIFICATION_FAILED, context, {
        metadata: { reason: 'invalid_token' },
      });
      throw new UnauthorizedDomainException('Invalid or expired verification token');
    }

    if (challenge.consumedAt) {
      await this.auditService.record(
        AUTH_AUDIT_ACTIONS.EMAIL_VERIFICATION_FAILED,
        { ...context, userId: challenge.userId },
        {
          resource: 'identity_verification',
          resourceId: challenge.id,
          metadata: { reason: 'token_reused' },
        },
      );
      throw new UnauthorizedDomainException('Invalid or expired verification token');
    }

    if (challenge.expiresAt.getTime() <= Date.now()) {
      await this.auditService.record(
        AUTH_AUDIT_ACTIONS.VERIFICATION_EXPIRED,
        {
          ...context,
          userId: challenge.userId,
        },
        {
          resource: 'identity_verification',
          resourceId: challenge.id,
          metadata: { type: 'EMAIL' },
        },
      );
      await this.auditService.record(
        AUTH_AUDIT_ACTIONS.EMAIL_VERIFICATION_FAILED,
        { ...context, userId: challenge.userId },
        {
          resource: 'identity_verification',
          resourceId: challenge.id,
          metadata: { reason: 'token_expired' },
        },
      );
      throw new UnauthorizedDomainException('Invalid or expired verification token');
    }

    if (challenge.attemptCount >= this.appConfig.identityVerificationMaxAttempts) {
      await this.auditService.record(
        AUTH_AUDIT_ACTIONS.EMAIL_VERIFICATION_FAILED,
        { ...context, userId: challenge.userId },
        {
          resource: 'identity_verification',
          resourceId: challenge.id,
          metadata: { reason: 'attempts_exceeded' },
        },
      );
      throw new RateLimitedDomainException(
        'Verification attempts exceeded',
        this.appConfig.identityVerificationLockoutSeconds,
      );
    }

    const user = await this.usersService.findById(challenge.userId);
    if (!user || user.deletedAt || user.email.toLowerCase() !== normalizedEmail) {
      await this.verificationRepository.incrementAttemptCount(challenge.id);
      await this.auditService.record(
        AUTH_AUDIT_ACTIONS.EMAIL_VERIFICATION_FAILED,
        { ...context, userId: challenge.userId },
        {
          resource: 'identity_verification',
          resourceId: challenge.id,
          metadata: { reason: 'email_mismatch' },
        },
      );
      throw new UnauthorizedDomainException('Invalid or expired verification token');
    }

    await this.verificationRepository.markConsumed(challenge.id);
    const updated = await this.usersService.markEmailVerified(user.id);
    const activated = await this.usersService.activateIfVerificationsComplete(
      user.id,
      this.requiresPhoneVerification(user.registrationChannel),
    );

    await this.auditService.record(
      AUTH_AUDIT_ACTIONS.EMAIL_VERIFIED,
      { ...context, userId: user.id },
      { resource: 'user', resourceId: user.id },
    );

    return {
      verified: true,
      email: activated.email,
      status: activated.status,
      emailVerifiedAt: (updated.emailVerifiedAt ?? new Date()).toISOString(),
    };
  }

  private async dispatch(
    email: string,
    context: AuditContext,
    isResend: boolean,
  ): Promise<{ submitted: true }> {
    const normalizedEmail = email.trim().toLowerCase();
    await this.enforceHourlyLimit(normalizedEmail);
    if (isResend) {
      await this.enforceResendCooldown(normalizedEmail);
    }

    const user = await this.usersService.findByEmail(normalizedEmail);
    if (user && !user.deletedAt) {
      await this.verificationRepository.invalidateActiveForUser(
        user.id,
        IdentityVerificationType.EMAIL,
      );

      const token = this.createSignedToken();
      const tokenHash = this.hashValue(token);
      const expiresAt = new Date(Date.now() + this.appConfig.emailVerificationTtlSeconds * 1000);

      await this.verificationRepository.create({
        userId: user.id,
        type: IdentityVerificationType.EMAIL,
        tokenHash,
        expiresAt,
      });

      await this.notificationService.sendEmailVerification({
        email: normalizedEmail,
        verificationToken: token,
        expiresInSeconds: this.appConfig.emailVerificationTtlSeconds,
      });

      await this.auditService.record(
        AUTH_AUDIT_ACTIONS.EMAIL_SENT,
        { ...context, userId: user.id },
        {
          resource: 'user',
          resourceId: user.id,
          metadata: { channel: 'email', resend: isResend },
        },
      );
    }

    return { submitted: true };
  }

  private createSignedToken(): string {
    const nonce = randomBytes(32).toString('base64url');
    const signature = createHmac('sha256', this.appConfig.jwtAccessSecret)
      .update(nonce)
      .digest('base64url');
    return `${nonce}.${signature}`;
  }

  private isSignedTokenValid(token: string): boolean {
    const parts = token.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return false;
    }
    const [nonce, providedSignature] = parts;
    const expectedSignature = createHmac('sha256', this.appConfig.jwtAccessSecret)
      .update(nonce)
      .digest('base64url');

    const provided = Buffer.from(providedSignature);
    const expected = Buffer.from(expectedSignature);
    if (provided.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(provided, expected);
  }

  private hashValue(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private async enforceHourlyLimit(email: string): Promise<void> {
    const key = `auth:email:verify:hourly:${email}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, 3600);
    }
    if (count > this.appConfig.emailVerificationMaxPerHour) {
      const retryAfter = Math.max(await this.redis.ttl(key), 1);
      throw new RateLimitedDomainException('Email verification rate limit exceeded', retryAfter);
    }
  }

  private async enforceResendCooldown(email: string): Promise<void> {
    const key = `auth:email:verify:cooldown:${email}`;
    const acquired = await this.redis.setNx(
      key,
      '1',
      this.appConfig.identityVerificationResendCooldownSeconds,
    );
    if (!acquired) {
      const retryAfter = Math.max(await this.redis.ttl(key), 1);
      throw new RateLimitedDomainException('Email verification resend cooldown active', retryAfter);
    }
  }

  private requiresPhoneVerification(channel: RegistrationChannel | null): boolean {
    if (!channel) {
      return false;
    }
    return PHONE_VERIFICATION_CHANNELS.has(channel);
  }
}
