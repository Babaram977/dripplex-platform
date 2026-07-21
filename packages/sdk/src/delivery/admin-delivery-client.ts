import type { HttpClient } from '../client/http-client.js';
import type {
  AdminDeliveryJobQuery,
  AssignDeliveryRiderDto,
  DeliveryJobDto,
  DeliveryReasonDto,
  PaginatedResult,
} from '@dripplex/types';

function toQuery(params?: Record<string, string | number | undefined>): string {
  if (!params) {
    return '';
  }
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export class AdminDeliveryClient {
  public constructor(private readonly http: HttpClient) {}

  public listJobs(query: AdminDeliveryJobQuery = {}): Promise<PaginatedResult<DeliveryJobDto>> {
    return this.http.request<PaginatedResult<DeliveryJobDto>>(
      `/admin/delivery${toQuery({
        page: query.page,
        pageSize: query.pageSize,
        status: query.status,
        riderId: query.riderId,
        merchantId: query.merchantId,
        customerId: query.customerId,
      })}`,
      {
        method: 'GET',
        auth: true,
      },
    );
  }

  public getJob(jobId: string): Promise<DeliveryJobDto> {
    return this.http.request<DeliveryJobDto>(`/admin/delivery/${jobId}`, {
      method: 'GET',
      auth: true,
    });
  }

  public assign(jobId: string, body: AssignDeliveryRiderDto): Promise<DeliveryJobDto> {
    return this.http.request<DeliveryJobDto>(`/admin/delivery/${jobId}/assign`, {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public reassign(jobId: string, body: AssignDeliveryRiderDto): Promise<DeliveryJobDto> {
    return this.http.request<DeliveryJobDto>(`/admin/delivery/${jobId}/reassign`, {
      method: 'POST',
      body,
      auth: true,
    });
  }

  public cancel(jobId: string, body: DeliveryReasonDto = {}): Promise<DeliveryJobDto> {
    return this.http.request<DeliveryJobDto>(`/admin/delivery/${jobId}/cancel`, {
      method: 'POST',
      body,
      auth: true,
    });
  }
}
