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
  roleName: string;
  channel: RegistrationChannel;
  requiresPhoneVerification: boolean;
}

const PORTAL_LOGIN_CONFIG: Record<PortalLoginType, PortalLoginConfig> = {
  customer: {
    roleName: 'customer',
    channel: RegistrationChannel.CUSTOMER_WEB,
    requiresPhoneVerification: false,
  },
  merchant: {
    roleName: 'merchant',
    channel: RegistrationChannel.MERCHANT_PORTAL,
    requiresPhoneVerification: true,
  },
  rider: {
    roleName: 'rider',
    channel: RegistrationChannel.RIDER_PORTAL,
    requiresPhoneVerification: true,
  },
  driver: {
    roleName: 'driver',
    channel: RegistrationChannel.DRIVER_PORTAL,
    requiresPhoneVerification: true,
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
      await this.assertPortalAccess(user.id, config.roleName, portal);

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
        role: config.roleName,
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

    if (config.requiresPhoneVerification && !user.phoneVerifiedAt) {
      throw new PhoneNotVerifiedDomainException();
    }
  }

  private async assertPortalAccess(
    userId: string,
    requiredRole: string,
    portal: PortalLoginType,
  ): Promise<void> {
    const userWithRbac = await this.usersService.findByIdWithRbac(userId);
    const roles = userWithRbac?.roles.map((assignment) => assignment.role.name) ?? [];

    if (!roles.includes(requiredRole)) {
      throw new WrongPortalDomainException('Account is not permitted for this portal', { portal });
    }
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
