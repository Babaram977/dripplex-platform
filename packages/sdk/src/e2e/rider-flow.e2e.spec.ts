import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRiderSdk } from '../sdk-rider.js';

import { installFetchMock, jsonErr, jsonOk, pathsOf, sampleTokens } from './helpers.js';

beforeEach(() => {
  vi.useRealTimers();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const riderUser = {
  id: 'rider-user-1',
  email: 'rider@example.com',
  phone: '+2348088887777',
  firstName: 'Bola',
  lastName: 'Ade',
  status: 'ACTIVE' as const,
  roles: ['RIDER'],
  permissions: ['delivery:update', 'wallet:read'],
};

describe('C2 Rider flow (SDK contract E2E)', () => {
  it('logs in, goes online, accepts, navigates, picks up, delivers, wallet', async () => {
    const { fetchMock, calls } = installFetchMock();
    const jobId = 'job-1';
    fetchMock
      .mockResolvedValueOnce(
        jsonOk({
          user: riderUser,
          session: {
            id: 'sess-r',
            portal: 'rider',
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
      .mockResolvedValueOnce(
        jsonOk({
          riderId: 'rider-1',
          available: true,
          latitude: 6.5,
          longitude: 3.3,
          updatedAt: new Date().toISOString(),
        }),
      )
      .mockResolvedValueOnce(jsonOk([{ id: jobId, status: 'AVAILABLE', orderId: 'order-1' }]))
      .mockResolvedValueOnce(jsonOk({ id: jobId, status: 'ACCEPTED', orderId: 'order-1' }))
      .mockResolvedValueOnce(
        jsonOk({
          id: 'trk-1',
          jobId,
          latitude: 6.51,
          longitude: 3.31,
          recordedAt: new Date().toISOString(),
        }),
      )
      .mockResolvedValueOnce(jsonOk({ id: jobId, status: 'PICKED_UP', orderId: 'order-1' }))
      .mockResolvedValueOnce(jsonOk({ id: jobId, status: 'ARRIVED', orderId: 'order-1' }))
      .mockResolvedValueOnce(jsonOk({ id: jobId, status: 'DELIVERED', orderId: 'order-1' }))
      .mockResolvedValueOnce(
        jsonOk({
          id: 'w-r',
          ownerType: 'RIDER',
          ownerId: 'rider-1',
          currency: 'NGN',
          availableBalance: 2500,
          pendingBalance: 0,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      )
      .mockResolvedValueOnce(jsonOk([{ id: jobId, status: 'DELIVERED', orderId: 'order-1' }]))
      .mockResolvedValueOnce(jsonOk({ loggedOut: true }));

    const sdk = createRiderSdk({
      baseUrl: 'https://api.test/api/v1',
      getAccessToken: () => sampleTokens.accessToken,
    });

    await sdk.auth.loginRider({ email: riderUser.email, password: 'Password1' });
    await sdk.riderDelivery.updateAvailability({
      online: true,
      acceptingOrders: true,
      latitude: 6.5,
      longitude: 3.3,
    });
    await sdk.riderDelivery.listJobs();
    await sdk.riderDelivery.accept(jobId);
    await sdk.riderDelivery.location(jobId, {
      latitude: 6.51,
      longitude: 3.31,
    });
    await sdk.riderDelivery.pickUp(jobId);
    await sdk.riderDelivery.arrived(jobId);
    await sdk.riderDelivery.deliver(jobId, { proofType: 'OTP', otp: '1234' });
    await sdk.wallet.riderWallet();
    await sdk.riderDelivery.listJobs();
    await sdk.auth.logout();

    const sequence = pathsOf(calls()).map((p) => `${p.method} ${p.path}`);
    expect(sequence).toEqual([
      'POST /auth/login/rider',
      'POST /rider/availability',
      'GET /rider/jobs',
      `POST /rider/jobs/${jobId}/accept`,
      `POST /rider/jobs/${jobId}/location`,
      `POST /rider/jobs/${jobId}/pickup`,
      `POST /rider/jobs/${jobId}/arrived`,
      `POST /rider/jobs/${jobId}/deliver`,
      'GET /rider/wallet',
      'GET /rider/jobs',
      'POST /auth/logout',
    ]);
  });

  it('maps rider reject and fail paths', async () => {
    const { fetchMock } = installFetchMock();
    fetchMock
      .mockResolvedValueOnce(jsonOk({ id: 'job-2', status: 'REJECTED' }))
      .mockResolvedValueOnce(jsonOk({ id: 'job-3', status: 'FAILED' }));

    const sdk = createRiderSdk({
      baseUrl: 'https://api.test/api/v1',
      getAccessToken: () => 'tok',
    });
    await expect(sdk.riderDelivery.reject('job-2')).resolves.toMatchObject({ status: 'REJECTED' });
    await expect(
      sdk.riderDelivery.fail('job-3', { reason: 'customer_unavailable' }),
    ).resolves.toMatchObject({ status: 'FAILED' });
  });

  it('maps 401 expired session on rider jobs to unauthorized callback after refresh fail', async () => {
    const onUnauthorized = vi.fn();
    const { fetchMock } = installFetchMock();
    fetchMock
      .mockResolvedValueOnce(jsonErr(401, 'expired', 'UNAUTHORIZED'))
      .mockResolvedValueOnce(jsonErr(401, 'refresh failed', 'UNAUTHORIZED'));

    const sdk = createRiderSdk({
      baseUrl: 'https://api.test/api/v1',
      getAccessToken: () => 'stale',
      getRefreshToken: () => 'bad-refresh',
      onTokensUpdated: vi.fn(),
      onUnauthorized,
    });

    await expect(sdk.riderDelivery.listJobs()).rejects.toMatchObject({ statusCode: 401 });
    expect(onUnauthorized).toHaveBeenCalled();
  });
});
