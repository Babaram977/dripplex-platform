import { describe, expect, it, vi } from 'vitest';

import { AdminDriversClient } from './admin-drivers-client.js';

import type { HttpClient } from '../client/http-client.js';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

describe('AdminDriversClient', () => {
  it('getActivationEligibility() gets /admin/driver/:id/activation-eligibility with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new AdminDriversClient(http);

    await client.getActivationEligibility('driver-1');

    expect(request).toHaveBeenCalledWith('/admin/driver/driver-1/activation-eligibility', {
      method: 'GET',
      auth: true,
    });
  });

  it('listDrivers() gets /admin/drivers with a serialized query and auth', async () => {
    const { http, request } = createHttpMock();
    const client = new AdminDriversClient(http);

    await client.listDrivers({ page: 2, limit: 20, status: 'UNDER_REVIEW' });

    expect(request).toHaveBeenCalledWith('/admin/drivers?page=2&limit=20&status=UNDER_REVIEW', {
      method: 'GET',
      auth: true,
    });
  });

  it('listDrivers() omits undefined query params (no query string when empty)', async () => {
    const { http, request } = createHttpMock();
    const client = new AdminDriversClient(http);

    await client.listDrivers();

    expect(request).toHaveBeenCalledWith('/admin/drivers', { method: 'GET', auth: true });
  });

  it('getDriver() gets /admin/driver/:id with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new AdminDriversClient(http);

    await client.getDriver('driver-1');

    expect(request).toHaveBeenCalledWith('/admin/driver/driver-1', { method: 'GET', auth: true });
  });

  it('approveDriver() posts to /admin/driver/:id/approve with no body and auth', async () => {
    const { http, request } = createHttpMock();
    const client = new AdminDriversClient(http);

    await client.approveDriver('driver-1');

    expect(request).toHaveBeenCalledWith('/admin/driver/driver-1/approve', {
      method: 'POST',
      auth: true,
    });
  });

  it('rejectDriver() posts to /admin/driver/:id/reject with a reason body and auth', async () => {
    const { http, request } = createHttpMock();
    const client = new AdminDriversClient(http);

    await client.rejectDriver('driver-1', 'Documents do not match applicant.');

    expect(request).toHaveBeenCalledWith('/admin/driver/driver-1/reject', {
      method: 'POST',
      body: { reason: 'Documents do not match applicant.' },
      auth: true,
    });
  });

  it('suspendDriver() posts to /admin/driver/:id/suspend with a reason body and auth', async () => {
    const { http, request } = createHttpMock();
    const client = new AdminDriversClient(http);

    await client.suspendDriver('driver-1', 'Multiple unresolved safety incidents.');

    expect(request).toHaveBeenCalledWith('/admin/driver/driver-1/suspend', {
      method: 'POST',
      body: { reason: 'Multiple unresolved safety incidents.' },
      auth: true,
    });
  });

  it('reactivateDriver() posts to /admin/driver/:id/reactivate with no body and auth', async () => {
    const { http, request } = createHttpMock();
    const client = new AdminDriversClient(http);

    await client.reactivateDriver('driver-1');

    expect(request).toHaveBeenCalledWith('/admin/driver/driver-1/reactivate', {
      method: 'POST',
      auth: true,
    });
  });

  it('verifyKyc() posts to /admin/driver/kyc/:kycId/verify with no body when no remarks', async () => {
    const { http, request } = createHttpMock();
    const client = new AdminDriversClient(http);

    await client.verifyKyc('kyc-1');

    expect(request).toHaveBeenCalledWith('/admin/driver/kyc/kyc-1/verify', {
      method: 'POST',
      auth: true,
    });
  });

  it('verifyKyc() includes a remarks body when provided', async () => {
    const { http, request } = createHttpMock();
    const client = new AdminDriversClient(http);

    await client.verifyKyc('kyc-1', 'Looks good.');

    expect(request).toHaveBeenCalledWith('/admin/driver/kyc/kyc-1/verify', {
      method: 'POST',
      body: { remarks: 'Looks good.' },
      auth: true,
    });
  });

  it('rejectKyc() posts to /admin/driver/kyc/:kycId/reject with a remarks body', async () => {
    const { http, request } = createHttpMock();
    const client = new AdminDriversClient(http);

    await client.rejectKyc('kyc-1', 'Document is blurry and unreadable.');

    expect(request).toHaveBeenCalledWith('/admin/driver/kyc/kyc-1/reject', {
      method: 'POST',
      body: { remarks: 'Document is blurry and unreadable.' },
      auth: true,
    });
  });
});
