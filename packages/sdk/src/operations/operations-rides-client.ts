import type { HttpClient } from '../client/http-client.js';
import type {
  DispatchSupportDto,
  OperationsRideAllocationDto,
  OperationsRideDetailDto,
  OperationsRideQueueDto,
  OperationsRideTrackingDto,
} from '@dripplex/types';

/**
 * DPX-OPS-001 Slice 1 (queue) + Slice 3 (detail/allocation/tracking/
 * dispatch-candidates). Mirrors OperationsRidesController exactly
 * (apps/backend/src/operations/controllers/operations-rides.controller.ts).
 * `operations-console` only.
 */
export class OperationsRidesClient {
  public constructor(private readonly http: HttpClient) {}

  public getQueue(): Promise<OperationsRideQueueDto> {
    return this.http.request<OperationsRideQueueDto>('/operations/rides', {
      method: 'GET',
      auth: true,
    });
  }

  public getRideDetail(rideId: string): Promise<OperationsRideDetailDto> {
    return this.http.request<OperationsRideDetailDto>(`/operations/rides/${rideId}`, {
      method: 'GET',
      auth: true,
    });
  }

  public getRideAllocation(rideId: string): Promise<OperationsRideAllocationDto> {
    return this.http.request<OperationsRideAllocationDto>(
      `/operations/rides/${rideId}/allocation`,
      { method: 'GET', auth: true },
    );
  }

  public getTripTracking(rideId: string): Promise<OperationsRideTrackingDto> {
    return this.http.request<OperationsRideTrackingDto>(`/operations/rides/${rideId}/tracking`, {
      method: 'GET',
      auth: true,
    });
  }

  public getDispatchCandidates(rideId: string): Promise<DispatchSupportDto> {
    return this.http.request<DispatchSupportDto>(
      `/operations/rides/${rideId}/dispatch-candidates`,
      { method: 'GET', auth: true },
    );
  }
}
