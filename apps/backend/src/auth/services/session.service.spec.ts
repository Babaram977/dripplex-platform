import { RegistrationChannel } from '@prisma/client';

import { AUTH_AUDIT_ACTIONS } from '../../audit/audit.constants';

import { SessionService } from './session.service';

import type { AuditService } from '../../audit/audit.service';
import type { AppConfigService } from '../../config/app-config.service';
import type { AuthSessionRepository } from '../repositories/auth-session.repository';

describe('SessionService', () => {
  const authSessionRepository = {
    create: jest.fn(),
  } as unknown as jest.Mocked<AuthSessionRepository>;

  const auditService = {
    record: jest.fn(),
  } as unknown as jest.Mocked<AuditService>;

  const appConfig = {
    sessionTtlSeconds: 604_800,
  } as unknown as AppConfigService;

  const service = new SessionService(authSessionRepository, auditService, appConfig);

  beforeEach(() => {
    jest.clearAllMocks();
    (auditService.record as jest.Mock).mockResolvedValue(undefined);
    (authSessionRepository.create as jest.Mock).mockResolvedValue({
      id: 'session-id',
      portal: RegistrationChannel.CUSTOMER_WEB,
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
      createdAt: new Date('2026-07-21T08:00:00.000Z'),
      lastActiveAt: new Date('2026-07-21T08:00:00.000Z'),
      expiresAt: new Date('2026-07-28T08:00:00.000Z'),
    });
  });

  it('creates a session without refresh token hash', async () => {
    const result = await service.createPortalSession({
      userId: 'user-id',
      portal: RegistrationChannel.CUSTOMER_WEB,
      context: { ipAddress: '127.0.0.1', userAgent: 'jest', userId: 'user-id' },
    });

    expect(authSessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-id',
        portal: RegistrationChannel.CUSTOMER_WEB,
      }),
    );
    expect(result.portal).toBe('customer');
    expect(auditService.record).toHaveBeenCalledWith(
      AUTH_AUDIT_ACTIONS.SESSION_CREATED,
      expect.any(Object),
      expect.any(Object),
    );
  });
});
