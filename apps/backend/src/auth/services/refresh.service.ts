import { Inject, Injectable } from '@nestjs/common';
import { UserStatus } from '@prisma/client';

import { AUTH_AUDIT_ACTIONS } from '../../audit/audit.constants';
import { AuditService } from '../../audit/audit.service';
import { UnauthorizedDomainException } from '../../common/exceptions/domain.exception';
import { UsersService } from '../../users/users.service';
import {
  AUTH_SESSION_REPOSITORY,
  type AuthSessionRepository,
} from '../repositories/auth-session.repository';
import { registrationChannelToPortal } from '../utils/portal.util';

import { TokenService } from './token.service';

import type { AuditContext } from '../../audit/audit.service';
import type { AuthTokens } from '../auth.types';

@Injectable()
export class RefreshService {
  constructor(
    private readonly tokenService: TokenService,
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly authSessionRepository: AuthSessionRepository,
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  public async refresh(refreshToken: string, context: AuditContext): Promise<AuthTokens> {
    await this.auditService.record(AUTH_AUDIT_ACTIONS.REFRESH_STARTED, context, {
      metadata: { source: 'refresh_endpoint' },
    });

    let payload;
    try {
      payload = await this.tokenService.verifyRefreshToken(refreshToken);
    } catch {
      await this.auditService.record(AUTH_AUDIT_ACTIONS.REFRESH_FAILED, context, {
        metadata: { reason: 'invalid_token' },
      });
      throw new UnauthorizedDomainException('Invalid refresh token');
    }

    if (payload.typ !== 'refresh' || !payload.sid || !payload.sub) {
      await this.auditService.record(AUTH_AUDIT_ACTIONS.REFRESH_FAILED, context, {
        metadata: { reason: 'invalid_payload' },
      });
      throw new UnauthorizedDomainException('Invalid refresh token');
    }

    const session = await this.authSessionRepository.findById(payload.sid);
    if (session?.userId !== payload.sub) {
      await this.auditService.record(AUTH_AUDIT_ACTIONS.REFRESH_FAILED, context, {
        ...(payload.sub ? { resource: 'user', resourceId: payload.sub } : {}),
        metadata: { reason: 'session_not_found', sessionId: payload.sid },
      });
      throw new UnauthorizedDomainException('Invalid refresh token');
    }

    const auditContext: AuditContext = { ...context, userId: session.userId };

    if (session.revokedAt) {
      await this.auditService.record(AUTH_AUDIT_ACTIONS.REFRESH_FAILED, auditContext, {
        resource: 'auth_session',
        resourceId: session.id,
        metadata: { reason: 'session_revoked' },
      });
      throw new UnauthorizedDomainException('Refresh token has been revoked');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.auditService.record(AUTH_AUDIT_ACTIONS.REFRESH_FAILED, auditContext, {
        resource: 'auth_session',
        resourceId: session.id,
        metadata: { reason: 'session_expired' },
      });
      throw new UnauthorizedDomainException('Refresh token has expired');
    }

    if (!session.refreshTokenHash) {
      await this.auditService.record(AUTH_AUDIT_ACTIONS.REFRESH_FAILED, auditContext, {
        resource: 'auth_session',
        resourceId: session.id,
        metadata: { reason: 'missing_refresh_hash' },
      });
      throw new UnauthorizedDomainException('Invalid refresh token');
    }

    const hashMatches = this.tokenService.refreshTokenHashesMatch(
      session.refreshTokenHash,
      refreshToken,
    );

    if (!hashMatches) {
      await this.handleReuseDetected(session.id, session.userId, auditContext);
      throw new UnauthorizedDomainException('Refresh token has been revoked');
    }

    const user = await this.usersService.findById(session.userId);
    if (!user || user.deletedAt || user.status !== UserStatus.ACTIVE) {
      await this.auditService.record(AUTH_AUDIT_ACTIONS.REFRESH_FAILED, auditContext, {
        resource: 'user',
        resourceId: session.userId,
        metadata: { reason: 'user_inactive' },
      });
      throw new UnauthorizedDomainException('Invalid refresh token');
    }

    const tokens = await this.tokenService.issueTokenPair({
      userId: session.userId,
      sessionId: session.id,
      role: payload.role,
      portal: session.portal,
    });

    const newHash = this.tokenService.hashRefreshToken(tokens.refreshToken);
    await this.authSessionRepository.updateRefreshTokenHash({
      sessionId: session.id,
      refreshTokenHash: newHash,
    });

    await this.auditService.record(AUTH_AUDIT_ACTIONS.REFRESH_SUCCESS, auditContext, {
      resource: 'auth_session',
      resourceId: session.id,
      metadata: { portal: registrationChannelToPortal(session.portal) },
    });

    return tokens;
  }

  private async handleReuseDetected(
    sessionId: string,
    userId: string,
    context: AuditContext,
  ): Promise<void> {
    await this.authSessionRepository.revokeSession(sessionId);

    await this.auditService.record(AUTH_AUDIT_ACTIONS.SESSION_REVOKED, context, {
      resource: 'auth_session',
      resourceId: sessionId,
      metadata: { reason: 'refresh_reuse_detected' },
    });

    await this.auditService.record(AUTH_AUDIT_ACTIONS.REFRESH_REUSED, context, {
      resource: 'auth_session',
      resourceId: sessionId,
      metadata: { userId },
    });
  }
}
