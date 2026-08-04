import type { HttpClient } from '../client/http-client.js';
import type { CmsContentDto } from '@dripplex/types';

/**
 * Driver-side Help Centre HTTP surface — mirrors DriverHelpController
 * exactly (apps/backend/src/drivers/controllers/driver-help.controller.ts).
 * Reuses the platform Cms module's content shape
 * (`CmsContentType.DRIVER_FAQ`/`DRIVER_STATIC_PAGE`).
 */
export class DriverHelpClient {
  public constructor(private readonly http: HttpClient) {}

  public list(): Promise<CmsContentDto[]> {
    return this.http.request<CmsContentDto[]>('/driver/help', { method: 'GET', auth: true });
  }

  public getBySlug(slug: string): Promise<CmsContentDto> {
    return this.http.request<CmsContentDto>(`/driver/help/${encodeURIComponent(slug)}`, {
      method: 'GET',
      auth: true,
    });
  }
}
