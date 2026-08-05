import type { HttpClient } from '../client/http-client.js';
import type {
  CommissionAccountDto,
  CommissionLedgerEntryDto,
  CommissionOwnerType,
  PaginatedResult,
  RecordCommissionPaymentRequest,
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

export interface ListCommissionLedgerQuery {
  page?: number;
  pageSize?: number;
}

/**
 * DPX-COMMERCIAL-001 Slice 1 — mirrors AdminCommissionAccountsController
 * (apps/backend/src/commercial/controllers/admin-commission-accounts.controller.ts).
 * No real accrual call site exists yet — an account only has a nonzero
 * outstanding balance once Slice 2-4 lands.
 */
export class AdminCommissionAccountsClient {
  public constructor(private readonly http: HttpClient) {}

  public get(ownerType: CommissionOwnerType, ownerId: string): Promise<CommissionAccountDto> {
    return this.http.request<CommissionAccountDto>(
      `/admin/commercial/accounts/${ownerType}/${ownerId}`,
      { method: 'GET', auth: true },
    );
  }

  public listLedger(
    ownerType: CommissionOwnerType,
    ownerId: string,
    query: ListCommissionLedgerQuery = {},
  ): Promise<PaginatedResult<CommissionLedgerEntryDto>> {
    return this.http.request<PaginatedResult<CommissionLedgerEntryDto>>(
      `/admin/commercial/accounts/${ownerType}/${ownerId}/ledger${toQuery(query)}`,
      { method: 'GET', auth: true },
    );
  }

  public recordPayment(
    ownerType: CommissionOwnerType,
    ownerId: string,
    body: RecordCommissionPaymentRequest,
  ): Promise<CommissionAccountDto> {
    return this.http.request<CommissionAccountDto>(
      `/admin/commercial/accounts/${ownerType}/${ownerId}/payments`,
      { method: 'POST', body, auth: true },
    );
  }
}
