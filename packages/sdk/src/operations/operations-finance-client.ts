import type { HttpClient } from '../client/http-client.js';
import type {
  OperationsPayoutQueueQuery,
  OperationsPayoutQueueSummaryDto,
  OperationsPayoutRequestDto,
  OperationsReferralOverviewDto,
  PaginatedResult,
  ReferralPerformerDto,
  ReferralPersona,
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
  return qs === '' ? '' : `?${qs}`;
}

/**
 * DPX-OPS — money out, and where it came from.
 *
 * Read-only. Every payout row carries the `actionPath` that approves it,
 * because the two kinds go through genuinely different endpoints — a
 * withdrawal has already debited a wallet, a fleet receivable has not been paid
 * into one — and collapsing them into one button would be a way to pay the
 * wrong thing.
 */
export class OperationsFinanceClient {
  public constructor(private readonly http: HttpClient) {}

  public payoutRequests(
    query: OperationsPayoutQueueQuery = {},
  ): Promise<PaginatedResult<OperationsPayoutRequestDto>> {
    return this.http.request<PaginatedResult<OperationsPayoutRequestDto>>(
      `/operations/finance/payout-requests${toQuery({
        page: query.page,
        pageSize: query.pageSize,
        requesterType: query.requesterType,
        status: query.status,
      })}`,
      { method: 'GET', auth: true },
    );
  }

  public payoutSummary(): Promise<OperationsPayoutQueueSummaryDto> {
    return this.http.request<OperationsPayoutQueueSummaryDto>(
      '/operations/finance/payout-requests/summary',
      { method: 'GET', auth: true },
    );
  }

  public referralOverview(): Promise<OperationsReferralOverviewDto> {
    return this.http.request<OperationsReferralOverviewDto>('/operations/finance/referrals', {
      method: 'GET',
      auth: true,
    });
  }

  public referralPerformers(
    persona: ReferralPersona,
    query: { page?: number; pageSize?: number } = {},
  ): Promise<PaginatedResult<ReferralPerformerDto>> {
    return this.http.request<PaginatedResult<ReferralPerformerDto>>(
      `/operations/finance/referrals/${encodeURIComponent(persona)}/performers${toQuery({
        page: query.page,
        pageSize: query.pageSize,
      })}`,
      { method: 'GET', auth: true },
    );
  }
}
