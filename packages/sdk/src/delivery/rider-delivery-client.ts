import type { HttpClient } from '../client/http-client.js';
import type {
  ConfirmCashDto,
  DeliverOrderDto,
  DeliveryJobDto,
  DeliveryLocationUpdateDto,
  DeliveryReasonDto,
  DeliveryTrackingDto,
  RiderLocationDto,
  UpdateRiderAvailabilityDto,
} from '@dripplex/types';

export class RiderDeliveryClient {
  public constructor(private readonly http: HttpClient) {}

  public listJobs(): Promise<DeliveryJobDto[]> {
    return this.http.request<DeliveryJobDto[]>('/rider/jobs', {
      method: 'GET',
      auth: true,
    });
  }

  public getJob(jobId: string): Promise<DeliveryJobDto> {
    return this.http.request<DeliveryJobDto>(`/rider/jobs/${jobId}`, {
      method: 'GET',
      auth: true,
    });
  }

  public accept(jobId: string): Promise<DeliveryJobDto> {
    return this.http.request<DeliveryJobDto>(`/rider/jobs/${jobId}/accept`, {
      method: 'POST',
      auth: true,
    });
  }

  public reject(jobId: string): Promise<DeliveryJobDto> {
    return this.http.request<DeliveryJobDto>(`/rider/jobs/${jobId}/reject`, {
      method: 'POST',
      auth: true,
    });
  }

  public pickUp(jobId: string): Promise<DeliveryJobDto> {
    return this.http.request<DeliveryJobDto>(`/rider/jobs/${jobId}/pickup`, {
      method: 'POST',
      auth: true,
    });
  }

  public arrived(jobId: string): Promise<DeliveryJobDto> {
    return this.http.request<DeliveryJobDto>(`/rider/jobs/${jobId}/arrived`, {
      method: 'POST',
      auth: true,
    });
  }

  public deliver(jobId: string, body: DeliverOrderDto): Promise<DeliveryJobDto> {
    return this.http.request<DeliveryJobDto>(`/rider/jobs/${jobId}/deliver`, {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public location(jobId: string, body: DeliveryLocationUpdateDto): Promise<DeliveryTrackingDto> {
    return this.http.request<DeliveryTrackingDto>(`/rider/jobs/${jobId}/location`, {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public confirmCash(jobId: string, body: ConfirmCashDto): Promise<DeliveryJobDto> {
    return this.http.request<DeliveryJobDto>(`/rider/jobs/${jobId}/confirm-cash`, {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public fail(jobId: string, body: DeliveryReasonDto = {}): Promise<DeliveryJobDto> {
    return this.http.request<DeliveryJobDto>(`/rider/jobs/${jobId}/fail`, {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public returnJob(jobId: string, body: DeliveryReasonDto = {}): Promise<DeliveryJobDto> {
    return this.http.request<DeliveryJobDto>(`/rider/jobs/${jobId}/return`, {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public updateAvailability(body: UpdateRiderAvailabilityDto): Promise<RiderLocationDto> {
    return this.http.request<RiderLocationDto>('/rider/availability', {
      method: 'POST',
      body,
      auth: true,
    });
  }
}
