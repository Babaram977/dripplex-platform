import { DripplexClient } from './client/dripplex-client.js';
import { resolveSdkConfig } from './config/sdk-config.js';

import type { SdkConfig } from './config/sdk-config.js';

/**
 * Merchant portal SDK barrel — the only public Backend Core integration point
 * for merchant-portal screens and components.
 */
export function createMerchantSdk(config: Partial<SdkConfig> = {}): MerchantSdk {
  const client = new DripplexClient(config);
  return {
    auth: client.auth,
    merchant: client.merchant,
    merchantProducts: client.merchantProducts,
    orders: client.orders,
    payments: client.payments,
    notifications: client.merchantNotifications,
    promotions: client.promotions,
    reviews: client.reviews,
    analytics: client.analytics,
    wallet: client.wallet,
  };
}

export interface MerchantSdk {
  auth: DripplexClient['auth'];
  merchant: DripplexClient['merchant'];
  merchantProducts: DripplexClient['merchantProducts'];
  orders: DripplexClient['orders'];
  payments: DripplexClient['payments'];
  notifications: DripplexClient['notifications'];
  promotions: DripplexClient['promotions'];
  reviews: DripplexClient['reviews'];
  analytics: DripplexClient['analytics'];
  wallet: DripplexClient['wallet'];
}

export function resolveMerchantSdkConfig(config: Partial<SdkConfig> = {}): SdkConfig {
  return resolveSdkConfig(config);
}

export { DripplexApiError } from './errors/api-error.js';
export { DripplexNetworkError } from './errors/network-error.js';
export { describeSdkError, messageForHttpStatus } from './errors/status-messages.js';
export type { SdkConfig, AuthTokensUpdate } from './config/sdk-config.js';
