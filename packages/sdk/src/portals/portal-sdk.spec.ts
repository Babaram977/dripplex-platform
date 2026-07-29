import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { createAdminSdk } from '../sdk-admin.js';
import { createMerchantSdk } from '../sdk-merchant.js';
import { createRiderSdk } from '../sdk-rider.js';
import { createCustomerSdk } from '../sdk.js';

describe('portal SDK barrels', () => {
  it('exposes customer surface without leaking http internals', () => {
    const sdk = createCustomerSdk({ baseUrl: 'https://api.example.test/api/v1' });
    expect(Object.keys(sdk).sort()).toEqual(
      [
        'addresses',
        'analytics',
        'auth',
        'cart',
        'cms',
        'delivery',
        'loyalty',
        'merchants',
        'notifications',
        'orders',
        'payments',
        'products',
        'promotions',
        'reviews',
        'search',
        'wallet',
        'wishlist',
      ].sort(),
    );
    expect(sdk).not.toHaveProperty('http');
  });

  it('exposes merchant, rider, and admin surfaces', () => {
    expect(createMerchantSdk().merchant).toBeDefined();
    expect(createRiderSdk().riderDelivery).toBeDefined();
    expect(createAdminSdk().adminMerchants).toBeDefined();
    expect(createAdminSdk().adminFraud).toBeDefined();
  });
});

describe('HttpClient refresh rotation', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('retries once after successful refresh on 401', async () => {
    const onTokensUpdated = vi.fn();
    const onUnauthorized = vi.fn();
    const sdk = createCustomerSdk({
      baseUrl: 'https://api.example.test/api/v1',
      getAccessToken: () => 'stale',
      getRefreshToken: () => 'refresh-token',
      onTokensUpdated,
      onUnauthorized,
    });

    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            statusCode: 401,
            errorCode: 'UNAUTHORIZED',
            message: 'expired',
            path: '/auth/me',
            timestamp: new Date().toISOString(),
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              accessToken: 'new-access',
              refreshToken: 'new-refresh',
              tokenType: 'Bearer',
              expiresIn: '15m',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              id: 'u1',
              email: 'a@b.com',
              phone: null,
              firstName: 'A',
              lastName: 'B',
              status: 'ACTIVE',
              roles: ['CUSTOMER'],
              permissions: [],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const me = await sdk.auth.me();
    expect(me.email).toBe('a@b.com');
    expect(onTokensUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'new-access', refreshToken: 'new-refresh' }),
    );
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
