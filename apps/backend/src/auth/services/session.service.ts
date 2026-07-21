import { Inject, Injectable } from '@nestjs/common';
import { RegistrationChannel } from '@prisma/client';

import { AUTH_AUDIT_ACTIONS } from '../../audit/audit.constants';
import { AuditService } from '../../audit/audit.service';
import { AppConfigService } from '../../config/app-config.service';
import {
  AUTH_SESSION_REPOSITORY,
  type AuthSessionRepository,
} from '../repositories/auth-session.repository';
import { registrationChannelToPortal } from '../utils/portal.util';

import type { AuditContext } from '../../audit/audit.service';
import type { LoginSessionMetadata } from '../auth-login.types';

export interface CreatePortalSessionInput {
  userId: string;
  portal: RegistrationChannel;
  context: AuditContext;
}

@Injectable()
export class SessionService {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly authSessionRepository: AuthSessionRepository,
    private readonly auditService: AuditService,
    private readonly appConfig: AppConfigService,
  ) {}

  public async createPortalSession(input: CreatePortalSessionInput): Promise<LoginSessionMetadata> {
    const expiresAt = new Date(Date.now() + this.appConfig.sessionTtlSeconds * 1000);

    const session = await this.authSessionRepository.create({
      userId: input.userId,
      portal: input.portal,
      expiresAt,
      ...(input.context.ipAddress !== undefined ? { ipAddress: input.context.ipAddress } : {}),
      ...(input.context.userAgent !== undefined ? { userAgent: input.context.userAgent } : {}),
    });

    await this.auditService.record(
      AUTH_AUDIT_ACTIONS.SESSION_CREATED,
      { ...input.context, userId: input.userId },
      {
        resource: 'auth_session',
        resourceId: session.id,
        metadata: { portal: input.portal },
      },
    );

    return this.toSessionMetadata(session);
  }

  private toSessionMetadata(session: {
    id: string;
    portal: RegistrationChannel;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
    lastActiveAt: Date;
    expiresAt: Date;
  }): LoginSessionMetadata {
    return {
      id: session.id,
      portal: registrationChannelToPortal(session.portal),
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      createdAt: session.createdAt.toISOString(),
      lastActiveAt: session.lastActiveAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    };
  }
}
