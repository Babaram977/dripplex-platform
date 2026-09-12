import { Inject, Injectable, Optional } from '@nestjs/common';
import { ReferralRefereeType, RegistrationChannel, UserStatus } from '@prisma/client';
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
import {
  NOTIFICATION_SERVICE,
  type NotificationService,
} from '../../notifications/notification.service';
import { CampaignAttributionService } from '../../referrals/campaign-attribution.service';
import { looksLikeCampaignToken } from '../../referrals/campaign-promoter-token.util';
import { DriverCampaignService } from '../../referrals/driver-campaign.service';
import { ReferralsService } from '../../referrals/referrals.service';
import { UsersService } from '../../users/users.service';
import {
  REGISTRATION_REPOSITORY,
  type RegistrationRepository,
} from '../repositories/registration.repository';
import { makeSyntheticEmail } from '../utils/synthetic-email.util';

import { OtpService } from './otp.service';

import type { AuditContext } from '../../audit/audit.service';
import type { PortalRegistrationType, RegistrationResponse } from '../auth-registration.types';

export interface PortalRegistrationDto {
  email?: string;
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

/**
 * Which referral programme a portal's signup belongs to, or null where none is
 * priced. Null is a refusal to guess rather than an oversight — see the comment
 * at the redemption site.
 */
const REFERRAL_REFEREE_TYPES: Record<PortalRegistrationType, ReferralRefereeType | null> = {
  customer: ReferralRefereeType.CUSTOMER,
  merchant: ReferralRefereeType.MERCHANT,
  rider: null,
  driver: null,
};

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
    @Inject(NOTIFICATION_SERVICE)
    private readonly notificationService: NotificationService,
    @Optional()
    private readonly eventBus?: DomainEventBus,
    @Optional()
    private readonly referralsService?: ReferralsService,
    @Optional()
    private readonly driverCampaignService?: DriverCampaignService,
    // Last, and optional like its siblings: adding a constructor parameter
    // anywhere but the end reorders every positional injection in the specs.
    @Optional()
    private readonly campaignAttributionService?: CampaignAttributionService,
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

  /**
   * "Become a Driver" / "Become a Merchant" -- grants an additional role
   * to an ALREADY AUTHENTICATED user's existing account, instead of the
   * always-new-account path above. This is what makes the Super App's
   * single-account, multi-role toggle real: `registerDriver`/
   * `registerMerchant` reject outright if the email/phone is already
   * registered, so a logged-in customer could never acquire the driver or
   * merchant role through them. No OTP/email dispatch here -- the account
   * is already verified; the user proceeds straight into the same
   * onboarding endpoints (`/driver/onboarding/*`, `/merchant/onboarding`)
   * a fresh registration would land on next.
   */
  public async addRole(
    userId: string,
    portal: 'merchant' | 'driver',
    context: AuditContext,
  ): Promise<{ role: string; profileId: string; onboardingId: string }> {
    const roleName = portal;
    const result = await this.registrationRepository.addPortalRole({
      userId,
      roleName,
      portal,
    });

    await this.auditService.record(
      AUTH_AUDIT_ACTIONS.REGISTRATION_COMPLETED,
      { ...context, userId },
      {
        resource: 'user',
        resourceId: userId,
        metadata: { portal, role: roleName },
      },
    );

    return { role: roleName, profileId: result.profileId, onboardingId: result.onboardingId };
  }

  private async registerPortal(
    portal: PortalRegistrationType,
    dto: PortalRegistrationDto,
    context: AuditContext,
  ): Promise<RegistrationResponse> {
    const config = PORTAL_CONFIG[portal];
    const email = dto.email?.trim().toLowerCase();
    const phone = dto.phone?.trim();

    // While PORTAL_EMAIL_ACTIVATION is on (Termii SMS sender-ID pending), the
    // merchant/driver/rider portals verify by email, so don't dispatch a phone
    // OTP that can't be delivered. Phone (when provided) is still recorded for
    // when SMS returns; activation/login no longer require it (see
    // verification.service / login.service). Customer is never affected.
    const emailActivation = this.appConfig.portalEmailActivation && portal !== 'customer';
    const sendPhoneOtpOnRegister = emailActivation ? false : config.sendPhoneOtpOnRegister;

    if (config.phoneRequired && !phone) {
      throw new ValidationDomainException('Phone number is required for this registration channel');
    }

    if (email) {
      const existingEmail = await this.usersService.findByEmail(email);
      if (existingEmail) {
        throw new ConflictDomainException('Email is already registered');
      }
    }

    if (phone) {
      const existingPhone = await this.usersService.findByPhone(phone);
      if (existingPhone) {
        throw new ConflictDomainException('Phone number is already registered');
      }
    }

    // `User.email` stays required/unique in the schema (see
    // synthetic-email.util.ts for why) -- a phone-only registration gets a
    // deterministic placeholder derived from the phone number instead of a
    // real address. It's never shown back to the caller, never sent to,
    // and treated as auto-verified for account activation.
    let storedEmail: string;
    if (email) {
      storedEmail = email;
    } else if (phone) {
      storedEmail = makeSyntheticEmail(phone);
    } else {
      throw new ValidationDomainException('Either an email or phone number is required');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.appConfig.bcryptSaltRounds);

    const result = await this.registrationRepository.registerPortalUser({
      email: storedEmail,
      passwordHash,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      status: UserStatus.PENDING_VERIFICATION,
      registrationChannel: config.channel,
      roleName: config.roleName,
      portal,
      ...(phone !== undefined ? { phone } : {}),
    });

    let emailOtpSent = false;
    let emailExpiresInSeconds: number | undefined;
    if (email) {
      const emailOtp = await this.otpService.generateStoreAndDispatch(
        'email_verification',
        email,
        context,
        async (otp, expiresInSeconds) => {
          await this.notificationService.sendEmailOtp({ email, otp, expiresInSeconds });
        },
        result.userId,
      );
      emailOtpSent = true;
      emailExpiresInSeconds = emailOtp.expiresInSeconds;
    }

    // Phone gets verified whenever the portal always requires it, or when
    // it's the only identifier the user gave (no email at all) -- either
    // way there must be at least one verified channel to activate on.
    let phoneOtpSent = false;
    let phoneExpiresInSeconds: number | undefined;
    if (phone && (sendPhoneOtpOnRegister || !email)) {
      const phoneOtp = await this.otpService.generateStoreAndDispatch(
        'phone_verification',
        phone,
        context,
        async (otp, expiresInSeconds) => {
          await this.notificationService.sendPhoneOtp({ phone, otp, expiresInSeconds });
        },
        result.userId,
      );
      phoneOtpSent = true;
      phoneExpiresInSeconds = phoneOtp.expiresInSeconds;
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
        email: email ?? null,
        portal,
        registrationChannel: config.channel,
      },
      { actorUserId: result.userId },
    );

    // DPX-REFERRAL-003 — merchants can be referred too, and are worth their own
    // programme. `referralCode` has always been on the shared portal DTO; until
    // now a merchant who typed one had it silently dropped, which reads to both
    // sides as the code not working.
    //
    // Driver and rider portals are deliberately still excluded. There is no
    // programme priced for either, and a referral with no programme cannot
    // qualify — recording one would promise a reward nothing has agreed.
    const refereeType = REFERRAL_REFEREE_TYPES[portal];
    if (refereeType !== null && dto.referralCode) {
      const redemptionContext = { ...context, userId: result.userId };

      // DPX-PROMO-REF-001 — one field, three mechanisms, founder-ruled
      // precedence: campaign promoter token, then driver campaign code, then
      // the standing programme.
      //
      // A campaign token is an explicitly issued private acquisition
      // credential, so if it resolves it owns the acquisition. If it does not
      // resolve it still owns the outcome: an input that is structurally a
      // campaign token never falls through to the other two. Letting it would
      // mean a revoked or mistyped token quietly becoming a different
      // mechanism's acquisition, crediting the wrong person.
      //
      // Whichever branch runs, the acquisition converges on the single
      // `ReferralRedemption.refereeUserId` unique constraint — this ordering
      // decides who is credited, never how many times.
      if (looksLikeCampaignToken(dto.referralCode)) {
        await this.campaignAttributionService?.attribute(
          result.userId,
          dto.referralCode,
          redemptionContext,
          refereeType,
        );
      } else {
        // The driver campaign owns its own codes and its own money. Only a code
        // it does not claim falls through to the standing programme.
        const claimedByDriverCampaign =
          portal === 'customer'
            ? await this.driverCampaignService?.tryRedeemDriverCode(
                result.userId,
                dto.referralCode,
                redemptionContext,
              )
            : false;
        if (!claimedByDriverCampaign) {
          await this.referralsService?.tryRedeemAtRegistration(
            result.userId,
            dto.referralCode,
            redemptionContext,
            refereeType,
          );
        }
      }
    }

    return {
      userId: result.userId,
      // Echoes back what the caller actually gave, not the internal
      // synthetic placeholder used for a phone-only registration.
      email: email ?? null,
      status: result.status,
      verification: {
        emailOtpSent,
        phoneOtpSent,
        expiresInSeconds: emailExpiresInSeconds ?? phoneExpiresInSeconds ?? 0,
      },
      ...(result.profileId !== undefined ? { profileId: result.profileId } : {}),
      ...(result.onboardingId !== undefined ? { onboardingId: result.onboardingId } : {}),
    };
  }
}
