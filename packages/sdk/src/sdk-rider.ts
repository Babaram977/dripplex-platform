import { DripplexClient } from './client/dripplex-client.js';
import { resolveSdkConfig } from './config/sdk-config.js';

import type { SdkConfig } from './config/sdk-config.js';

/**
 * Rider portal SDK barrel — the only public Backend Core integration point
 * for rider-portal screens and components.
 */
export function createRiderSdk(config: Partial<SdkConfig> = {}): RiderSdk {
  const client = new DripplexClient(config);
  return {
    auth: client.auth,
    riderDelivery: client.riderDelivery,
    notifications: client.notifications,
    wallet: client.wallet,
    analytics: client.analytics,
  };
}

export interface RiderSdk {
  auth: DripplexClient['auth'];
  riderDelivery: DripplexClient['riderDelivery'];
  notifications: DripplexClient['notifications'];
  wallet: DripplexClient['wallet'];
  analytics: DripplexClient['analytics'];
}

export function resolveRiderSdkConfig(config: Partial<SdkConfig> = {}): SdkConfig {
  return resolveSdkConfig(config);
}

export { DripplexApiError } from './errors/api-error.js';
export { DripplexNetworkError } from './errors/network-error.js';
export { describeSdkError, messageForHttpStatus } from './errors/status-messages.js';
export type { SdkConfig, AuthTokensUpdate } from './config/sdk-config.js';
