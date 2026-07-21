import { RegistrationChannel, UserStatus } from '@prisma/client';

import { AUTH_AUDIT_ACTIONS } from '../../audit/audit.constants';
import { UnauthorizedDomainException } from '../../common/exceptions/domain.exception';

import { RefreshService } from './refresh.service';

import type { TokenService } from './token.service';
import type { AuditService } from '../../audit/audit.service';
import type { UsersService } from '../../users/users.service';
import type { AuthSessionRepository } from '../repositories/auth-session.repository';

describe('RefreshService', () => {
  const tokenService = {
    verifyRefreshToken: jest.fn(),
    refreshTokenHashesMatch: jest.fn(),
    hashRefreshToken: jest.fn(),
    issueTokenPair: jest.fn(),
  } as unknown as jest.Mocked<TokenService>;

  const authSessionRepository = {
    findById: jest.fn(),
    updateRefreshTokenHash: jest.fn(),
    revokeSession: jest.fn(),
  } as unknown as jest.Mocked<AuthSessionRepository>;

  const usersService = {
    findById: jest.fn(),
  } as unknown as jest.Mocked<UsersService>;

  const auditService = {
    record: jest.fn(),
  } as unknown as jest.Mocked<AuditService>;

  const service = new RefreshService(
    tokenService,
    authSessionRepository,
    usersService,
    auditService,
  );

  const sessionId = '22222222-2222-2222-2222-222222222222';
  const userId = '11111111-1111-1111-1111-111111111111';

  const activeSession = {
    id: sessionId,
    userId,
    refreshTokenHash: 'stored-hash',
    portal: RegistrationChannel.CUSTOMER_WEB,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
  };

  const refreshPayload = {
    sub: userId,
    sid: sessionId,
    role: 'customer',
    portal: 'customer',
    typ: 'refresh' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (auditService.record as jest.Mock).mockResolvedValue(undefined);
    (tokenService.verifyRefreshToken as jest.Mock).mockResolvedValue(refreshPayload);
    (authSessionRepository.findById as jest.Mock).mockResolvedValue(activeSession);
    (tokenService.refreshTokenHashesMatch as jest.Mock).mockReturnValue(true);
    (usersService.findById as jest.Mock).mockResolvedValue({
      id: userId,
      status: UserStatus.ACTIVE,
      deletedAt: null,
    });
    (tokenService.issueTokenPair as jest.Mock).mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      tokenType: 'Bearer',
      expiresIn: '15m',
    });
    (tokenService.hashRefreshToken as jest.Mock).mockReturnValue('new-hash');
    (authSessionRepository.updateRefreshTokenHash as jest.Mock).mockResolvedValue(activeSession);
  });

  it('rotates refresh token on success', async () => {
    const tokens = await service.refresh('valid-refresh', {});

    expect(tokens.accessToken).toBe('new-access');
    expect(tokens.refreshToken).toBe('new-refresh');
    expect(authSessionRepository.updateRefreshTokenHash).toHaveBeenCalledWith({
      sessionId,
      refreshTokenHash: 'new-hash',
    });
    expect(auditService.record).toHaveBeenCalledWith(
      AUTH_AUDIT_ACTIONS.REFRESH_SUCCESS,
      expect.objectContaining({ userId }),
      expect.any(Object),
    );
  });

  it('detects refresh token reuse and revokes session', async () => {
    (tokenService.refreshTokenHashesMatch as jest.Mock).mockReturnValue(false);

    await expect(service.refresh('old-refresh', {})).rejects.toBeInstanceOf(
      UnauthorizedDomainException,
    );

    expect(authSessionRepository.revokeSession).toHaveBeenCalledWith(sessionId);
    expect(auditService.record).toHaveBeenCalledWith(
      AUTH_AUDIT_ACTIONS.REFRESH_REUSED,
      expect.objectContaining({ userId }),
      expect.any(Object),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      AUTH_AUDIT_ACTIONS.SESSION_REVOKED,
      expect.objectContaining({ userId }),
      expect.any(Object),
    );
  });

  it('rejects revoked sessions', async () => {
    (authSessionRepository.findById as jest.Mock).mockResolvedValue({
      ...activeSession,
      revokedAt: new Date(),
    });

    await expect(service.refresh('valid-refresh', {})).rejects.toBeInstanceOf(
      UnauthorizedDomainException,
    );
  });

  it('rejects expired refresh tokens at JWT layer', async () => {
    (tokenService.verifyRefreshToken as jest.Mock).mockRejectedValue(new Error('jwt expired'));

    await expect(service.refresh('expired-refresh', {})).rejects.toBeInstanceOf(
      UnauthorizedDomainException,
    );

    expect(auditService.record).toHaveBeenCalledWith(
      AUTH_AUDIT_ACTIONS.REFRESH_FAILED,
      expect.any(Object),
      expect.objectContaining({ metadata: { reason: 'invalid_token' } }),
    );
  });

  it('rejects expired sessions', async () => {
    (authSessionRepository.findById as jest.Mock).mockResolvedValue({
      ...activeSession,
      expiresAt: new Date(Date.now() - 1_000),
    });

    await expect(service.refresh('valid-refresh', {})).rejects.toBeInstanceOf(
      UnauthorizedDomainException,
    );
  });
});
