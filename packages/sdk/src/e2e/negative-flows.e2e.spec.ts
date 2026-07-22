import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DripplexNetworkError } from '../errors/network-error.js';
import { describeSdkError } from '../errors/status-messages.js';
import { createCustomerSdk } from '../sdk.js';

import { installFetchMock, jsonErr, jsonOk, sampleTokens } from './helpers.js';

beforeEach(() => {
  vi.useRealTimers();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('C2 Negative + resilience flows', () => {
  it('handles network timeout', async () => {
    const { fetchMock } = installFetchMock();
    fetchMock.mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));

    const sdk = createCustomerSdk({
      baseUrl: 'https://api.test/api/v1',
      timeoutMs: 50,
      getAccessToken: () => 'tok',
    });

    await expect(sdk.auth.me()).rejects.toEqual(
      expect.objectContaining({
        name: 'DripplexNetworkError',
        code: 'TIMEOUT',
      }),
    );
    expect(DripplexNetworkError).toBeDefined();
  });

  it('handles offline / network failure', async () => {
    const { fetchMock } = installFetchMock();
    Object.defineProperty(globalThis, 'navigator', {
      value: { onLine: false },
      configurable: true,
    });
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const sdk = createCustomerSdk({
      baseUrl: 'https://api.test/api/v1',
      getAccessToken: () => 'tok',
    });
    await expect(sdk.wallet.customerWallet()).rejects.toMatchObject({ code: 'OFFLINE' });
  });

  it('handles 429 and 500 with retryable describeSdkError', async () => {
    const { fetchMock } = installFetchMock();
    fetchMock
      .mockResolvedValueOnce(jsonErr(429, 'Too many requests', 'RATE_LIMITED'))
      .mockResolvedValueOnce(jsonErr(500, 'Internal error', 'INTERNAL'));

    const sdk = createCustomerSdk({
      baseUrl: 'https://api.test/api/v1',
      getAccessToken: () => 'tok',
    });

    const rateLimited = await sdk.notifications.list().catch((error: unknown) => error);
    expect(describeSdkError(rateLimited).retryable).toBe(true);
    expect(describeSdkError(rateLimited).statusCode).toBe(429);

    const serverError = await sdk.cms.banners().catch((error: unknown) => error);
    expect(describeSdkError(serverError).retryable).toBe(true);
    expect(describeSdkError(serverError).statusCode).toBe(500);
  });

  it('dedupes concurrent refresh on expired session (single refresh call)', async () => {
    const onTokensUpdated = vi.fn();
    const { fetchMock } = installFetchMock();
    const meAttempts = { count: 0 };
    const walletAttempts = { count: 0 };

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.includes('/auth/refresh')) {
        return Promise.resolve(
          jsonOk({
            accessToken: 'new-access',
            refreshToken: 'new-refresh',
            tokenType: 'Bearer',
            expiresIn: '15m',
          }),
        );
      }
      if (url.includes('/auth/me')) {
        meAttempts.count += 1;
        if (meAttempts.count === 1) {
          return Promise.resolve(jsonErr(401, 'expired', 'UNAUTHORIZED'));
        }
        return Promise.resolve(
          jsonOk({
            id: 'u1',
            email: 'a@b.com',
            phone: null,
            firstName: 'A',
            lastName: 'B',
            status: 'ACTIVE',
            roles: [],
            permissions: [],
          }),
        );
      }
      walletAttempts.count += 1;
      if (walletAttempts.count === 1) {
        return Promise.resolve(jsonErr(401, 'expired', 'UNAUTHORIZED'));
      }
      return Promise.resolve(
        jsonOk({
          id: 'w1',
          ownerType: 'CUSTOMER',
          ownerId: 'u1',
          currency: 'NGN',
          availableBalance: 0,
          pendingBalance: 0,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      );
    });

    const sdk = createCustomerSdk({
      baseUrl: 'https://api.test/api/v1',
      getAccessToken: () => 'stale',
      getRefreshToken: () => sampleTokens.refreshToken,
      onTokensUpdated,
    });

    await Promise.all([sdk.auth.me(), sdk.wallet.customerWallet()]);
    const refreshCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/auth/refresh'));
    expect(refreshCalls.length).toBe(1);
    expect(onTokensUpdated).toHaveBeenCalledTimes(1);
  });

  it('maps 404 for missing resources', async () => {
    const { fetchMock } = installFetchMock();
    fetchMock.mockResolvedValueOnce(jsonErr(404, 'Order not found', 'NOT_FOUND'));
    const sdk = createCustomerSdk({
      baseUrl: 'https://api.test/api/v1',
      getAccessToken: () => 'tok',
    });
    await expect(sdk.orders.getOrder('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});
