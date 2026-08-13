import { createHash, randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { AUTH_AUDIT_ACTIONS } from '../../audit/audit.constants';
import { AuditService } from '../../audit/audit.service';
import {
  RateLimitedDomainException,
  UnauthorizedDomainException,
  ValidationDomainException,
} from '../../common/exceptions/domain.exception';
import { AppConfigService } from '../../config/app-config.service';
import { DomainEventBus } from '../../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../../events/domain-events';
import {
  NOTIFICATION_SERVICE,
  type NotificationService,
} from '../../notifications/notification.service';
import { RedisService } from '../../redis/redis.service';
import { UsersService } from '../../users/users.service';
import {
  AUTH_SESSION_REPOSITORY,
  type AuthSessionRepository,
} from '../repositories/auth-session.repository';
import {
  PASSWORD_RESET_TOKEN_REPOSITORY,
  type PasswordResetTokenRepository,
} from '../repositories/password-reset.repository';

import { OtpService } from './otp.service';
import { PasswordPolicyService } from './password-policy.service';

import type { AuditContext } from '../../audit/audit.service';

@Injectable()
export class PasswordService {
  constructor(
    private readonly usersService: UsersService,
    private readonly otpService: OtpService,
    private readonly passwordPolicy: PasswordPolicyService,
    private readonly auditService: AuditService,
    private readonly appConfig: AppConfigService,
    private readonly redis: RedisService,
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY)
    private readonly passwordResetTokenRepository: PasswordResetTokenRepository,
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly authSessionRepository: AuthSessionRepository,
    @Inject(NOTIFICATION_SERVICE)
    private readonly notificationService: NotificationService,
    private readonly eventBus: DomainEventBus,
  ) {}

  public async forgotPassword(email: string, context: AuditContext): Promise<{ submitted: true }> {
    const normalizedEmail = email.trim().toLowerCase();
    await this.enforceForgotRateLimit(normalizedEmail);

    await this.auditService.record(AUTH_AUDIT_ACTIONS.PASSWORD_FORGOT, context, {
      metadata: { emailProvided: true },
    });

    const user = await this.usersService.findByEmail(normalizedEmail);
    if (user && !user.deletedAt && user.status === UserStatus.ACTIVE) {
      await this.passwordResetTokenRepository.invalidateActiveForUser(user.id);

      const resetToken = randomBytes(32).toString('hex');
      const tokenHash = this.hashToken(resetToken);
      const expiresAt = new Date(Date.now() + this.appConfig.passwordResetTokenTtlSeconds * 1000);

      await this.passwordResetTokenRepository.create({
        userId: user.id,
        tokenHash,
        expiresAt,
      });

      await this.otpService.generateStoreAndDispatch(
        'password_reset',
        normalizedEmail,
        { ...context, userId: user.id },
        async (otp, expiresInSeconds) => {
          await this.notificationService.sendPasswordReset({
            email: normalizedEmail,
            resetToken,
            otp,
            expiresInSeconds,
          });
        },
        user.id,
      );
    }

    return { submitted: true };
  }

  public async resetPassword(
    input: { email: string; otp: string; password: string },
    context: AuditContext,
  ): Promise<{ reset: true }> {
    const normalizedEmail = input.email.trim().toLowerCase();

    await this.auditService.record(AUTH_AUDIT_ACTIONS.PASSWORD_RESET_STARTED, context, {
      metadata: { emailProvided: true },
    });

    try {
      this.passwordPolicy.assertValid(input.password);

      const user = await this.usersService.findByEmail(normalizedEmail);
      if (!user || user.deletedAt || user.status !== UserStatus.ACTIVE) {
        await this.failReset(context, 'invalid_account');
        throw new UnauthorizedDomainException('Invalid or expired reset code');
      }

      // The emailed OTP is the reset factor — it proves control of the inbox.
      // Throws on an invalid / expired / exhausted code.
      await this.otpService.verify(
        'password_reset',
        normalizedEmail,
        input.otp,
        { ...context, userId: user.id },
        user.id,
      );

      const passwordHash = await bcrypt.hash(input.password, this.appConfig.bcryptSaltRounds);
      await this.usersService.updatePassword(user.id, passwordHash);

      const revokedCount = await this.authSessionRepository.revokeAllForUser(user.id);
      await this.auditService.record(
        AUTH_AUDIT_ACTIONS.SESSIONS_REVOKED_PASSWORD,
        { ...context, userId: user.id },
        {
          resource: 'user',
          resourceId: user.id,
          metadata: { revokedSessionCount: revokedCount, reason: 'password_reset' },
        },
      );

      await this.notificationService.sendPasswordChanged({ email: user.email });

      await this.auditService.record(
        AUTH_AUDIT_ACTIONS.PASSWORD_RESET_SUCCESS,
        { ...context, userId: user.id },
        { resource: 'user', resourceId: user.id },
      );

      await this.eventBus.emit(DOMAIN_EVENTS.PASSWORD_RESET, { userId: user.id });

      return { reset: true };
    } catch (error) {
      if (error instanceof ValidationDomainException) {
        await this.failReset(context, 'password_policy');
      } else if (!(error instanceof UnauthorizedDomainException)) {
        await this.failReset(
          context,
          error instanceof Error ? error.constructor.name : 'reset_failed',
        );
      }
      throw error;
    }
  }

  public async changePassword(
    userId: string,
    input: { currentPassword: string; newPassword: string },
    context: AuditContext,
  ): Promise<{ changed: true }> {
    try {
      const user = await this.usersService.findById(userId);
      if (!user || user.deletedAt) {
        throw new UnauthorizedDomainException('Authentication required');
      }

      const currentValid = await bcrypt.compare(input.currentPassword, user.passwordHash);
      if (!currentValid) {
        await this.auditService.record(
          AUTH_AUDIT_ACTIONS.PASSWORD_CHANGE_FAILED,
          { ...context, userId },
          { resource: 'user', resourceId: userId, metadata: { reason: 'wrong_current_password' } },
        );
        throw new UnauthorizedDomainException('Current password is incorrect');
      }

      if (input.currentPassword === input.newPassword) {
        await this.auditService.record(
          AUTH_AUDIT_ACTIONS.PASSWORD_CHANGE_FAILED,
          { ...context, userId },
          { resource: 'user', resourceId: userId, metadata: { reason: 'identical_password' } },
        );
        throw new ValidationDomainException('New password must be different from current password');
      }

      this.passwordPolicy.assertValid(input.newPassword);

      const passwordHash = await bcrypt.hash(input.newPassword, this.appConfig.bcryptSaltRounds);
      await this.usersService.updatePassword(userId, passwordHash);

      const revokedCount = await this.authSessionRepository.revokeAllForUser(userId);
      await this.auditService.record(
        AUTH_AUDIT_ACTIONS.SESSIONS_REVOKED_PASSWORD,
        { ...context, userId },
        {
          resource: 'user',
          resourceId: userId,
          metadata: { revokedSessionCount: revokedCount, reason: 'password_change' },
        },
      );

      await this.notificationService.sendPasswordChanged({ email: user.email });

      await this.auditService.record(
        AUTH_AUDIT_ACTIONS.PASSWORD_CHANGED,
        { ...context, userId },
        { resource: 'user', resourceId: userId },
      );
      await this.eventBus.emit(DOMAIN_EVENTS.PASSWORD_CHANGED, { userId });

      return { changed: true };
    } catch (error) {
      if (
        !(error instanceof UnauthorizedDomainException) &&
        !(error instanceof ValidationDomainException)
      ) {
        await this.auditService.record(
          AUTH_AUDIT_ACTIONS.PASSWORD_CHANGE_FAILED,
          { ...context, userId },
          {
            metadata: {
              reason: error instanceof Error ? error.constructor.name : 'change_failed',
            },
          },
        );
      }
      throw error;
    }
  }

  public hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async failReset(
    context: AuditContext,
    reason: string,
    resourceId?: string,
  ): Promise<void> {
    await this.auditService.record(AUTH_AUDIT_ACTIONS.PASSWORD_RESET_FAILED, context, {
      ...(resourceId !== undefined ? { resource: 'password_reset_token', resourceId } : {}),
      metadata: { reason },
    });
  }

  private async enforceForgotRateLimit(email: string): Promise<void> {
    const key = `auth:password:forgot:${email}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, 3600);
    }
    if (count > this.appConfig.passwordForgotMaxPerHour) {
      const retryAfter = Math.max(await this.redis.ttl(key), 1);
      throw new RateLimitedDomainException('Too many password reset requests', retryAfter);
    }
  }
}
