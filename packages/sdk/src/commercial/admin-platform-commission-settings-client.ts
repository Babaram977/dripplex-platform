import type { HttpClient } from '../client/http-client.js';
import type {
  PlatformCommissionSettingDto,
  UpdatePlatformCommissionSettingRequest,
} from '@dripplex/types';

/**
 * DPX-LAUNCH — mirrors AdminPlatformCommissionSettingsController
 * (apps/backend/src/commercial/controllers/admin-platform-commission-settings.controller.ts).
 * The Ops-configurable platform (ride) commission rate.
 */
export class AdminPlatformCommissionSettingsClient {
  public constructor(private readonly http: HttpClient) {}

  public get(): Promise<PlatformCommissionSettingDto> {
    return this.http.request<PlatformCommissionSettingDto>(
      '/admin/commercial/commission-settings',
      {
        method: 'GET',
        auth: true,
      },
    );
  }

  public update(
    body: UpdatePlatformCommissionSettingRequest,
  ): Promise<PlatformCommissionSettingDto> {
    return this.http.request<PlatformCommissionSettingDto>(
      '/admin/commercial/commission-settings',
      {
        method: 'PATCH',
        body,
        auth: true,
      },
    );
  }
}
