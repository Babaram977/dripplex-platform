import type { HttpClient } from '../client/http-client.js';
import type {
  CommercialCreditSettingDto,
  CommissionOwnerType,
  UpdateCommercialCreditSettingRequest,
} from '@dripplex/types';

/**
 * DPX-COMMERCIAL-001 Slice 1 — mirrors
 * AdminCommercialCreditSettingsController
 * (apps/backend/src/commercial/controllers/admin-commercial-credit-settings.controller.ts).
 */
export class AdminCommercialCreditSettingsClient {
  public constructor(private readonly http: HttpClient) {}

  public get(ownerType: CommissionOwnerType): Promise<CommercialCreditSettingDto> {
    return this.http.request<CommercialCreditSettingDto>(
      `/admin/commercial/credit-settings/${ownerType}`,
      { method: 'GET', auth: true },
    );
  }

  public update(body: UpdateCommercialCreditSettingRequest): Promise<CommercialCreditSettingDto> {
    return this.http.request<CommercialCreditSettingDto>('/admin/commercial/credit-settings', {
      method: 'PATCH',
      body,
      auth: true,
    });
  }
}
