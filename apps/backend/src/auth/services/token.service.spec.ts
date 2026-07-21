import { type JwtService } from '@nestjs/jwt';
import { RegistrationChannel } from '@prisma/client';

import { TokenService } from './token.service';

import type { AppConfigService } from '../../config/app-config.service';

describe('TokenService', () => {
  const jwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  } as unknown as jest.Mocked<JwtService>;

  const appConfig = {
    jwtAccessSecret: 'access-secret-with-at-least-32-chars!!',
    jwtRefreshSecret: 'refresh-secret-with-at-least-32-chars!',
    jwtAccessTtl: '15m',
    jwtRefreshTtl: '7d',
  } as unknown as AppConfigService;

  const service = new TokenService(jwtService, appConfig);

  beforeEach(() => {
    jest.clearAllMocks();
    (jwtService.signAsync as jest.Mock)
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');
  });

  it('hashes refresh tokens deterministically', () => {
    const hash1 = service.hashRefreshToken('token-a');
    const hash2 = service.hashRefreshToken('token-a');
    const hash3 = service.hashRefreshToken('token-b');

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1).toHaveLength(64);
  });

  it('issues access and refresh token pair', async () => {
    const tokens = await service.issueTokenPair({
      userId: '11111111-1111-1111-1111-111111111111',
      sessionId: '22222222-2222-2222-2222-222222222222',
      role: 'customer',
      portal: RegistrationChannel.CUSTOMER_WEB,
    });

    expect(tokens.accessToken).toBe('access-token');
    expect(tokens.refreshToken).toBe('refresh-token');
    expect(tokens.tokenType).toBe('Bearer');
    expect(tokens.expiresIn).toBe('15m');

    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: '11111111-1111-1111-1111-111111111111',
        sid: '22222222-2222-2222-2222-222222222222',
        role: 'customer',
        portal: 'customer',
        typ: 'access',
      }),
      expect.objectContaining({ secret: appConfig.jwtAccessSecret }),
    );

    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        typ: 'refresh',
        portal: 'customer',
      }),
      expect.objectContaining({ secret: appConfig.jwtRefreshSecret }),
    );
  });

  it('does not include permissions in JWT claims', async () => {
    await service.issueTokenPair({
      userId: '11111111-1111-1111-1111-111111111111',
      sessionId: '22222222-2222-2222-2222-222222222222',
      role: 'customer',
      portal: RegistrationChannel.CUSTOMER_WEB,
    });

    const accessCall = (jwtService.signAsync as jest.Mock).mock.calls[0]?.[0];
    expect(accessCall).not.toHaveProperty('permissions');
    expect(accessCall).not.toHaveProperty('roles');
    expect(accessCall).not.toHaveProperty('email');
  });
});
