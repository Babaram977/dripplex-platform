import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDriverSdk } from '../sdk-driver.js';

import { installFetchMock, jsonOk, pathsOf, sampleTokens } from './helpers.js';

beforeEach(() => {
  vi.useRealTimers();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const driverUser = {
  id: 'driver-user-1',
  email: 'driver@example.com',
  phone: '+2348077776666',
  firstName: 'Chidi',
  lastName: 'Okafor',
  status: 'ACTIVE' as const,
  roles: ['DRIVER'],
  permissions: ['ride:driver:manage'],
};

describe('Driver flow (SDK contract E2E)', () => {
  it('logs in, goes online, previews and accepts an offer, drives the trip, and rates the customer', async () => {
    const { fetchMock, calls } = installFetchMock();
    const rideId = 'ride-1';
    const offerId = 'offer-1';

    fetchMock
      .mockResolvedValueOnce(
        jsonOk({
          user: driverUser,
          session: {
            id: 'sess-d',
            portal: 'driver',
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
          driverId: 'driver-1',
          online: true,
          acceptingRides: true,
          vehicleType: 'ECONOMY',
          latitude: 6.5,
          longitude: 3.3,
          activeRideCount: 0,
          updatedAt: new Date().toISOString(),
        }),
      )
      .mockResolvedValueOnce(
        jsonOk([
          {
            id: offerId,
            rideId,
            driverId: 'driver-1',
            status: 'PENDING',
            offeredAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 15_000).toISOString(),
            respondedAt: null,
          },
        ]),
      )
      .mockResolvedValueOnce(
        jsonOk({
          id: offerId,
          rideId,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 15_000).toISOString(),
          rideType: 'ECONOMY',
          pickupLatitude: 6.5,
          pickupLongitude: 3.3,
          pickupAddress: '1 Ikeja Way',
          dropoffLatitude: 6.55,
          dropoffLongitude: 3.35,
          dropoffAddress: '2 Allen Ave',
          estimatedDistanceMeters: 4200,
          estimatedDurationSeconds: 720,
          totalFare: 1800,
          paymentMethod: 'CASH',
        }),
      )
      .mockResolvedValueOnce(
        jsonOk({
          id: rideId,
          status: 'DRIVER_ASSIGNED',
          driverId: 'driver-1',
          customerId: 'cust-1',
        }),
      )
      .mockResolvedValueOnce(jsonOk({ id: rideId, status: 'ARRIVED' }))
      .mockResolvedValueOnce(jsonOk({ id: rideId, status: 'IN_PROGRESS' }))
      .mockResolvedValueOnce(jsonOk({ id: rideId, status: 'COMPLETED', totalFare: 1800 }))
      .mockResolvedValueOnce(jsonOk({ id: rideId, status: 'COMPLETED', paymentStatus: 'PAID' }))
      .mockResolvedValueOnce(
        jsonOk({ id: 'rating-1', rideId, rating: 5, comment: 'Polite passenger' }),
      )
      .mockResolvedValueOnce(jsonOk({ loggedOut: true }));

    const sdk = createDriverSdk({
      baseUrl: 'https://api.test/api/v1',
      getAccessToken: () => sampleTokens.accessToken,
    });

    await sdk.auth.loginDriver({ email: driverUser.email, password: 'Password1' });
    await sdk.rides.updateAvailability({
      online: true,
      acceptingRides: true,
      vehicleType: 'ECONOMY',
      latitude: 6.5,
      longitude: 3.3,
    });
    const offers = await sdk.rides.listOffers();
    expect(offers).toHaveLength(1);

    const preview = await sdk.rides.getOfferPreview(offerId);
    expect(preview.totalFare).toBe(1800);
    expect(preview).not.toHaveProperty('customerId');

    const accepted = await sdk.rides.acceptOffer(offerId);
    expect(accepted.status).toBe('DRIVER_ASSIGNED');

    await sdk.rides.markArrived(rideId);
    await sdk.rides.startTrip(rideId);
    const completed = await sdk.rides.completeTrip(rideId);
    expect(completed.status).toBe('COMPLETED');

    await sdk.rides.confirmCash(rideId);
    const rating = await sdk.rides.rateCustomer(rideId, { rating: 5, comment: 'Polite passenger' });
    expect(rating.rating).toBe(5);

    await sdk.auth.logout();

    const sequence = pathsOf(calls()).map((p) => `${p.method} ${p.path}`);
    expect(sequence).toEqual([
      'POST /auth/login/driver',
      'POST /driver/rides/availability',
      'GET /driver/rides/offers',
      `GET /driver/rides/offers/${offerId}`,
      `POST /driver/rides/offers/${offerId}/accept`,
      `POST /driver/rides/${rideId}/arrive`,
      `POST /driver/rides/${rideId}/start`,
      `POST /driver/rides/${rideId}/complete`,
      `POST /driver/rides/${rideId}/cash-confirm`,
      `POST /driver/rides/${rideId}/rate-customer`,
      'POST /auth/logout',
    ]);
  });

  it('submits KYC and reads the own driver profile', async () => {
    const { fetchMock, calls } = installFetchMock();

    fetchMock
      .mockResolvedValueOnce(
        jsonOk({
          id: 'kyc-1',
          driverId: 'driver-1',
          documentType: 'DRIVER_LICENSE',
          documentNumber: 'DL-12345',
          frontImage: 'https://cdn.example/front.jpg',
          backImage: null,
          verificationStatus: 'PENDING',
          reviewedBy: null,
          reviewedAt: null,
          remarks: null,
          createdAt: new Date().toISOString(),
        }),
      )
      .mockResolvedValueOnce(
        jsonOk({
          id: 'profile-1',
          driverId: 'driver-1',
          email: driverUser.email,
          phone: driverUser.phone,
          firstName: driverUser.firstName,
          lastName: driverUser.lastName,
          status: 'UNDER_REVIEW',
          isApproved: false,
          approvedAt: null,
          approvedBy: null,
          rejectedReason: null,
          suspendedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          kyc: [],
        }),
      );

    const sdk = createDriverSdk({
      baseUrl: 'https://api.test/api/v1',
      getAccessToken: () => sampleTokens.accessToken,
    });

    await sdk.profile.submitKyc({
      documentType: 'DRIVER_LICENSE',
      documentNumber: 'DL-12345',
      frontImage: 'https://cdn.example/front.jpg',
    });
    const profile = await sdk.profile.getOwnProfile();

    expect(profile.status).toBe('UNDER_REVIEW');
    const sequence = pathsOf(calls()).map((p) => `${p.method} ${p.path}`);
    expect(sequence).toEqual(['POST /driver/kyc', 'GET /driver/profile']);
  });
});
