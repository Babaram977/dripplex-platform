import { parseApiResponse } from '../errors/api-error.js';

import type { SdkConfig } from '../config/sdk-config.js';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean;
}

export class HttpClient {
  public constructor(private readonly config: SdkConfig) {}

  public async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = `${this.config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...options.headers,
    };

    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const useAuth = options.auth ?? true;
    if (useAuth && this.config.getAccessToken) {
      const token = this.config.getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const init: RequestInit = {
      method: options.method ?? 'GET',
      headers,
    };

    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, init);

    if (response.status === 401 && this.config.onUnauthorized) {
      this.config.onUnauthorized();
    }

    return await parseApiResponse<T>(response);
  }
}
