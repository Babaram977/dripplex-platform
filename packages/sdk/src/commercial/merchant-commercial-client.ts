import type { HttpClient } from '../client/http-client.js';
import type {
  CommissionAccountDto,
  CommissionLedgerEntryDto,
  PaginatedResult,
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

export interface ListCommercialLedgerQuery {
  page?: number;
  pageSize?: number;
}

/**
 * DPX-COMMERCIAL-001 Slice 5 — a merchant reading their own commission
 * account/ledger. Mirrors MerchantCommercialController
 * (apps/backend/src/commercial/controllers/merchant-commercial.controller.ts)
 * 1:1.
 */
export class MerchantCommercialClient {
  public constructor(private readonly http: HttpClient) {}

  public getAccount(): Promise<CommissionAccountDto> {
    return this.http.request<CommissionAccountDto>('/merchant/commercial/account', {
      method: 'GET',
      auth: true,
    });
  }

  public listLedger(
    query: ListCommercialLedgerQuery = {},
  ): Promise<PaginatedResult<CommissionLedgerEntryDto>> {
    return this.http.request<PaginatedResult<CommissionLedgerEntryDto>>(
      `/merchant/commercial/ledger${toQuery(query)}`,
      { method: 'GET', auth: true },
    );
  }
}
