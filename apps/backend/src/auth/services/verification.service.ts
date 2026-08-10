import { Inject, Injectable } from '@nestjs/common';
import { RegistrationChannel } from '@prisma/client';

import {
  NotFoundDomainException,
  ValidationDomainException,
} from '../../common/exceptions/domain.exception';
import { AppConfigService } from '../../config/app-config.service';
import {
  NOTIFICATION_SERVICE,
  type NotificationService,
} from '../../notifications/notification.service';
import { UsersService } from '../../users/users.service';

import { OtpService } from './otp.service';

import type { AuditContext } from '../../audit/audit.service';
import type {
  EmailVerificationResponse,
  PhoneVerificationResponse,
} from '../auth-registration.types';

const PHONE_VERIFICATION_CHANNELS = new Set<RegistrationChannel>([
  RegistrationChannel.MERCHANT_PORTAL,
  RegistrationChannel.RIDER_PORTAL,
  RegistrationChannel.DRIVER_PORTAL,
]);

@Injectable()
export class VerificationService {
  constructor(
    private readonly usersService: UsersService,
    private readonly otpService: OtpService,
    private readonly appConfig: AppConfigService,
    @Inject(NOTIFICATION_SERVICE)
    private readonly notificationService: NotificationService,
  ) {}

  public async verifyEmail(
    email: string,
    otp: string,
    context: AuditContext,
  ): Promise<EmailVerificationResponse> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(normalizedEmail);
    if (!user || user.deletedAt) {
      throw new NotFoundDomainException('User not found');
    }

    await this.otpService.verify('email_verification', normalizedEmail, otp, context, user.id);

    const updated = await this.usersService.markEmailVerified(user.id);
    const activated = await this.usersService.activateIfVerificationsComplete(
      user.id,
      this.requiresPhoneVerification(user.registrationChannel),
    );

    return {
      verified: true,
      email: activated.email,
      status: activated.status,
      emailVerifiedAt: (updated.emailVerifiedAt ?? new Date()).toISOString(),
    };
  }

  public async verifyPhone(
    phone: string,
    otp: string,
    context: AuditContext,
  ): Promise<PhoneVerificationResponse> {
    const normalizedPhone = phone.trim();
    const user = await this.usersService.findByPhone(normalizedPhone);
    if (!user || user.deletedAt) {
      throw new NotFoundDomainException('User not found');
    }

    if (!user.phone) {
      throw new ValidationDomainException('User does not have a phone number on record');
    }

    await this.otpService.verify('phone_verification', normalizedPhone, otp, context, user.id);

    const updated = await this.usersService.markPhoneVerified(user.id);
    const activated = await this.usersService.activateIfVerificationsComplete(
      user.id,
      this.requiresPhoneVerification(user.registrationChannel),
    );

    return {
      verified: true,
      phone: activated.phone ?? normalizedPhone,
      status: activated.status,
      phoneVerifiedAt: (updated.phoneVerifiedAt ?? new Date()).toISOString(),
    };
  }

  /**
   * Resends the 6-digit code checked by `verifyEmail` above -- deliberately
   * NOT the same system as `EmailVerificationController`'s `/auth/email/resend`
   * (a signed magic-link token for a separate feature). That mismatch was a
   * real bug: the OTP screen's "Resend" button called the magic-link resend,
   * which neither refreshed the code `verifyEmail` checks nor sent one at
   * all. This regenerates the same `OtpService`-backed code the original
   * registration dispatch created, so a resent code actually verifies.
   * Anti-enumeration: always reports success, whether or not the email
   * belongs to an account.
   */
  public async resendEmailOtp(email: string, context: AuditContext): Promise<{ submitted: true }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(normalizedEmail);
    if (user && !user.deletedAt) {
      await this.otpService.generateStoreAndDispatch(
        'email_verification',
        normalizedEmail,
        context,
        async (otp, expiresInSeconds) => {
          await this.notificationService.sendEmailOtp({
            email: normalizedEmail,
            otp,
            expiresInSeconds,
          });
        },
        user.id,
      );
    }
    return { submitted: true };
  }

  /** Phone counterpart to `resendEmailOtp` -- same fix, same reasoning. */
  public async resendPhoneOtp(phone: string, context: AuditContext): Promise<{ submitted: true }> {
    const normalizedPhone = phone.trim();
    const user = await this.usersService.findByPhone(normalizedPhone);
    if (user && !user.deletedAt) {
      await this.otpService.generateStoreAndDispatch(
        'phone_verification',
        normalizedPhone,
        context,
        async (otp, expiresInSeconds) => {
          await this.notificationService.sendPhoneOtp({
            phone: normalizedPhone,
            otp,
            expiresInSeconds,
          });
        },
        user.id,
      );
    }
    return { submitted: true };
  }

  private requiresPhoneVerification(channel: RegistrationChannel | null): boolean {
    if (!channel) {
      return false;
    }
    // While PORTAL_EMAIL_ACTIVATION is on (Termii SMS sender-ID pending), the
    // merchant/driver/rider portals activate on EMAIL verification alone.
    // Restoring the flag to false re-enforces phone verification for them.
    if (this.appConfig.portalEmailActivation) {
      return false;
    }
    return PHONE_VERIFICATION_CHANNELS.has(channel);
  }
}
