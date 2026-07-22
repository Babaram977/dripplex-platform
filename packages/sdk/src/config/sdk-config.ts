export interface AuthTokensUpdate {
  accessToken: string;
  refreshToken: string;
  expiresIn?: string;
  tokenType?: 'Bearer';
}

export interface SdkConfig {
  baseUrl: string;
  /** Request timeout in milliseconds. Defaults to 30_000. */
  timeoutMs: number;
  getAccessToken?: () => string | null | undefined;
  getRefreshToken?: () => string | null | undefined;
  /** Called after a successful refresh-token rotation. */
  onTokensUpdated?: (tokens: AuthTokensUpdate) => void;
  /** Called when an authenticated request fails with 401 and refresh cannot recover. */
  onUnauthorized?: () => void;
}

export function resolveSdkConfig(config: Partial<SdkConfig> = {}): SdkConfig {
  const baseUrl =
    config.baseUrl ??
    (typeof process !== 'undefined' ? process.env['NEXT_PUBLIC_API_BASE_URL'] : undefined) ??
    'http://localhost:3000/api/v1';

  const resolved: SdkConfig = {
    baseUrl: baseUrl.replace(/\/$/, ''),
    timeoutMs: config.timeoutMs ?? 30_000,
  };

  if (config.getAccessToken) {
    resolved.getAccessToken = config.getAccessToken;
  }

  if (config.getRefreshToken) {
    resolved.getRefreshToken = config.getRefreshToken;
  }

  if (config.onTokensUpdated) {
    resolved.onTokensUpdated = config.onTokensUpdated;
  }

  if (config.onUnauthorized) {
    resolved.onUnauthorized = config.onUnauthorized;
  }

  return resolved;
}
