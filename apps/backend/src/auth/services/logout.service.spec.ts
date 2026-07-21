import { AUTH_AUDIT_ACTIONS } from '../../audit/audit.constants';

import { LogoutService } from './logout.service';

import type { AuditService } from '../../audit/audit.service';
import type { AuthSessionRepository } from '../repositories/auth-session.repository';

describe('LogoutService', () => {
  const authSessionRepository = {
    findById: jest.fn(),
    revokeSession: jest.fn(),
    revokeAllForUser: jest.fn(),
  } as unknown as jest.Mocked<AuthSessionRepository>;

  const auditService = {
    record: jest.fn(),
  } as unknown as jest.Mocked<AuditService>;

  const service = new LogoutService(authSessionRepository, auditService);

  const sessionId = '22222222-2222-2222-2222-222222222222';
  const userId = '11111111-1111-1111-1111-111111111111';

  beforeEach(() => {
    jest.clearAllMocks();
    (auditService.record as jest.Mock).mockResolvedValue(undefined);
    (authSessionRepository.findById as jest.Mock).mockResolvedValue({
      id: sessionId,
      userId,
      revokedAt: null,
    });
    (authSessionRepository.revokeSession as jest.Mock).mockResolvedValue({});
    (authSessionRepository.revokeAllForUser as jest.Mock).mockResolvedValue(2);
  });

  it('revokes current session on logout', async () => {
    await service.logout(sessionId, userId, {});

    expect(authSessionRepository.revokeSession).toHaveBeenCalledWith(sessionId);
    expect(auditService.record).toHaveBeenCalledWith(
      AUTH_AUDIT_ACTIONS.LOGOUT,
      expect.objectContaining({ userId }),
      expect.any(Object),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      AUTH_AUDIT_ACTIONS.SESSION_REVOKED,
      expect.objectContaining({ userId }),
      expect.any(Object),
    );
  });

  it('revokes all sessions on logout-all', async () => {
    await service.logoutAll(userId, {});

    expect(authSessionRepository.revokeAllForUser).toHaveBeenCalledWith(userId);
    expect(auditService.record).toHaveBeenCalledWith(
      AUTH_AUDIT_ACTIONS.LOGOUT_ALL,
      expect.objectContaining({ userId }),
      expect.objectContaining({ metadata: { revokedSessionCount: 2 } }),
    );
  });

  it('is idempotent when session already revoked', async () => {
    (authSessionRepository.findById as jest.Mock).mockResolvedValue({
      id: sessionId,
      userId,
      revokedAt: new Date(),
    });

    await service.logout(sessionId, userId, {});

    expect(authSessionRepository.revokeSession).not.toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      AUTH_AUDIT_ACTIONS.LOGOUT,
      expect.objectContaining({ userId }),
      expect.any(Object),
    );
  });
});
