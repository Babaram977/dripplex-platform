import { AUTH_AUDIT_ACTIONS } from './audit.constants';
import { AuditService } from './audit.service';

import type { AuditLogRepository } from './repositories/audit-log.repository';

describe('AuditService', () => {
  const repository = {
    create: jest.fn(),
  } as unknown as jest.Mocked<AuditLogRepository>;

  const service = new AuditService(repository);

  beforeEach(() => {
    jest.clearAllMocks();
    (repository.create as jest.Mock).mockResolvedValue({
      id: 'audit-id',
      action: AUTH_AUDIT_ACTIONS.REGISTRATION_COMPLETED,
    });
  });

  it('records audit events with request context', async () => {
    await service.record(
      AUTH_AUDIT_ACTIONS.REGISTRATION_COMPLETED,
      { userId: 'user-id', ipAddress: '127.0.0.1', userAgent: 'jest' },
      { resource: 'user', resourceId: 'user-id' },
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUTH_AUDIT_ACTIONS.REGISTRATION_COMPLETED,
        userId: 'user-id',
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
        resource: 'user',
        resourceId: 'user-id',
      }),
    );
  });
});
