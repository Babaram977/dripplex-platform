import type { HttpClient } from '../client/http-client.js';
import type {
  DriverAvailabilityDto,
  PaginatedResult,
  RateRideRequest,
  RideDto,
  RideOfferDto,
  RideOfferPreviewDto,
  RideRatingDto,
  RideStatus,
  UpdateDriverAvailabilityRequest,
} from '@dripplex/types';

function toQuery(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return '';
  }
  const search = new URLSearchParams();
  for (const [key, value] of entries) {
    search.set(key, String(value));
  }
  return `?${search.toString()}`;
}

export interface ListDriverRidesQuery {
  page?: number;
  limit?: number;
  status?: RideStatus;
}

/**
 * Driver-side Ride HTTP surface — mirrors DriverRidesController exactly
 * (apps/backend/src/rides/controllers/driver-rides.controller.ts).
 */
export class DriverRideClient {
  public constructor(private readonly http: HttpClient) {}

  public listOwnRides(query: ListDriverRidesQuery = {}): Promise<PaginatedResult<RideDto>> {
    return this.http.request<PaginatedResult<RideDto>>(
      `/driver/rides${toQuery({ page: query.page, limit: query.limit, status: query.status })}`,
      { method: 'GET', auth: true },
    );
  }

  public updateAvailability(body: UpdateDriverAvailabilityRequest): Promise<DriverAvailabilityDto> {
    return this.http.request<DriverAvailabilityDto>('/driver/rides/availability', {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public getAvailability(): Promise<DriverAvailabilityDto | null> {
    return this.http.request<DriverAvailabilityDto | null>('/driver/rides/availability', {
      method: 'GET',
      auth: true,
    });
  }

  public getActiveRide(): Promise<RideDto | null> {
    return this.http.request<RideDto | null>('/driver/rides/active', {
      method: 'GET',
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

  /** `verificationCode` is the passenger's 4-digit trip code. Required by the
   * API on every ride assigned since trip codes shipped. */
  public startTrip(rideId: string, verificationCode?: string): Promise<RideDto> {
    return this.http.request<RideDto>(`/driver/rides/${rideId}/start`, {
      method: 'POST',
      body: verificationCode !== undefined ? { verificationCode } : {},
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

  public listRideRatings(rideId: string): Promise<RideRatingDto[]> {
    return this.http.request<RideRatingDto[]>(`/driver/rides/${rideId}/ratings`, {
      method: 'GET',
      auth: true,
    });
  }
}
