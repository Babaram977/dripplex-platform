import type { HttpClient } from '../client/http-client.js';
import type {
  AdminUtilityPurchaseDto,
  PaginatedResult,
  ResolveUtilityPurchaseRequest,
  UtilityFloatStatusDto,
  UtilityPurchaseStatus,
  UtilityServiceType,
} from '@dripplex/types';

function toQuery(params: object): string {
  const entries = Object.entries(params as Record<string, unknown>).filter(
    ([, value]) => value !== undefined,
  );
  if (entries.length === 0) {
    return '';
  }
  const search = new URLSearchParams();
  for (const [key, value] of entries) {
    search.set(key, String(value));
  }
  return `?${search.toString()}`;
}

export interface AdminUtilityPurchaseQuery {
  page?: number;
  pageSize?: number;
  serviceType?: UtilityServiceType;
  status?: UtilityPurchaseStatus;
}

/**
 * DPX-UTILITIES-001 — mirrors AdminUtilitiesController
 * (apps/backend/src/utilities/admin-utilities.controller.ts).
 *
 * Two jobs, both operational rather than editorial: watching the provider
 * float, which every utility purchase on the platform draws on, and recording
 * what a human found for a purchase the provider never answered for.
 */
export class AdminUtilitiesClient {
  public constructor(private readonly http: HttpClient) {}

  public getFloat(): Promise<UtilityFloatStatusDto> {
    return this.http.request<UtilityFloatStatusDto>('/admin/utilities/float', {
      method: 'GET',
      auth: true,
    });
  }

  public listPurchases(
    query: AdminUtilityPurchaseQuery = {},
  ): Promise<PaginatedResult<AdminUtilityPurchaseDto>> {
    return this.http.request<PaginatedResult<AdminUtilityPurchaseDto>>(
      `/admin/utilities/purchases${toQuery(query)}`,
      { method: 'GET', auth: true },
    );
  }

  public resolvePurchase(
    id: string,
    body: ResolveUtilityPurchaseRequest,
  ): Promise<AdminUtilityPurchaseDto> {
    return this.http.request<AdminUtilityPurchaseDto>(
      `/admin/utilities/purchases/${encodeURIComponent(id)}/resolve`,
      { method: 'PATCH', body, auth: true },
    );
  }
}
