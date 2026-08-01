import { DripplexClient } from './client/dripplex-client.js';
import { resolveSdkConfig } from './config/sdk-config.js';

import type { SdkConfig } from './config/sdk-config.js';

/**
 * Customer portal SDK barrel — the only public Backend Core integration point
 * for customer-web screens and components.
 */
export function createCustomerSdk(config: Partial<SdkConfig> = {}): CustomerSdk {
  const client = new DripplexClient(config);
  return {
    auth: client.auth,
    addresses: client.addresses,
    products: client.products,
    merchants: client.merchants,
    cart: client.cart,
    orders: client.orders,
    payments: client.payments,
    delivery: client.delivery,
    rides: client.rides,
    notifications: client.notifications,
    search: client.search,
    reviews: client.reviews,
    wishlist: client.wishlist,
    promotions: client.promotions,
    loyalty: client.loyalty,
    wallet: client.wallet,
    analytics: client.analytics,
    cms: client.cms,
  };
}

export interface CustomerSdk {
  auth: DripplexClient['auth'];
  addresses: DripplexClient['addresses'];
  products: DripplexClient['products'];
  merchants: DripplexClient['merchants'];
  cart: DripplexClient['cart'];
  orders: DripplexClient['orders'];
  payments: DripplexClient['payments'];
  delivery: DripplexClient['delivery'];
  rides: DripplexClient['rides'];
  notifications: DripplexClient['notifications'];
  search: DripplexClient['search'];
  reviews: DripplexClient['reviews'];
  wishlist: DripplexClient['wishlist'];
  promotions: DripplexClient['promotions'];
  loyalty: DripplexClient['loyalty'];
  wallet: DripplexClient['wallet'];
  analytics: DripplexClient['analytics'];
  cms: DripplexClient['cms'];
}

export function resolveCustomerSdkConfig(config: Partial<SdkConfig> = {}): SdkConfig {
  return resolveSdkConfig(config);
}

export { DripplexApiError } from './errors/api-error.js';
export { DripplexNetworkError } from './errors/network-error.js';
export { describeSdkError, messageForHttpStatus } from './errors/status-messages.js';
export type { SdkConfig, AuthTokensUpdate } from './config/sdk-config.js';
