import type { HttpClient } from '../client/http-client.js';
import type {
  DriverSecuritySettingsDto,
  UpdateDriverSecuritySettingsRequest,
} from '@dripplex/types';

/**
 * Driver-001 Security Standard — mirrors AdminDriverSecuritySettingsController
 * (apps/backend/src/drivers/controllers/admin-driver-security-settings.controller.ts).
 */
export class AdminDriverSecuritySettingsClient {
  public constructor(private readonly http: HttpClient) {}

  public get(): Promise<DriverSecuritySettingsDto> {
    return this.http.request<DriverSecuritySettingsDto>('/admin/drivers/security-settings', {
      method: 'GET',
      auth: true,
    });
  }

  public update(body: UpdateDriverSecuritySettingsRequest): Promise<DriverSecuritySettingsDto> {
    return this.http.request<DriverSecuritySettingsDto>('/admin/drivers/security-settings', {
      method: 'PATCH',
      body,
      auth: true,
    });
  }
}
