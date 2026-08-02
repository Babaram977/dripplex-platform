import type { HttpClient } from '../client/http-client.js';
import type {
  DriverAvailabilityDto,
  RateRideRequest,
  RideDto,
  RideOfferDto,
  RideOfferPreviewDto,
  RideRatingDto,
  UpdateDriverAvailabilityRequest,
} from '@dripplex/types';

/**
 * Driver-side Ride HTTP surface — mirrors DriverRidesController exactly
 * (apps/backend/src/rides/controllers/driver-rides.controller.ts).
 */
export class DriverRideClient {
  public constructor(private readonly http: HttpClient) {}

  public updateAvailability(body: UpdateDriverAvailabilityRequest): Promise<DriverAvailabilityDto> {
    return this.http.request<DriverAvailabilityDto>('/driver/rides/availability', {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public listOffers(): Promise<RideOfferDto[]> {
    return this.http.request<RideOfferDto[]>('/driver/rides/offers', {
      method: 'GET',
      auth: true,
    });
  }

  public getOfferPreview(offerId: string): Promise<RideOfferPreviewDto> {
    return this.http.request<RideOfferPreviewDto>(`/driver/rides/offers/${offerId}`, {
      method: 'GET',
      auth: true,
    });
  }

  public acceptOffer(offerId: string): Promise<RideDto> {
    return this.http.request<RideDto>(`/driver/rides/offers/${offerId}/accept`, {
      method: 'POST',
      auth: true,
    });
  }

  public declineOffer(offerId: string): Promise<null> {
    return this.http.request<null>(`/driver/rides/offers/${offerId}/decline`, {
      method: 'POST',
      auth: true,
    });
  }

  public markArrived(rideId: string): Promise<RideDto> {
    return this.http.request<RideDto>(`/driver/rides/${rideId}/arrive`, {
      method: 'POST',
      auth: true,
    });
  }

  public startTrip(rideId: string): Promise<RideDto> {
    return this.http.request<RideDto>(`/driver/rides/${rideId}/start`, {
      method: 'POST',
      auth: true,
    });
  }

  public completeTrip(rideId: string): Promise<RideDto> {
    return this.http.request<RideDto>(`/driver/rides/${rideId}/complete`, {
      method: 'POST',
      auth: true,
    });
  }

  public cancelTrip(rideId: string, reason?: string): Promise<RideDto> {
    return this.http.request<RideDto>(`/driver/rides/${rideId}/cancel`, {
      method: 'POST',
      body: reason !== undefined ? { reason } : {},
      auth: true,
    });
  }

  public confirmCash(rideId: string): Promise<RideDto> {
    return this.http.request<RideDto>(`/driver/rides/${rideId}/cash-confirm`, {
      method: 'POST',
      auth: true,
    });
  }

  public rateCustomer(rideId: string, body: RateRideRequest): Promise<RideRatingDto> {
    return this.http.request<RideRatingDto>(`/driver/rides/${rideId}/rate-customer`, {
      method: 'POST',
      body,
      auth: true,
    });
  }
}
