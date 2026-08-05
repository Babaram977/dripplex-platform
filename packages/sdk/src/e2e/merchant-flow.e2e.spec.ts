import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMerchantSdk } from '../sdk-merchant.js';

import { installFetchMock, jsonErr, jsonOk, pathsOf, sampleTokens } from './helpers.js';

beforeEach(() => {
  vi.useRealTimers();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const merchantUser = {
  id: 'merchant-user-1',
  email: 'merchant@example.com',
  phone: '+2348099990000',
  firstName: 'Chidi',
  lastName: 'Okeke',
  status: 'ACTIVE' as const,
  roles: ['MERCHANT'],
  permissions: ['merchant:read', 'wallet:read'],
};

describe('C2 Merchant flow (SDK contract E2E)', () => {
  it('logs in and probes dashboard domains: business, kyc, wallet, analytics, reviews', async () => {
    const { fetchMock, calls } = installFetchMock();
    fetchMock
      .mockResolvedValueOnce(
        jsonOk({
          user: merchantUser,
          session: {
            id: 'sess-m',
            portal: 'merchant',
            ipAddress: null,
            userAgent: null,
            createdAt: new Date().toISOString(),
            lastActiveAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
          },
          accessToken: sampleTokens.accessToken,
          refreshToken: sampleTokens.refreshToken,
          expiresIn: sampleTokens.expiresIn,
          tokenType: 'Bearer',
        }),
      )
      .mockResolvedValueOnce(jsonOk(merchantUser))
      .mockResolvedValueOnce(
        jsonOk({
          id: 'biz-1',
          merchantId: 'm-1',
          businessName: 'Lagos Kitchen',
        }),
      )
      .mockResolvedValueOnce(jsonOk({ latest: null, items: [] }))
      .mockResolvedValueOnce(
        jsonOk({
          id: 'w-m',
          ownerType: 'MERCHANT',
          ownerId: 'm-1',
          currency: 'NGN',
          availableBalance: 0,
          pendingBalance: 0,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      )
      .mockResolvedValueOnce(jsonOk([]))
      .mockResolvedValueOnce(jsonOk({ loggedOut: true }));

    const sdk = createMerchantSdk({
      baseUrl: 'https://api.test/api/v1',
      getAccessToken: () => sampleTokens.accessToken,
    });

    await sdk.auth.loginMerchant({ email: merchantUser.email, password: 'Password1' });
    await sdk.auth.me();
    await sdk.merchant.getBusiness();
    await sdk.merchant.getKycStatus();
    await sdk.wallet.merchantWallet();
    await sdk.analytics.merchant({});
    await sdk.auth.logout();

    const sequence = pathsOf(calls()).map((p) => `${p.method} ${p.path}`);
    expect(sequence).toEqual([
      'POST /auth/login/merchant',
      'GET /auth/me',
      'GET /merchant/business',
      'GET /merchant/kyc',
      'GET /merchant/wallet',
      'GET /merchant/analytics/overview',
      'POST /auth/logout',
    ]);
  });

  it('exposes the merchant order lifecycle on sdk.orders (DPX-MERCHANT-001 Phase 1)', () => {
    // Previously documented as a Backend Core gap ("no merchant order
    // accept/prepare/ready endpoints on SDK") — MerchantOrdersController
    // was always real; only the SDK coverage was missing. Closed as
    // Phase 1 of DPX-MERCHANT-001-REALITY-AUDIT.md's approved plan. The
    // methods live on OrderClient (sdk.orders), not MerchantApi
    // (sdk.merchant), mirroring where the backend controller sits.
    const sdk = createMerchantSdk({ baseUrl: 'https://api.test/api/v1' });
    expect(sdk.orders).toBeDefined();
    expect(sdk.merchant).toBeDefined();
    const orderMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(sdk.orders));
    expect(orderMethods).toEqual(
      expect.arrayContaining([
        'merchantGetOrders',
        'merchantGetOrder',
        'merchantAcceptOrder',
        'merchantRejectOrder',
        'merchantMarkOrderReady',
        'merchantDelayOrder',
        'merchantCancelOrder',
      ]),
    );
  });

  it('maps 403 when merchant lacks permission', async () => {
    const { fetchMock } = installFetchMock();
    fetchMock.mockResolvedValueOnce(jsonErr(403, 'Forbidden', 'FORBIDDEN'));
    const sdk = createMerchantSdk({
      baseUrl: 'https://api.test/api/v1',
      getAccessToken: () => 'tok',
    });
    await expect(sdk.merchant.getBusiness()).rejects.toMatchObject({ statusCode: 403 });
  });
});
