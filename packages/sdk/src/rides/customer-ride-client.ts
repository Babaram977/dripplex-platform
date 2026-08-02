import type { HttpClient } from '../client/http-client.js';
import type {
  EstimateRideFareRequest,
  EstimateRideFareResponse,
  InitiateRidePaymentRequest,
  InitiateRidePaymentResponse,
  PaginatedResult,
  RateRideRequest,
  ReportRideProblemRequest,
  RequestRideRequest,
  RideDto,
  RideProblemReportDto,
  RideRatingDto,
  RideReceiptDto,
  RideStatus,
  TipDriverRequest,
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

export interface ListRidesQuery {
  page?: number;
  limit?: number;
  status?: RideStatus;
}

/**
 * Customer-side Ride HTTP surface — mirrors CustomerRidesController exactly
 * (apps/backend/src/rides/controllers/customer-rides.controller.ts).
 */
export class CustomerRideClient {
  public constructor(private readonly http: HttpClient) {}

  public estimateFare(body: EstimateRideFareRequest): Promise<EstimateRideFareResponse> {
    return this.http.request<EstimateRideFareResponse>('/customer/rides/estimate', {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public requestRide(body: RequestRideRequest): Promise<RideDto> {
    return this.http.request<RideDto>('/customer/rides', {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public listRides(query: ListRidesQuery = {}): Promise<PaginatedResult<RideDto>> {
    return this.http.request<PaginatedResult<RideDto>>(
      `/customer/rides${toQuery({ page: query.page, limit: query.limit, status: query.status })}`,
      { method: 'GET', auth: true },
    );
  }

  public getRide(rideId: string): Promise<RideDto> {
    return this.http.request<RideDto>(`/customer/rides/${rideId}`, {
      method: 'GET',
      auth: true,
    });
  }

  public cancelRide(rideId: string, reason?: string): Promise<RideDto> {
    return this.http.request<RideDto>(`/customer/rides/${rideId}/cancel`, {
      method: 'POST',
      body: reason !== undefined ? { reason } : {},
      auth: true,
    });
  }

  public initiatePayment(
    rideId: string,
    body: InitiateRidePaymentRequest,
  ): Promise<InitiateRidePaymentResponse> {
    return this.http.request<InitiateRidePaymentResponse>(`/customer/rides/${rideId}/pay`, {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public verifyPayment(rideId: string, reference?: string): Promise<RideDto> {
    return this.http.request<RideDto>(`/customer/rides/${rideId}/pay/verify`, {
      method: 'POST',
      body: reference !== undefined ? { reference } : {},
      auth: true,
    });
  }

  public getReceipt(rideId: string): Promise<RideReceiptDto> {
    return this.http.request<RideReceiptDto>(`/customer/rides/${rideId}/receipt`, {
      method: 'GET',
      auth: true,
    });
  }

  public rateDriver(rideId: string, body: RateRideRequest): Promise<RideRatingDto> {
    return this.http.request<RideRatingDto>(`/customer/rides/${rideId}/rate-driver`, {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public tipDriver(rideId: string, body: TipDriverRequest): Promise<RideDto> {
    return this.http.request<RideDto>(`/customer/rides/${rideId}/tip`, {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public reportProblem(
    rideId: string,
    body: ReportRideProblemRequest,
  ): Promise<RideProblemReportDto> {
    return this.http.request<RideProblemReportDto>(`/customer/rides/${rideId}/report`, {
      method: 'POST',
      body,
      auth: true,
    });
  }
}
