import type { HttpClient } from '../client/http-client.js';
import type {
  AcquisitionIncentiveDto,
  AddCampaignPromoterRequest,
  CampaignDetailDto,
  CampaignPromoterDto,
  CampaignSummaryDto,
  RemoveCampaignPromoterResultDto,
} from '@dripplex/types';

/**
 * DPX-PROMO-REF-001 — the Operations Promotions tab.
 *
 * Mirrors `OperationsPromotionsController` exactly
 * (apps/backend/src/operations/controllers/operations-promotions.controller.ts).
 *
 * Read and manage are separate permissions on the server —
 * `operations:promotions:read` and `operations:promotions:manage` — and this
 * client makes no attempt to anticipate which the caller holds. Hiding a button
 * is a courtesy to the operator; the refusal that matters is the 403 from the
 * route, and every method here can return one.
 *
 * Nothing on this client computes money. `addPromoter` sends the reward the
 * operator typed and the server decides whether it is legal; every figure that
 * comes back has already been totalled server-side.
 */
export class OperationsPromotionsClient {
  public constructor(private readonly http: HttpClient) {}

  /** Campaigns that carry promoters, newest first. */
  public campaigns(): Promise<CampaignSummaryDto[]> {
    return this.http.request<CampaignSummaryDto[]>('/operations/promotions/campaigns', {
      method: 'GET',
      auth: true,
    });
  }

  /** One campaign, its promoters, and their private tokens. */
  public campaign(promotionId: string): Promise<CampaignDetailDto> {
    return this.http.request<CampaignDetailDto>(
      `/operations/promotions/campaigns/${encodeURIComponent(promotionId)}`,
      { method: 'GET', auth: true },
    );
  }

  /** Enrol a promoter and issue their token. Requires the manage permission. */
  public addPromoter(
    promotionId: string,
    body: AddCampaignPromoterRequest,
  ): Promise<CampaignPromoterDto> {
    return this.http.request<CampaignPromoterDto>(
      `/operations/promotions/campaigns/${encodeURIComponent(promotionId)}/promoters`,
      { method: 'POST', auth: true, body },
    );
  }

  /**
   * End a promoter's participation. Requires the manage permission.
   *
   * A deactivation, not a delete — the response returns the row with its new
   * status, which is why it is worth reading rather than discarding.
   */
  public removePromoter(promoterId: string): Promise<RemoveCampaignPromoterResultDto> {
    return this.http.request<RemoveCampaignPromoterResultDto>(
      `/operations/promotions/promoters/${encodeURIComponent(promoterId)}`,
      { method: 'DELETE', auth: true },
    );
  }

  /** Terms and usage of the one universal acquisition incentive. Read-only:
   *  there is no create, and there is no per-campaign equivalent. */
  public acquisitionIncentive(): Promise<AcquisitionIncentiveDto> {
    return this.http.request<AcquisitionIncentiveDto>(
      '/operations/promotions/acquisition-incentive',
      { method: 'GET', auth: true },
    );
  }
}
