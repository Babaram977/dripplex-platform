export interface SdkConfig {
  baseUrl: string;
  getAccessToken?: () => string | null | undefined;
  onUnauthorized?: () => void;
}

export function resolveSdkConfig(config: Partial<SdkConfig> = {}): SdkConfig {
  const baseUrl =
    config.baseUrl ??
    (typeof process !== 'undefined' ? process.env['NEXT_PUBLIC_API_BASE_URL'] : undefined) ??
    'http://localhost:3000/api/v1';

  const resolved: SdkConfig = {
    baseUrl: baseUrl.replace(/\/$/, ''),
  };

  if (config.getAccessToken) {
    resolved.getAccessToken = config.getAccessToken;
  }

  if (config.onUnauthorized) {
    resolved.onUnauthorized = config.onUnauthorized;
  }

  return resolved;
}
