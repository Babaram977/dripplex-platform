import { Injectable } from '@nestjs/common';
import { RegistrationChannel } from '@prisma/client';

import {
  NotFoundDomainException,
  ValidationDomainException,
} from '../../common/exceptions/domain.exception';
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

  private requiresPhoneVerification(channel: RegistrationChannel | null): boolean {
    if (!channel) {
      return false;
    }
    return PHONE_VERIFICATION_CHANNELS.has(channel);
  }
}
