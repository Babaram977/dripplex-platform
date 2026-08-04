import { describe, expect, it, vi } from 'vitest';

import { DriverPlannedAvailabilityClient } from './driver-planned-availability-client.js';

import type { HttpClient } from '../client/http-client.js';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

describe('DriverPlannedAvailabilityClient', () => {
  it('listOwn() gets /driver/planned-availability with auth', async () => {
    const { http, request } = createHttpMock();
    await new DriverPlannedAvailabilityClient(http).listOwn();

    expect(request).toHaveBeenCalledWith('/driver/planned-availability', {
      method: 'GET',
      auth: true,
    });
  });

  it('create() posts to /driver/planned-availability with auth', async () => {
    const { http, request } = createHttpMock();
    const body = { dayOfWeek: 1, startMinute: 480, endMinute: 1020 };
    await new DriverPlannedAvailabilityClient(http).create(body);

    expect(request).toHaveBeenCalledWith('/driver/planned-availability', {
      method: 'POST',
      body,
      auth: true,
    });
  });

  it('remove() deletes /driver/planned-availability/:id with auth', async () => {
    const { http, request } = createHttpMock();
    await new DriverPlannedAvailabilityClient(http).remove('entry-1');

    expect(request).toHaveBeenCalledWith('/driver/planned-availability/entry-1', {
      method: 'DELETE',
      auth: true,
    });
  });
});
