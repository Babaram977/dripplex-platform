import { Inject, Injectable } from '@nestjs/common';

import { AUTH_AUDIT_ACTIONS } from '../../audit/audit.constants';
import { AuditService } from '../../audit/audit.service';
import {
  ConflictDomainException,
  ForbiddenDomainException,
  NotFoundDomainException,
} from '../../common/exceptions/domain.exception';
import {
  AUTH_SESSION_REPOSITORY,
  type AuthSessionRepository,
} from '../repositories/auth-session.repository';
import { registrationChannelToPortal } from '../utils/portal.util';

import { DeviceInfoService } from './device-info.service';

import type { AuditContext } from '../../audit/audit.service';
import type { DeviceInfoDto, ListSessionsResponse, SessionDto } from '@dripplex/types';
import type { AuthSession } from '@prisma/client';

@Injectable()
export class SessionManagementService {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly authSessionRepository: AuthSessionRepository,
    private readonly deviceInfoService: DeviceInfoService,
    private readonly auditService: AuditService,
  ) {}

  public async listSessions(
    userId: string,
    currentSessionId: string,
    context: AuditContext,
  ): Promise<ListSessionsResponse> {
    const sessions = await this.authSessionRepository.findActiveSessions(userId);
    const items = sessions.map((session) => this.toSessionDto(session, currentSessionId));

    await this.auditService.record(
      AUTH_AUDIT_ACTIONS.SESSION_LIST,
      { ...context, userId },
      {
        resource: 'user',
        resourceId: userId,
        metadata: { count: items.length },
      },
    );

    return { items };
  }

  public async revokeSession(
    userId: string,
    sessionId: string,
    context: AuditContext,
  ): Promise<void> {
    const owned = await this.authSessionRepository.isOwnedByUser(sessionId, userId);
    if (!owned) {
      throw new ForbiddenDomainException('Session does not belong to the authenticated user');
    }

    const session = await this.authSessionRepository.findBySessionId(sessionId);
    if (!session) {
      throw new NotFoundDomainException('Session not found');
    }

    if (session.revokedAt) {
      throw new ConflictDomainException('Session is already revoked');
    }

    await this.authSessionRepository.revokeSession(sessionId);

    await this.auditService.record(
      AUTH_AUDIT_ACTIONS.SESSION_REVOKED,
      { ...context, userId },
      {
        resource: 'auth_session',
        resourceId: sessionId,
        metadata: { reason: 'user_revoke' },
      },
    );
  }

  public async revokeAllExceptCurrent(
    userId: string,
    currentSessionId: string,
    context: AuditContext,
  ): Promise<{ revokedCount: number }> {
    const revokedCount = await this.authSessionRepository.revokeAllExcept(userId, currentSessionId);

    await this.auditService.record(
      AUTH_AUDIT_ACTIONS.SESSIONS_REVOKED_ALL,
      { ...context, userId },
      {
        resource: 'user',
        resourceId: userId,
        metadata: { revokedSessionCount: revokedCount, preservedSessionId: currentSessionId },
      },
    );

    return { revokedCount };
  }

  private toSessionDto(session: AuthSession, currentSessionId: string): SessionDto {
    const deviceInfo: DeviceInfoDto = this.deviceInfoService.parse(session.userAgent);

    return {
      sessionId: session.id,
      current: session.id === currentSessionId,
      portal: registrationChannelToPortal(session.portal),
      browser: deviceInfo.browser,
      operatingSystem: deviceInfo.operatingSystem,
      device: deviceInfo.device,
      deviceType: deviceInfo.deviceType,
      ip: session.ipAddress,
      location: null,
      createdAt: session.createdAt.toISOString(),
      lastActiveAt: session.lastActiveAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    };
  }
}
