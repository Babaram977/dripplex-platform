import { parseApiResponse } from '../errors/api-error.js';
import { DripplexNetworkError, isAbortError } from '../errors/network-error.js';

import type { SdkConfig } from '../config/sdk-config.js';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean;
  /** Internal: skip refresh retry for this request. */
  _retried?: boolean;
}

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn?: string;
  tokenType?: 'Bearer';
}

export class HttpClient {
  private refreshPromise: Promise<boolean> | null = null;

  public constructor(private readonly config: SdkConfig) {}

  /** The API base URL, for building full-page-navigation links (e.g. OAuth redirects) that can't go through request(). */
  public get baseUrl(): string {
    return this.config.baseUrl;
  }

  public async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    try {
      return await this.execute<T>(path, options);
    } catch (error) {
      if (isAbortError(error)) {
        throw new DripplexNetworkError('TIMEOUT', 'Request timed out. Please try again.');
      }
      if (error instanceof TypeError) {
        const offline = typeof navigator !== 'undefined' && !navigator.onLine;
        throw new DripplexNetworkError(
          offline ? 'OFFLINE' : 'NETWORK',
          offline
            ? 'You appear to be offline. Check your connection and retry.'
            : 'Unable to reach the Dripplex API. Check your connection and retry.',
        );
      }
      throw error;
    }
  }

  private async execute<T>(path: string, options: RequestOptions): Promise<T> {
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.config.timeoutMs);

    try {
      const init: RequestInit = {
        method: options.method ?? 'GET',
        headers,
        signal: controller.signal,
      };

      if (options.body !== undefined) {
        init.body = JSON.stringify(options.body);
      }

      const response = await fetch(url, init);

      if (response.status === 401 && useAuth) {
        if (!options._retried && path !== '/auth/refresh') {
          const refreshed = await this.tryRefresh();
          if (refreshed) {
            return await this.execute<T>(path, { ...options, _retried: true });
          }
        }
        // Only clear session for authenticated calls — never on public login/register 401s.
        this.config.onUnauthorized?.();
      }

      return await parseApiResponse<T>(response);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /** For endpoints that return a non-JSON download (e.g. CSV export)
   * instead of the standard `{success, data}` envelope every other
   * endpoint uses — same auth header, no refresh-retry (a rare,
   * user-initiated download failing on an expired token is fine to just
   * surface as an error; the next click after any other action refreshes
   * the token normally). */
  public async requestBlob(path: string): Promise<Blob> {
    const url = `${this.config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers: Record<string, string> = {};
    const token = this.config.getAccessToken?.();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new DripplexNetworkError('NETWORK', 'Failed to download file.');
    }
    return await response.blob();
  }

  private async tryRefresh(): Promise<boolean> {
    if (!this.config.getRefreshToken || !this.config.onTokensUpdated) {
      return false;
    }

    this.refreshPromise ??= this.performRefresh().finally(() => {
      this.refreshPromise = null;
    });

    return await this.refreshPromise;
  }

  private async performRefresh(): Promise<boolean> {
    const refreshToken = this.config.getRefreshToken?.();
    if (!refreshToken) {
      return false;
    }

    try {
      const tokens = await this.execute<RefreshResponse>('/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
        auth: false,
        _retried: true,
      });

      this.config.onTokensUpdated?.({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        ...(tokens.expiresIn !== undefined ? { expiresIn: tokens.expiresIn } : {}),
        ...(tokens.tokenType !== undefined ? { tokenType: tokens.tokenType } : {}),
      });
      return true;
    } catch {
      return false;
    }
  }
}
