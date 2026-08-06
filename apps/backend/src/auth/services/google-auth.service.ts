import { randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { RegistrationChannel, UserStatus, type User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { AUTH_AUDIT_ACTIONS } from '../../audit/audit.constants';
import { AuditService } from '../../audit/audit.service';
import { UnauthorizedDomainException } from '../../common/exceptions/domain.exception';
import { AppConfigService } from '../../config/app-config.service';
import { RedisService } from '../../redis/redis.service';
import { UsersService } from '../../users/users.service';
import {
  AUTH_SESSION_REPOSITORY,
  type AuthSessionRepository,
} from '../repositories/auth-session.repository';
import {
  REGISTRATION_REPOSITORY,
  type RegistrationRepository,
} from '../repositories/registration.repository';

import { SessionService } from './session.service';
import { TokenService } from './token.service';

import type { AuditContext } from '../../audit/audit.service';
import type { GoogleProfileData } from '../auth-google.types';
import type { AuthUserProfile, PortalLoginResponse } from '../auth-login.types';

const HANDOFF_CODE_TTL_SECONDS = 60;
const HANDOFF_KEY_PREFIX = 'auth:google:handoff:';

@Injectable()
export class GoogleAuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly sessionService: SessionService,
    private readonly tokenService: TokenService,
    private readonly auditService: AuditService,
    private readonly appConfig: AppConfigService,
    private readonly redisService: RedisService,
    @Inject(REGISTRATION_REPOSITORY)
    private readonly registrationRepository: RegistrationRepository,
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly authSessionRepository: AuthSessionRepository,
  ) {}

  /**
   * Called from GET /auth/google/callback once passport-google-oauth20 has
   * already exchanged the code and verified the profile with Google. Finds
   * or creates the customer account, issues a real access/refresh token pair
   * via the existing JWT/session architecture, and stashes the login
   * response behind a short-lived single-use handoff code.
   *
   * The SDK's HTTP client is Bearer-token based, not cookie based (tokens are
   * attached via an Authorization header, managed client-side) — so real
   * JWTs are never embedded in this browser-redirect URL. The frontend reads
   * the returned code off the query string and immediately exchanges it via
   * POST /auth/google/exchange for the actual token pair.
   */
  public async completeSignIn(profile: GoogleProfileData, context: AuditContext): Promise<string> {
    await this.auditService.record(AUTH_AUDIT_ACTIONS.GOOGLE_LOGIN_STARTED, context, {
      metadata: { email: profile.email },
    });

    try {
      const user = await this.findOrCreateUser(profile, context);

      if (user.deletedAt || user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedDomainException(
          'This account is not permitted to sign in with Google at this time',
        );
      }

      await this.usersService.recordLoginActivity(user.id);

      // The AuthSession/JWT "portal" is always the canonical CUSTOMER_WEB
      // channel — CUSTOMER_WEB_GOOGLE is only used as the user's original
      // registrationChannel (attribution). JwtStrategy maps the JWT's
      // 'customer' portal claim back to RegistrationChannel.CUSTOMER_WEB, so
      // using the _GOOGLE variant here would fail every subsequent request
      // with a "Portal mismatch" error.
      const session = await this.sessionService.createPortalSession({
        userId: user.id,
        portal: RegistrationChannel.CUSTOMER_WEB,
        context: { ...context, userId: user.id },
      });

      const tokens = await this.tokenService.issueTokenPair({
        userId: user.id,
        sessionId: session.id,
        role: 'customer',
        portal: RegistrationChannel.CUSTOMER_WEB,
      });

      const refreshTokenHash = this.tokenService.hashRefreshToken(tokens.refreshToken);
      await this.authSessionRepository.updateRefreshTokenHash({
        sessionId: session.id,
        refreshTokenHash,
      });

      const response: PortalLoginResponse = {
        user: await this.toProfile(user.id),
        session,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        tokenType: tokens.tokenType,
      };

      const code = randomBytes(32).toString('hex');
      await this.redisService.set(
        `${HANDOFF_KEY_PREFIX}${code}`,
        JSON.stringify(response),
        HANDOFF_CODE_TTL_SECONDS,
      );

      await this.auditService.record(
        AUTH_AUDIT_ACTIONS.GOOGLE_LOGIN_SUCCESS,
        { ...context, userId: user.id },
        { resource: 'user', resourceId: user.id },
      );

      return code;
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'google_login_failed';
      await this.auditService.record(AUTH_AUDIT_ACTIONS.GOOGLE_LOGIN_FAILED, context, {
        metadata: { email: profile.email, reason },
      });
      throw error;
    }
  }

  /**
   * Single-use exchange: the handoff code is deleted as soon as it is read,
   * regardless of outcome, so a leaked or replayed code (e.g. from browser
   * history) can never be redeemed twice.
   */
  public async exchangeHandoffCode(code: string): Promise<PortalLoginResponse> {
    const key = `${HANDOFF_KEY_PREFIX}${code}`;
    const raw = await this.redisService.get(key);
    await this.redisService.del(key);

    if (!raw) {
      throw new UnauthorizedDomainException('Google sign-in code is invalid or has expired');
    }

    return JSON.parse(raw) as PortalLoginResponse;
  }

  /**
   * Account-linking order: googleId match (returning Google user) → email
   * match (link Google to an existing email/phone account, using Google's
   * verified email as proof to skip the usual OTP step) → create a brand new
   * customer account. This avoids duplicate accounts for users who already
   * registered with the same email via password.
   */
  private async findOrCreateUser(profile: GoogleProfileData, context: AuditContext): Promise<User> {
    const byGoogleId = await this.usersService.findByGoogleId(profile.googleId);
    if (byGoogleId) {
      return byGoogleId;
    }

    const byEmail = await this.usersService.findByEmail(profile.email);
    if (byEmail) {
      let linked = await this.usersService.linkGoogleId(byEmail.id, profile.googleId);

      if (!linked.emailVerifiedAt && profile.emailVerified) {
        await this.usersService.markEmailVerified(linked.id);
        linked = await this.usersService.activateIfVerificationsComplete(linked.id, false);
      }

      await this.auditService.record(
        AUTH_AUDIT_ACTIONS.GOOGLE_ACCOUNT_LINKED,
        { ...context, userId: linked.id },
        { resource: 'user', resourceId: linked.id },
      );

      return linked;
    }

    // Google-originated accounts never authenticate with a password, but the
    // column is required — hash a random secret so the value is a
    // well-formed bcrypt hash. This guarantees a stray email/password login
    // attempt on this account fails a bcrypt.compare() cleanly (returns
    // false) instead of throwing on a malformed hash.
    const passwordHash = await bcrypt.hash(
      randomBytes(32).toString('hex'),
      this.appConfig.bcryptSaltRounds,
    );

    const result = await this.registrationRepository.registerPortalUser({
      email: profile.email,
      passwordHash,
      firstName: profile.firstName,
      lastName: profile.lastName,
      status: profile.emailVerified ? UserStatus.ACTIVE : UserStatus.PENDING_VERIFICATION,
      registrationChannel: RegistrationChannel.CUSTOMER_WEB_GOOGLE,
      roleName: 'customer',
      portal: 'customer',
      googleId: profile.googleId,
      ...(profile.emailVerified ? { emailVerifiedAt: new Date() } : {}),
    });

    await this.auditService.record(
      AUTH_AUDIT_ACTIONS.GOOGLE_ACCOUNT_CREATED,
      { ...context, userId: result.userId },
      { resource: 'user', resourceId: result.userId },
    );

    return await this.usersService.getByIdOrThrow(result.userId);
  }

  private async toProfile(userId: string): Promise<AuthUserProfile> {
    const user = await this.usersService.findByIdWithRbac(userId);
    if (!user) {
      throw new UnauthorizedDomainException('User not found');
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
