import type { HttpClient } from '../client/http-client.js';
import type {
  DeliveryHistoryDto,
  OrderHistoryDto,
  RideHistoryDto,
  UtilityPurchaseHistoryDto,
} from '@dripplex/types';

function toQuery(params: object): string {
  const entries = Object.entries(params as Record<string, unknown>).filter(
    ([, value]) => value !== undefined && value !== '',
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

/**
 * Filters shared by all four history endpoints.
 *
 * `status` is a plain string because each domain has its own set; the server
 * rejects an unknown one by name rather than returning an empty list, so a
 * typo reads as a mistake instead of as missing records.
 */
export interface OperationsHistoryQuery {
  /** ISO instant. Filters on when the thing happened, not when it ended. */
  from?: string;
  to?: string;
  status?: string;
  /** Matches the record id and the names, phones and emails on it. */
  search?: string;
  page?: number;
  /** Server caps this at 100. */
  limit?: number;
}

/**
 * DPX-OPS — the completed record, for audit, disputes and security enquiries.
 * Mirrors OperationsHistoryController exactly
 * (apps/backend/src/operations/controllers/operations-history.controller.ts).
 */
export class OperationsHistoryClient {
  public constructor(private readonly http: HttpClient) {}

  public getRideHistory(query: OperationsHistoryQuery = {}): Promise<RideHistoryDto> {
    return this.http.request<RideHistoryDto>(`/operations/history/rides${toQuery(query)}`, {
      method: 'GET',
      auth: true,
    });
  }

  public getDeliveryHistory(query: OperationsHistoryQuery = {}): Promise<DeliveryHistoryDto> {
    return this.http.request<DeliveryHistoryDto>(
      `/operations/history/deliveries${toQuery(query)}`,
      { method: 'GET', auth: true },
    );
  }

  public getOrderHistory(query: OperationsHistoryQuery = {}): Promise<OrderHistoryDto> {
    return this.http.request<OrderHistoryDto>(`/operations/history/orders${toQuery(query)}`, {
      method: 'GET',
      auth: true,
    });
  }

  public getUtilityPurchaseHistory(
    query: OperationsHistoryQuery = {},
  ): Promise<UtilityPurchaseHistoryDto> {
    return this.http.request<UtilityPurchaseHistoryDto>(
      `/operations/history/utilities${toQuery(query)}`,
      { method: 'GET', auth: true },
    );
  }
}
