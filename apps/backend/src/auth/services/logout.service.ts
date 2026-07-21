import { Inject, Injectable } from '@nestjs/common';

import { AUTH_AUDIT_ACTIONS } from '../../audit/audit.constants';
import { AuditService } from '../../audit/audit.service';
import {
  AUTH_SESSION_REPOSITORY,
  type AuthSessionRepository,
} from '../repositories/auth-session.repository';

import type { AuditContext } from '../../audit/audit.service';

@Injectable()
export class LogoutService {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly authSessionRepository: AuthSessionRepository,
    private readonly auditService: AuditService,
  ) {}

  public async logout(sessionId: string, userId: string, context: AuditContext): Promise<void> {
    const session = await this.authSessionRepository.findById(sessionId);
    if (session?.userId !== userId) {
      return;
    }

    if (!session.revokedAt) {
      await this.authSessionRepository.revokeSession(sessionId);
      await this.auditService.record(
        AUTH_AUDIT_ACTIONS.SESSION_REVOKED,
        { ...context, userId },
        {
          resource: 'auth_session',
          resourceId: sessionId,
          metadata: { reason: 'logout' },
        },
      );
    }

    await this.auditService.record(
      AUTH_AUDIT_ACTIONS.LOGOUT,
      { ...context, userId },
      {
        resource: 'auth_session',
        resourceId: sessionId,
      },
    );
  }

  public async logoutAll(userId: string, context: AuditContext): Promise<void> {
    const revokedCount = await this.authSessionRepository.revokeAllForUser(userId);

    await this.auditService.record(
      AUTH_AUDIT_ACTIONS.LOGOUT_ALL,
      { ...context, userId },
      {
        resource: 'user',
        resourceId: userId,
        metadata: { revokedSessionCount: revokedCount },
      },
    );
  }
}
