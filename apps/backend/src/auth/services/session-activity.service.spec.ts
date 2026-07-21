import { AUTH_AUDIT_ACTIONS } from '../../audit/audit.constants';

import { SessionActivityService } from './session-activity.service';

import type { AuditService } from '../../audit/audit.service';
import type { AppConfigService } from '../../config/app-config.service';
import type { RedisService } from '../../redis/redis.service';
import type { AuthSessionRepository } from '../repositories/auth-session.repository';

describe('SessionActivityService', () => {
  const authSessionRepository = {
    updateLastActive: jest.fn(),
  } as unknown as jest.Mocked<AuthSessionRepository>;

  const redis = {
    setNx: jest.fn(),
  } as unknown as jest.Mocked<RedisService>;

  const auditService = {
    record: jest.fn(),
  } as unknown as jest.Mocked<AuditService>;

  const appConfig = {
    sessionActivityThrottleSeconds: 60,
  } as unknown as AppConfigService;

  const service = new SessionActivityService(authSessionRepository, redis, auditService, appConfig);

  beforeEach(() => {
    jest.clearAllMocks();
    (auditService.record as jest.Mock).mockResolvedValue(undefined);
    (authSessionRepository.updateLastActive as jest.Mock).mockResolvedValue(undefined);
  });

  it('updates lastActive when throttle key is acquired', async () => {
    (redis.setNx as jest.Mock).mockResolvedValue(true);

    await service.touch('session-1', 'user-1');

    expect(redis.setNx).toHaveBeenCalledWith('session:last-active:session-1', '1', 60);
    expect(authSessionRepository.updateLastActive).toHaveBeenCalledWith('session-1');
    expect(auditService.record).toHaveBeenCalledWith(
      AUTH_AUDIT_ACTIONS.SESSION_ACTIVITY,
      expect.objectContaining({ userId: 'user-1' }),
      expect.any(Object),
    );
  });

  it('skips DB write when throttle key already exists', async () => {
    (redis.setNx as jest.Mock).mockResolvedValue(false);

    await service.touch('session-1', 'user-1');

    expect(authSessionRepository.updateLastActive).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });
});
