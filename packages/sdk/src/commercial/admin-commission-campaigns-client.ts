import type { HttpClient } from '../client/http-client.js';
import type {
  CommissionCampaignDto,
  CreateCommissionCampaignRequest,
  ListCommissionCampaignsQuery,
  PaginatedResult,
  UpdateCommissionCampaignRequest,
} from '@dripplex/types';

/**
 * DPX-COMMISSION-001 — commission campaigns, from the Operations Console.
 *
 * A campaign is a temporary override of what DrippleX charges a merchant, rider
 * or driver: 7% this week, 14% next week, 5% on weekend orders. The two
 * standing rates (`/admin/commercial/commission-settings` and the merchant
 * equivalent) remain what is charged when no campaign is running.
 *
 * There is no delete. A rate that was once charged against real money has to
 * stay explicable — settlement rows point back at these ids — so `archive` is
 * the end of the line.
 */
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

export class AdminCommissionCampaignsClient {
  public constructor(private readonly http: HttpClient) {}

  public list(
    query: ListCommissionCampaignsQuery = {},
  ): Promise<PaginatedResult<CommissionCampaignDto>> {
    return this.http.request<PaginatedResult<CommissionCampaignDto>>(
      `/admin/commercial/commission-campaigns${toQuery({
        page: query.page,
        pageSize: query.pageSize,
        scope: query.scope,
        status: query.status,
      })}`,
      { method: 'GET', auth: true },
    );
  }

  public get(id: string): Promise<CommissionCampaignDto> {
    return this.http.request<CommissionCampaignDto>(
      `/admin/commercial/commission-campaigns/${encodeURIComponent(id)}`,
      { method: 'GET', auth: true },
    );
  }

  public create(body: CreateCommissionCampaignRequest): Promise<CommissionCampaignDto> {
    return this.http.request<CommissionCampaignDto>('/admin/commercial/commission-campaigns', {
      method: 'POST',
      auth: true,
      body,
    });
  }

  public update(id: string, body: UpdateCommissionCampaignRequest): Promise<CommissionCampaignDto> {
    return this.http.request<CommissionCampaignDto>(
      `/admin/commercial/commission-campaigns/${encodeURIComponent(id)}`,
      { method: 'PATCH', auth: true, body },
    );
  }

  /** Stops the campaign charging from the next settlement. Not retroactive. */
  public pause(id: string): Promise<CommissionCampaignDto> {
    return this.transition(id, 'pause');
  }

  /**
   * Returns the campaign to SCHEDULED. The sweep decides whether its window is
   * still open, so one paused in January and resumed in March does not come
   * back into force on a window that closed weeks ago.
   */
  public resume(id: string): Promise<CommissionCampaignDto> {
    return this.transition(id, 'resume');
  }

  public archive(id: string): Promise<CommissionCampaignDto> {
    return this.transition(id, 'archive');
  }

  private transition(id: string, action: string): Promise<CommissionCampaignDto> {
    return this.http.request<CommissionCampaignDto>(
      `/admin/commercial/commission-campaigns/${encodeURIComponent(id)}/${action}`,
      { method: 'PATCH', auth: true },
    );
  }
}
