import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAdminSdk } from '../sdk-admin.js';

import { installFetchMock, jsonErr, jsonOk, pathsOf, sampleTokens } from './helpers.js';

beforeEach(() => {
  vi.useRealTimers();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const adminUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  phone: null,
  firstName: 'Ngozi',
  lastName: 'Eze',
  status: 'ACTIVE' as const,
  roles: ['ADMIN'],
  permissions: ['merchant:approve', 'fraud:review', 'analytics:read', 'cms:write', 'order:read'],
};

describe('C2 Admin flow (SDK contract E2E)', () => {
  it('logs in and covers dashboard admin domains', async () => {
    const { fetchMock, calls } = installFetchMock();
    fetchMock
      .mockResolvedValueOnce(jsonOk({ user: adminUser, tokens: sampleTokens }))
      .mockResolvedValueOnce(jsonOk(adminUser))
      .mockResolvedValueOnce(
        jsonOk({
          items: [{ id: 'm-1', businessName: 'Lagos Kitchen' }],
          meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
        }),
      )
      .mockResolvedValueOnce(jsonOk({ id: 'm-1', status: 'APPROVED' }))
      .mockResolvedValueOnce(
        jsonOk({
          items: [{ id: 'sig-1', riskLevel: 'HIGH' }],
          meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
        }),
      )
      .mockResolvedValueOnce(jsonOk({ id: 'sig-1', status: 'CLEARED' }))
      .mockResolvedValueOnce(jsonOk({ matched: 10, mismatched: 0, currency: 'NGN' }))
      .mockResolvedValueOnce(jsonOk([]))
      .mockResolvedValueOnce(
        jsonOk({
          items: [],
          meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      )
      .mockResolvedValueOnce(jsonOk({ loggedOut: true }));

    const sdk = createAdminSdk({
      baseUrl: 'https://api.test/api/v1',
      getAccessToken: () => sampleTokens.accessToken,
    });

    await sdk.auth.login({ email: adminUser.email, password: 'Password1' });
    await sdk.auth.me();
    await sdk.adminMerchants.listMerchants({ page: 1, limit: 10 });
    await sdk.adminMerchants.approve('m-1');
    await sdk.adminFraud.queue({ page: 1, pageSize: 10 });
    await sdk.adminFraud.clear('sig-1');
    await sdk.adminWallet.reconciliation({
      ownerType: 'MERCHANT',
      ownerId: 'm-1',
      currency: 'NGN',
    });
    await sdk.analytics.admin({});
    await sdk.adminCms.list({ page: 1, pageSize: 10 });
    await sdk.auth.logout();

    // Admin order monitoring is on OrderClient, not currently on admin barrel.
    expect(sdk).not.toHaveProperty('orders');
    expect(sdk.adminDelivery).toBeDefined();

    const sequence = pathsOf(calls()).map((p) => `${p.method} ${p.path}`);
    expect(sequence).toEqual([
      'POST /auth/login',
      'GET /auth/me',
      'GET /admin/merchants',
      'POST /admin/merchant/m-1/approve',
      'GET /admin/fraud/queue',
      'POST /admin/fraud/signals/sig-1/clear',
      'GET /admin/wallets/reconciliation',
      'GET /admin/analytics',
      'GET /admin/cms/contents',
      'POST /auth/logout',
    ]);
  });

  it('maps RBAC denial on fraud queue', async () => {
    const { fetchMock } = installFetchMock();
    fetchMock.mockResolvedValueOnce(jsonErr(403, 'Missing fraud:review', 'FORBIDDEN'));
    const sdk = createAdminSdk({
      baseUrl: 'https://api.test/api/v1',
      getAccessToken: () => 'tok',
    });
    await expect(sdk.adminFraud.queue()).rejects.toMatchObject({ statusCode: 403 });
  });

  it('documents Backend Core / barrel gaps for support tickets and audit log clients', () => {
    const sdk = createAdminSdk({ baseUrl: 'https://api.test/api/v1' });
    expect(sdk).not.toHaveProperty('support');
    expect(sdk).not.toHaveProperty('auditLogs');
    expect(sdk).not.toHaveProperty('customers');
  });
});
