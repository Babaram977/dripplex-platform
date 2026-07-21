import { Inject, Injectable } from '@nestjs/common';

import { AUTH_AUDIT_ACTIONS } from '../../audit/audit.constants';
import { AuditService } from '../../audit/audit.service';
import { AppConfigService } from '../../config/app-config.service';
import { RedisService } from '../../redis/redis.service';
import {
  AUTH_SESSION_REPOSITORY,
  type AuthSessionRepository,
} from '../repositories/auth-session.repository';

const LAST_ACTIVE_KEY_PREFIX = 'session:last-active:';

@Injectable()
export class SessionActivityService {
  constructor(
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly authSessionRepository: AuthSessionRepository,
    private readonly redis: RedisService,
    private readonly auditService: AuditService,
    private readonly appConfig: AppConfigService,
  ) {}

  /**
   * Throttles DB writes for lastActiveAt using Redis key TTL (default 60s).
   */
  public async touch(sessionId: string, userId?: string): Promise<void> {
    const key = `${LAST_ACTIVE_KEY_PREFIX}${sessionId}`;
    const acquired = await this.redis.setNx(
      key,
      '1',
      this.appConfig.sessionActivityThrottleSeconds,
    );

    if (!acquired) {
      return;
    }

    await this.authSessionRepository.updateLastActive(sessionId);

    await this.auditService.record(
      AUTH_AUDIT_ACTIONS.SESSION_ACTIVITY,
      userId !== undefined ? { userId } : {},
      {
        resource: 'auth_session',
        resourceId: sessionId,
      },
    );
  }
}
