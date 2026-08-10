import { Inject, Injectable } from '@nestjs/common';
import { RegistrationChannel, UserStatus, type User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { AUTH_AUDIT_ACTIONS } from '../../audit/audit.constants';
import { AuditService } from '../../audit/audit.service';
import {
  AccountBlockedDomainException,
  AccountSuspendedDomainException,
  EmailNotVerifiedDomainException,
  ForbiddenDomainException,
  PhoneNotVerifiedDomainException,
  UnauthorizedDomainException,
  ValidationDomainException,
  WrongPortalDomainException,
} from '../../common/exceptions/domain.exception';
import { AppConfigService } from '../../config/app-config.service';
import { UsersService } from '../../users/users.service';
import {
  AUTH_SESSION_REPOSITORY,
  type AuthSessionRepository,
} from '../repositories/auth-session.repository';
import { isSyntheticEmail } from '../utils/synthetic-email.util';

import { LoginAttemptService } from './login-attempt.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

import type { AuditContext } from '../../audit/audit.service';
import type { AuthUserProfile, PortalLoginResponse, PortalLoginType } from '../auth-login.types';
import type { PortalLoginDto } from '../dto/portal-login.dto';

interface PortalLoginConfig {
  /**
   * Roles permitted to sign in through this portal. A user is admitted if they
   * hold ANY of these; the specific matched role is what gets stamped into the
   * issued token (the JWT strategy rejects a token whose `role` the user does
   * not actually hold, so admin — which admits two roles — must issue the one
   * the user really has, not a fixed label).
   */
  roleNames: string[];
  channel: RegistrationChannel;
  requiresPhoneVerification: boolean;
}

const PORTAL_LOGIN_CONFIG: Record<PortalLoginType, PortalLoginConfig> = {
  customer: {
    roleNames: ['customer'],
    channel: RegistrationChannel.CUSTOMER_WEB,
    requiresPhoneVerification: false,
  },
  merchant: {
    roleNames: ['merchant'],
    channel: RegistrationChannel.MERCHANT_PORTAL,
    requiresPhoneVerification: true,
  },
  rider: {
    roleNames: ['rider'],
    channel: RegistrationChannel.RIDER_PORTAL,
    requiresPhoneVerification: true,
  },
  driver: {
    roleNames: ['driver'],
    channel: RegistrationChannel.DRIVER_PORTAL,
    requiresPhoneVerification: true,
  },
  // DPX-DRIVER-015 — admin/operations staff authenticate through the same
  // unified login pipeline (no separate auth system). Admin admits both the
  // administrator and super_administrator roles. Staff accounts are invited,
  // not self-registered, so phone verification is not required.
  admin: {
    roleNames: ['administrator', 'super_administrator'],
    channel: RegistrationChannel.ADMIN_PORTAL,
    requiresPhoneVerification: false,
  },
  operations: {
    roleNames: ['operations_staff'],
    channel: RegistrationChannel.OPERATIONS_CONSOLE,
    requiresPhoneVerification: false,
  },
};

const TIMING_SAFE_DUMMY_HASH = '$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW';

@Injectable()
export class LoginService {
  constructor(
    private readonly usersService: UsersService,
    private readonly sessionService: SessionService,
    private readonly loginAttemptService: LoginAttemptService,
    private readonly auditService: AuditService,
    private readonly tokenService: TokenService,
    private readonly appConfig: AppConfigService,
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly authSessionRepository: AuthSessionRepository,
  ) {}

  public loginCustomer(dto: PortalLoginDto, context: AuditContext): Promise<PortalLoginResponse> {
    return this.loginPortal('customer', dto, context);
  }

  public loginMerchant(dto: PortalLoginDto, context: AuditContext): Promise<PortalLoginResponse> {
    return this.loginPortal('merchant', dto, context);
  }

  public loginRider(dto: PortalLoginDto, context: AuditContext): Promise<PortalLoginResponse> {
    return this.loginPortal('rider', dto, context);
  }

  public loginDriver(dto: PortalLoginDto, context: AuditContext): Promise<PortalLoginResponse> {
    return this.loginPortal('driver', dto, context);
  }

  public loginAdmin(dto: PortalLoginDto, context: AuditContext): Promise<PortalLoginResponse> {
    return this.loginPortal('admin', dto, context);
  }

  public loginOperations(dto: PortalLoginDto, context: AuditContext): Promise<PortalLoginResponse> {
    return this.loginPortal('operations', dto, context);
  }

  private async loginPortal(
    portal: PortalLoginType,
    dto: PortalLoginDto,
    context: AuditContext,
  ): Promise<PortalLoginResponse> {
    const config = PORTAL_LOGIN_CONFIG[portal];
    const identifier = this.resolveIdentifier(dto);

    await this.loginAttemptService.assertNotLocked(identifier, context.ipAddress);

    await this.auditService.record(AUTH_AUDIT_ACTIONS.LOGIN_STARTED, context, {
      metadata: { portal, identifierType: dto.email ? 'email' : 'phone' },
    });

    const user = await this.resolveUser(dto);
    const passwordHash = user?.passwordHash ?? TIMING_SAFE_DUMMY_HASH;
    const passwordValid = await bcrypt.compare(dto.password, passwordHash);

    if (!user || !passwordValid) {
      await this.handleFailedLogin(identifier, context, portal, 'invalid_credentials', user?.id);
      throw new UnauthorizedDomainException('Invalid email or password');
    }

    try {
      this.assertAccountEligible(user, config);
      const matchedRole = await this.assertPortalAccess(user.id, config.roleNames, portal);

      await this.usersService.recordLoginActivity(user.id);
      await this.loginAttemptService.resetFailures(identifier, context.ipAddress);

      const profile = await this.toProfile(user.id);
      const session = await this.sessionService.createPortalSession({
        userId: user.id,
        portal: config.channel,
        context: { ...context, userId: user.id },
      });

      const tokens = await this.tokenService.issueTokenPair({
        userId: user.id,
        sessionId: session.id,
        role: matchedRole,
        portal: config.channel,
      });

      const refreshTokenHash = this.tokenService.hashRefreshToken(tokens.refreshToken);
      await this.authSessionRepository.updateRefreshTokenHash({
        sessionId: session.id,
        refreshTokenHash,
      });

      await this.auditService.record(
        AUTH_AUDIT_ACTIONS.LOGIN_SUCCESS,
        { ...context, userId: user.id },
        { resource: 'user', resourceId: user.id, metadata: { portal } },
      );

      return {
        user: profile,
        session,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        tokenType: tokens.tokenType,
      };
    } catch (error) {
      if (error instanceof UnauthorizedDomainException) {
        throw error;
      }

      const reason = error instanceof Error ? error.constructor.name : 'login_rejected';
      await this.handleFailedLogin(identifier, context, portal, reason, user.id);
      throw error;
    }
  }

  private resolveIdentifier(dto: PortalLoginDto): string {
    if (dto.email) {
      return dto.email.trim().toLowerCase();
    }
    if (dto.phone) {
      return dto.phone.trim();
    }
    throw new ValidationDomainException('Email or phone is required');
  }

  private async resolveUser(dto: PortalLoginDto): Promise<User | null> {
    if (dto.email) {
      return await this.usersService.findByEmail(dto.email.trim().toLowerCase());
    }
    if (dto.phone) {
      return await this.usersService.findByPhone(dto.phone.trim());
    }
    return null;
  }

  private assertAccountEligible(user: User, config: PortalLoginConfig): void {
    if (user.deletedAt) {
      throw new UnauthorizedDomainException('Invalid email or password');
    }

    if (user.status === UserStatus.PENDING_VERIFICATION) {
      throw new EmailNotVerifiedDomainException('Account verification is incomplete');
    }

    if (user.status === UserStatus.BLOCKED) {
      throw new AccountBlockedDomainException();
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new AccountSuspendedDomainException();
    }

    if (user.status === UserStatus.INACTIVE) {
      throw new ForbiddenDomainException('Account is not permitted to sign in', {
        status: user.status,
      });
    }

    // DPX-DRIVER-010 — phone-only accounts register with a synthetic internal
    // email that is auto-verified for activation (never a real send). They
    // verify their PHONE, not an email, so the email-verified gate must not
    // block them; the status checks above already guarantee the account is
    // ACTIVE (i.e. the phone was verified) before reaching here.
    if (!user.emailVerifiedAt && !isSyntheticEmail(user.email)) {
      throw new EmailNotVerifiedDomainException();
    }

    // While PORTAL_EMAIL_ACTIVATION is on (Termii SMS sender-ID pending), the
    // merchant/driver/rider portals activate and sign in on EMAIL verification
    // alone — phone verification is not required to log in. Restoring the flag
    // to false re-enforces mandatory phone verification for those portals.
    const requiresPhoneVerification =
      config.requiresPhoneVerification && !this.appConfig.portalEmailActivation;
    if (requiresPhoneVerification && !user.phoneVerifiedAt) {
      throw new PhoneNotVerifiedDomainException();
    }
  }

  /**
   * Admits the user if they hold any of the portal's permitted roles and
   * returns the specific matched role (config order breaks ties). The returned
   * role is stamped into the issued token, so it must be a role the user
   * actually holds — the JWT strategy rejects a token whose `role` claim is not
   * among the user's roles.
   */
  private async assertPortalAccess(
    userId: string,
    allowedRoles: string[],
    portal: PortalLoginType,
  ): Promise<string> {
    const userWithRbac = await this.usersService.findByIdWithRbac(userId);
    const roles = userWithRbac?.roles.map((assignment) => assignment.role.name) ?? [];

    const matchedRole = allowedRoles.find((role) => roles.includes(role));
    if (matchedRole === undefined) {
      throw new WrongPortalDomainException('Account is not permitted for this portal', { portal });
    }

    return matchedRole;
  }

  private async handleFailedLogin(
    identifier: string,
    context: AuditContext,
    portal: PortalLoginType,
    reason: string,
    userId?: string,
  ): Promise<void> {
    await this.loginAttemptService.recordFailure(identifier, context.ipAddress);

    const auditContext: AuditContext = userId !== undefined ? { ...context, userId } : context;
    await this.auditService.record(AUTH_AUDIT_ACTIONS.LOGIN_FAILED, auditContext, {
      resource: 'user',
      ...(userId !== undefined ? { resourceId: userId } : {}),
      metadata: { portal, reason },
    });
  }

  private async toProfile(userId: string): Promise<AuthUserProfile> {
    const user = await this.usersService.findByIdWithRbac(userId);
    if (!user) {
      throw new UnauthorizedDomainException('Invalid email or password');
    }

    const roles = user.roles.map((assignment) => assignment.role.name);
    const permissions = [
      ...new Set(
        user.roles.flatMap((assignment) =>
          assignment.role.permissions.map((grant) => grant.permission.code),
        ),
      ),
    ];

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      roles,
      permissions,
    };
  }
}
