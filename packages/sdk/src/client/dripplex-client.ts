import { AuthApi } from '../auth/auth-api.js';
import { HttpClient } from '../client/http-client.js';
import { resolveSdkConfig } from '../config/sdk-config.js';

import type { SdkConfig } from '../config/sdk-config.js';

export class DripplexClient {
  public readonly auth: AuthApi;
  private readonly http: HttpClient;

  public constructor(config: Partial<SdkConfig> = {}) {
    const resolved = resolveSdkConfig(config);
    this.http = new HttpClient(resolved);
    this.auth = new AuthApi(this.http);
  }
}

export { DripplexApiError } from '../errors/api-error.js';
export type { SdkConfig } from '../config/sdk-config.js';
export { resolveSdkConfig } from '../config/sdk-config.js';
