import { Inject, Injectable, Optional } from '@nestjs/common';
import { RegistrationChannel, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { AUTH_AUDIT_ACTIONS } from '../../audit/audit.constants';
import { AuditService } from '../../audit/audit.service';
import {
  ConflictDomainException,
  ValidationDomainException,
} from '../../common/exceptions/domain.exception';
import { AppConfigService } from '../../config/app-config.service';
import { DomainEventBus } from '../../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../../events/domain-events';
import { DriverCampaignService } from '../../referrals/driver-campaign.service';
import { ReferralsService } from '../../referrals/referrals.service';
import { UsersService } from '../../users/users.service';
import {
  REGISTRATION_REPOSITORY,
  type RegistrationRepository,
} from '../repositories/registration.repository';

import { OtpService } from './otp.service';

import type { AuditContext } from '../../audit/audit.service';
import type { PortalRegistrationType, RegistrationResponse } from '../auth-registration.types';

export interface PortalRegistrationDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  referralCode?: string;
}

interface PortalConfig {
  roleName: string;
  channel: RegistrationChannel;
  phoneRequired: boolean;
  sendPhoneOtpOnRegister: boolean;
  requiresPhoneVerification: boolean;
}

const PORTAL_CONFIG: Record<PortalRegistrationType, PortalConfig> = {
  customer: {
    roleName: 'customer',
    channel: RegistrationChannel.CUSTOMER_WEB,
    phoneRequired: false,
    sendPhoneOtpOnRegister: false,
    requiresPhoneVerification: false,
  },
  merchant: {
    roleName: 'merchant',
    channel: RegistrationChannel.MERCHANT_PORTAL,
    phoneRequired: false,
    sendPhoneOtpOnRegister: true,
    requiresPhoneVerification: true,
  },
  rider: {
    roleName: 'rider',
    channel: RegistrationChannel.RIDER_PORTAL,
    phoneRequired: true,
    sendPhoneOtpOnRegister: true,
    requiresPhoneVerification: true,
  },
  driver: {
    roleName: 'driver',
    channel: RegistrationChannel.DRIVER_PORTAL,
    phoneRequired: true,
    sendPhoneOtpOnRegister: true,
    requiresPhoneVerification: true,
  },
};

@Injectable()
export class RegistrationService {
  constructor(
    @Inject(REGISTRATION_REPOSITORY)
    private readonly registrationRepository: RegistrationRepository,
    private readonly usersService: UsersService,
    private readonly otpService: OtpService,
    private readonly auditService: AuditService,
    private readonly appConfig: AppConfigService,
    @Optional()
    private readonly eventBus?: DomainEventBus,
    @Optional()
    private readonly referralsService?: ReferralsService,
    @Optional()
    private readonly driverCampaignService?: DriverCampaignService,
  ) {}

  public async registerCustomer(
    dto: PortalRegistrationDto,
    context: AuditContext,
  ): Promise<RegistrationResponse> {
    return await this.registerPortal('customer', dto, context);
  }

  public async registerMerchant(
    dto: PortalRegistrationDto,
    context: AuditContext,
  ): Promise<RegistrationResponse> {
    return await this.registerPortal('merchant', dto, context);
  }

  public async registerRider(
    dto: PortalRegistrationDto,
    context: AuditContext,
  ): Promise<RegistrationResponse> {
    return await this.registerPortal('rider', dto, context);
  }

  public async registerDriver(
    dto: PortalRegistrationDto,
    context: AuditContext,
  ): Promise<RegistrationResponse> {
    return await this.registerPortal('driver', dto, context);
  }

  private async registerPortal(
    portal: PortalRegistrationType,
    dto: PortalRegistrationDto,
    context: AuditContext,
  ): Promise<RegistrationResponse> {
    const config = PORTAL_CONFIG[portal];
    const email = dto.email.trim().toLowerCase();
    const phone = dto.phone?.trim();

    if (config.phoneRequired && !phone) {
      throw new ValidationDomainException('Phone number is required for this registration channel');
    }

    const existingEmail = await this.usersService.findByEmail(email);
    if (existingEmail) {
      throw new ConflictDomainException('Email is already registered');
    }

    if (phone) {
      const existingPhone = await this.usersService.findByPhone(phone);
      if (existingPhone) {
        throw new ConflictDomainException('Phone number is already registered');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, this.appConfig.bcryptSaltRounds);

    const result = await this.registrationRepository.registerPortalUser({
      email,
      passwordHash,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      status: UserStatus.PENDING_VERIFICATION,
      registrationChannel: config.channel,
      roleName: config.roleName,
      portal,
      ...(phone !== undefined ? { phone } : {}),
    });

    const emailOtp = await this.otpService.generateAndStore(
      'email_verification',
      email,
      context,
      result.userId,
    );

    let phoneOtpSent = false;
    if (phone && config.sendPhoneOtpOnRegister) {
      await this.otpService.generateAndStore('phone_verification', phone, context, result.userId);
      phoneOtpSent = true;
    }

    await this.auditService.record(
      AUTH_AUDIT_ACTIONS.REGISTRATION_COMPLETED,
      {
        ...context,
        userId: result.userId,
      },
      {
        resource: 'user',
        resourceId: result.userId,
        metadata: {
          portal,
          registrationChannel: config.channel,
          requiresPhoneVerification: config.requiresPhoneVerification,
        },
      },
    );

    await this.eventBus?.emit(
      DOMAIN_EVENTS.CUSTOMER_REGISTERED,
      {
        userId: result.userId,
        email: result.email,
        portal,
        registrationChannel: config.channel,
      },
      { actorUserId: result.userId },
    );

    if (portal === 'customer' && dto.referralCode) {
      const redemptionContext = { ...context, userId: result.userId };
      const claimedByDriverCampaign = await this.driverCampaignService?.tryRedeemDriverCode(
        result.userId,
        dto.referralCode,
        redemptionContext,
      );
      if (!claimedByDriverCampaign) {
        await this.referralsService?.tryRedeemAtRegistration(
          result.userId,
          dto.referralCode,
          redemptionContext,
        );
      }
    }

    return {
      userId: result.userId,
      email: result.email,
      status: result.status,
      verification: {
        emailOtpSent: true,
        phoneOtpSent,
        expiresInSeconds: emailOtp.expiresInSeconds,
      },
      ...(result.profileId !== undefined ? { profileId: result.profileId } : {}),
      ...(result.onboardingId !== undefined ? { onboardingId: result.onboardingId } : {}),
    };
  }
}
