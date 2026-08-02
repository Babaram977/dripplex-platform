import { describe, expect, it, vi } from 'vitest';

import { CustomerRideClient } from './customer-ride-client.js';

import type { HttpClient } from '../client/http-client.js';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

describe('CustomerRideClient', () => {
  it('estimateFare() posts to /customer/rides/estimate with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new CustomerRideClient(http);

    const body = {
      rideType: 'ECONOMY' as const,
      pickupLatitude: 6.6018,
      pickupLongitude: 3.3515,
      dropoffLatitude: 6.62,
      dropoffLongitude: 3.36,
    };
    await client.estimateFare(body);

    expect(request).toHaveBeenCalledWith('/customer/rides/estimate', {
      method: 'POST',
      body,
      auth: true,
    });
  });

  it('requestRide() posts to /customer/rides with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new CustomerRideClient(http);

    const body = {
      rideType: 'ECONOMY' as const,
      pickupLatitude: 6.6018,
      pickupLongitude: 3.3515,
      dropoffLatitude: 6.62,
      dropoffLongitude: 3.36,
    };
    await client.requestRide(body);

    expect(request).toHaveBeenCalledWith('/customer/rides', {
      method: 'POST',
      body,
      auth: true,
    });
  });
});
