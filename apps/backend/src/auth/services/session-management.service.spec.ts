import { RegistrationChannel } from '@prisma/client';

import { AUTH_AUDIT_ACTIONS } from '../../audit/audit.constants';
import {
  ConflictDomainException,
  ForbiddenDomainException,
} from '../../common/exceptions/domain.exception';

import { SessionManagementService } from './session-management.service';

import type { DeviceInfoService } from './device-info.service';
import type { AuditService } from '../../audit/audit.service';
import type { AuthSessionRepository } from '../repositories/auth-session.repository';

describe('SessionManagementService', () => {
  const authSessionRepository = {
    findActiveSessions: jest.fn(),
    isOwnedByUser: jest.fn(),
    findBySessionId: jest.fn(),
    revokeSession: jest.fn(),
    revokeAllExcept: jest.fn(),
  } as unknown as jest.Mocked<AuthSessionRepository>;

  const deviceInfoService = {
    parse: jest.fn(),
  } as unknown as jest.Mocked<DeviceInfoService>;

  const auditService = {
    record: jest.fn(),
  } as unknown as jest.Mocked<AuditService>;

  const service = new SessionManagementService(
    authSessionRepository,
    deviceInfoService,
    auditService,
  );

  const userId = '11111111-1111-1111-1111-111111111111';
  const currentSessionId = '22222222-2222-2222-2222-222222222222';
  const otherSessionId = '33333333-3333-3333-3333-333333333333';

  const baseSession = {
    id: currentSessionId,
    userId,
    portal: RegistrationChannel.CUSTOMER_WEB,
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0 Chrome/126.0',
    createdAt: new Date('2026-07-21T10:00:00.000Z'),
    lastActiveAt: new Date('2026-07-21T11:00:00.000Z'),
    expiresAt: new Date('2026-07-28T10:00:00.000Z'),
    revokedAt: null,
    refreshTokenHash: 'hash',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (auditService.record as jest.Mock).mockResolvedValue(undefined);
    (deviceInfoService.parse as jest.Mock).mockReturnValue({
      browser: 'Chrome',
      operatingSystem: 'Windows',
      device: 'Windows Computer',
      deviceType: 'desktop',
    });
  });

  it('lists active sessions newest first with current flag', async () => {
    (authSessionRepository.findActiveSessions as jest.Mock).mockResolvedValue([
      baseSession,
      { ...baseSession, id: otherSessionId, createdAt: new Date('2026-07-20T10:00:00.000Z') },
    ]);

    const result = await service.listSessions(userId, currentSessionId, {});

    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.current).toBe(true);
    expect(result.items[0]?.sessionId).toBe(currentSessionId);
    expect(result.items[0]?.browser).toBe('Chrome');
    expect(result.items[0]?.location).toBeNull();
    expect(result.items[1]?.current).toBe(false);
    expect(auditService.record).toHaveBeenCalledWith(
      AUTH_AUDIT_ACTIONS.SESSION_LIST,
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('revokes a single owned session', async () => {
    (authSessionRepository.isOwnedByUser as jest.Mock).mockResolvedValue(true);
    (authSessionRepository.findBySessionId as jest.Mock).mockResolvedValue(baseSession);
    (authSessionRepository.revokeSession as jest.Mock).mockResolvedValue({
      ...baseSession,
      revokedAt: new Date(),
    });

    await service.revokeSession(userId, currentSessionId, {});

    expect(authSessionRepository.revokeSession).toHaveBeenCalledWith(currentSessionId);
    expect(auditService.record).toHaveBeenCalledWith(
      AUTH_AUDIT_ACTIONS.SESSION_REVOKED,
      expect.any(Object),
      expect.any(Object),
    );
  });

  it('rejects revoke when session is not owned', async () => {
    (authSessionRepository.isOwnedByUser as jest.Mock).mockResolvedValue(false);

    await expect(service.revokeSession(userId, otherSessionId, {})).rejects.toBeInstanceOf(
      ForbiddenDomainException,
    );
  });

  it('rejects revoke when session already revoked', async () => {
    (authSessionRepository.isOwnedByUser as jest.Mock).mockResolvedValue(true);
    (authSessionRepository.findBySessionId as jest.Mock).mockResolvedValue({
      ...baseSession,
      revokedAt: new Date(),
    });

    await expect(service.revokeSession(userId, currentSessionId, {})).rejects.toBeInstanceOf(
      ConflictDomainException,
    );
  });

  it('revokes all sessions except current', async () => {
    (authSessionRepository.revokeAllExcept as jest.Mock).mockResolvedValue(2);

    const result = await service.revokeAllExceptCurrent(userId, currentSessionId, {});

    expect(result.revokedCount).toBe(2);
    expect(authSessionRepository.revokeAllExcept).toHaveBeenCalledWith(userId, currentSessionId);
    expect(auditService.record).toHaveBeenCalledWith(
      AUTH_AUDIT_ACTIONS.SESSIONS_REVOKED_ALL,
      expect.any(Object),
      expect.objectContaining({
        metadata: expect.objectContaining({ preservedSessionId: currentSessionId }),
      }),
    );
  });
});
