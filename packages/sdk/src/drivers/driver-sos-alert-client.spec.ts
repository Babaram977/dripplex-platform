import { describe, expect, it, vi } from 'vitest';

import { DriverSosAlertClient } from './driver-sos-alert-client.js';

import type { HttpClient } from '../client/http-client.js';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

describe('DriverSosAlertClient', () => {
  it('listOwn() gets /driver/sos-alerts with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new DriverSosAlertClient(http);

    await client.listOwn();

    expect(request).toHaveBeenCalledWith('/driver/sos-alerts', {
      method: 'GET',
      auth: true,
    });
  });

  it('getOwn() gets /driver/sos-alerts/:id with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new DriverSosAlertClient(http);

    await client.getOwn('alert-1');

    expect(request).toHaveBeenCalledWith('/driver/sos-alerts/alert-1', {
      method: 'GET',
      auth: true,
    });
  });

  it('trigger() posts to /driver/sos-alerts with auth, defaulting to an empty body', async () => {
    const { http, request } = createHttpMock();
    const client = new DriverSosAlertClient(http);

    await client.trigger();

    expect(request).toHaveBeenCalledWith('/driver/sos-alerts', {
      method: 'POST',
      body: {},
      auth: true,
    });
  });

  it('trigger() forwards optional GPS/battery fields', async () => {
    const { http, request } = createHttpMock();
    const client = new DriverSosAlertClient(http);

    const body = { latitude: 6.5244, longitude: 3.3792, batteryLevel: 42 };
    await client.trigger(body);

    expect(request).toHaveBeenCalledWith('/driver/sos-alerts', {
      method: 'POST',
      body,
      auth: true,
    });
  });
});
