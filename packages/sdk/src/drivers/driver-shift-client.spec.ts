import { describe, expect, it, vi } from 'vitest';

import { DriverShiftClient } from './driver-shift-client.js';

import type { HttpClient } from '../client/http-client.js';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

describe('DriverShiftClient', () => {
  it('listOwn() gets /driver/shifts with auth', async () => {
    const { http, request } = createHttpMock();
    await new DriverShiftClient(http).listOwn();

    expect(request).toHaveBeenCalledWith('/driver/shifts', { method: 'GET', auth: true });
  });

  it('getSummary() gets /driver/shifts/summary with auth', async () => {
    const { http, request } = createHttpMock();
    await new DriverShiftClient(http).getSummary();

    expect(request).toHaveBeenCalledWith('/driver/shifts/summary', {
      method: 'GET',
      auth: true,
    });
  });

  it('start() posts to /driver/shifts/start with auth', async () => {
    const { http, request } = createHttpMock();
    await new DriverShiftClient(http).start();

    expect(request).toHaveBeenCalledWith('/driver/shifts/start', { method: 'POST', auth: true });
  });

  it('startBreak() posts to /driver/shifts/break/start with auth', async () => {
    const { http, request } = createHttpMock();
    await new DriverShiftClient(http).startBreak();

    expect(request).toHaveBeenCalledWith('/driver/shifts/break/start', {
      method: 'POST',
      auth: true,
    });
  });

  it('endBreak() posts to /driver/shifts/break/end with auth', async () => {
    const { http, request } = createHttpMock();
    await new DriverShiftClient(http).endBreak();

    expect(request).toHaveBeenCalledWith('/driver/shifts/break/end', {
      method: 'POST',
      auth: true,
    });
  });

  it('end() posts to /driver/shifts/end with auth', async () => {
    const { http, request } = createHttpMock();
    await new DriverShiftClient(http).end();

    expect(request).toHaveBeenCalledWith('/driver/shifts/end', { method: 'POST', auth: true });
  });
});
