import { DripplexClient } from './client/dripplex-client.js';
import { resolveSdkConfig } from './config/sdk-config.js';

import type { SdkConfig } from './config/sdk-config.js';

/**
 * Driver portal SDK barrel — the only public Backend Core integration point
 * for driver-portal screens and components.
 */
export function createDriverSdk(config: Partial<SdkConfig> = {}): DriverSdk {
  const client = new DripplexClient(config);
  return {
    auth: client.auth,
    driverCampaign: client.driverCampaign,
    notifications: client.driverNotifications,
    wallet: client.wallet,
  };
}

export interface DriverSdk {
  auth: DripplexClient['auth'];
  driverCampaign: DripplexClient['driverCampaign'];
  notifications: DripplexClient['driverNotifications'];
  wallet: DripplexClient['wallet'];
}

export function resolveDriverSdkConfig(config: Partial<SdkConfig> = {}): SdkConfig {
  return resolveSdkConfig(config);
}

export { DripplexApiError } from './errors/api-error.js';
export { DripplexNetworkError } from './errors/network-error.js';
export { describeSdkError, messageForHttpStatus } from './errors/status-messages.js';
export type { SdkConfig, AuthTokensUpdate } from './config/sdk-config.js';
