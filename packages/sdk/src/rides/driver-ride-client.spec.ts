import { describe, expect, it, vi } from 'vitest';

import { DriverRideClient } from './driver-ride-client.js';

import type { HttpClient } from '../client/http-client.js';

function createHttpMock(): { http: HttpClient; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn().mockResolvedValue({});
  return { http: { request } as unknown as HttpClient, request };
}

describe('DriverRideClient', () => {
  it('listOwnRides() gets /driver/rides with query params and auth', async () => {
    const { http, request } = createHttpMock();
    const client = new DriverRideClient(http);

    await client.listOwnRides({ page: 2, limit: 10, status: 'COMPLETED' });

    expect(request).toHaveBeenCalledWith('/driver/rides?page=2&limit=10&status=COMPLETED', {
      method: 'GET',
      auth: true,
    });
  });

  it('listOwnRides() gets /driver/rides with no query params by default', async () => {
    const { http, request } = createHttpMock();
    const client = new DriverRideClient(http);

    await client.listOwnRides();

    expect(request).toHaveBeenCalledWith('/driver/rides', { method: 'GET', auth: true });
  });

  it('updateAvailability() posts to /driver/rides/availability with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new DriverRideClient(http);

    const body = {
      online: true,
      acceptingRides: true,
      vehicleType: 'ECONOMY' as const,
      latitude: 6.6018,
      longitude: 3.3515,
    };
    await client.updateAvailability(body);

    expect(request).toHaveBeenCalledWith('/driver/rides/availability', {
      method: 'POST',
      body,
      auth: true,
    });
  });

  it('getAvailability() gets /driver/rides/availability with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new DriverRideClient(http);

    await client.getAvailability();

    expect(request).toHaveBeenCalledWith('/driver/rides/availability', {
      method: 'GET',
      auth: true,
    });
  });

  it('getActiveRide() gets /driver/rides/active with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new DriverRideClient(http);

    await client.getActiveRide();

    expect(request).toHaveBeenCalledWith('/driver/rides/active', { method: 'GET', auth: true });
  });

  it('listOffers() gets /driver/rides/offers with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new DriverRideClient(http);

    await client.listOffers();

    expect(request).toHaveBeenCalledWith('/driver/rides/offers', { method: 'GET', auth: true });
  });

  it('getOfferPreview() gets /driver/rides/offers/:id with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new DriverRideClient(http);

    await client.getOfferPreview('offer-1');

    expect(request).toHaveBeenCalledWith('/driver/rides/offers/offer-1', {
      method: 'GET',
      auth: true,
    });
  });

  it('acceptOffer() posts to /driver/rides/offers/:id/accept with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new DriverRideClient(http);

    await client.acceptOffer('offer-1');

    expect(request).toHaveBeenCalledWith('/driver/rides/offers/offer-1/accept', {
      method: 'POST',
      auth: true,
    });
  });

  it('declineOffer() posts to /driver/rides/offers/:id/decline with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new DriverRideClient(http);

    await client.declineOffer('offer-1');

    expect(request).toHaveBeenCalledWith('/driver/rides/offers/offer-1/decline', {
      method: 'POST',
      auth: true,
    });
  });

  it('markArrived() posts to /driver/rides/:id/arrive with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new DriverRideClient(http);

    await client.markArrived('ride-1');

    expect(request).toHaveBeenCalledWith('/driver/rides/ride-1/arrive', {
      method: 'POST',
      auth: true,
    });
  });

  it('startTrip() posts to /driver/rides/:id/start with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new DriverRideClient(http);

    await client.startTrip('ride-1');

    expect(request).toHaveBeenCalledWith('/driver/rides/ride-1/start', {
      method: 'POST',
      auth: true,
    });
  });

  it('completeTrip() posts to /driver/rides/:id/complete with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new DriverRideClient(http);

    await client.completeTrip('ride-1');

    expect(request).toHaveBeenCalledWith('/driver/rides/ride-1/complete', {
      method: 'POST',
      auth: true,
    });
  });

  it('cancelTrip() posts to /driver/rides/:id/cancel with an optional reason', async () => {
    const { http, request } = createHttpMock();
    const client = new DriverRideClient(http);

    await client.cancelTrip('ride-1', 'customer no-show');

    expect(request).toHaveBeenCalledWith('/driver/rides/ride-1/cancel', {
      method: 'POST',
      body: { reason: 'customer no-show' },
      auth: true,
    });
  });

  it('cancelTrip() omits the reason field when none is given', async () => {
    const { http, request } = createHttpMock();
    const client = new DriverRideClient(http);

    await client.cancelTrip('ride-1');

    expect(request).toHaveBeenCalledWith('/driver/rides/ride-1/cancel', {
      method: 'POST',
      body: {},
      auth: true,
    });
  });

  it('confirmCash() posts to /driver/rides/:id/cash-confirm with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new DriverRideClient(http);

    await client.confirmCash('ride-1');

    expect(request).toHaveBeenCalledWith('/driver/rides/ride-1/cash-confirm', {
      method: 'POST',
      auth: true,
    });
  });

  it('rateCustomer() posts to /driver/rides/:id/rate-customer with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new DriverRideClient(http);

    const body = { rating: 5, comment: 'Great passenger' };
    await client.rateCustomer('ride-1', body);

    expect(request).toHaveBeenCalledWith('/driver/rides/ride-1/rate-customer', {
      method: 'POST',
      body,
      auth: true,
    });
  });

  it('listRideRatings() gets /driver/rides/:id/ratings with auth', async () => {
    const { http, request } = createHttpMock();
    const client = new DriverRideClient(http);

    await client.listRideRatings('ride-1');

    expect(request).toHaveBeenCalledWith('/driver/rides/ride-1/ratings', {
      method: 'GET',
      auth: true,
    });
  });
});
