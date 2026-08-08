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
    uploads: client.uploads,
    addresses: client.addresses,
    products: client.products,
    merchants: client.merchants,
    cart: client.cart,
    orders: client.orders,
    payments: client.payments,
    delivery: client.delivery,
    rides: client.rides,
    notifications: client.notifications,
    devices: client.devices,
    search: client.search,
    reviews: client.reviews,
    wishlist: client.wishlist,
    promotions: client.promotions,
    referrals: client.referrals,
    loyalty: client.loyalty,
    wallet: client.wallet,
    analytics: client.analytics,
    cms: client.cms,
    /**
     * Super App role-toggle (DPX-100 Phase 1): a customer-web account that
     * becomes a driver still uses this same SDK instance, not a separate
     * driver-portal login. Only the surfaces the in-app Driver Registration
     * flow (DPX-100 Priority 1) actually needs are exposed here -- not the
     * full driver namespace from sdk-driver.ts -- widened deliberately, not
     * wholesale, as more of the in-app Driver section lands.
     */
    driverOnboarding: client.driverOnboarding,
    /** Vehicle registration step -- mirrors DriverVehiclesController. */
    driverVehicles: client.driverVehicles,
    /** KYC document submission + own profile (incl. submitted `kyc[]`)
     * step -- mirrors DriverController. */
    driverProfile: client.driverProfile,
    /**
     * DPX-PROFILE-KYC-002 -- customer-persona Level 2 identity verification
     * (self-service). Deliberately separate from `driverProfile`'s KYC
     * surface above -- different model, different lifecycle.
     */
    kyc: client.kyc,
  };
}

export interface CustomerSdk {
  auth: DripplexClient['auth'];
  uploads: DripplexClient['uploads'];
  addresses: DripplexClient['addresses'];
  products: DripplexClient['products'];
  merchants: DripplexClient['merchants'];
  cart: DripplexClient['cart'];
  orders: DripplexClient['orders'];
  payments: DripplexClient['payments'];
  delivery: DripplexClient['delivery'];
  rides: DripplexClient['rides'];
  notifications: DripplexClient['notifications'];
  devices: DripplexClient['devices'];
  search: DripplexClient['search'];
  reviews: DripplexClient['reviews'];
  wishlist: DripplexClient['wishlist'];
  promotions: DripplexClient['promotions'];
  referrals: DripplexClient['referrals'];
  loyalty: DripplexClient['loyalty'];
  wallet: DripplexClient['wallet'];
  analytics: DripplexClient['analytics'];
  cms: DripplexClient['cms'];
  driverOnboarding: DripplexClient['driverOnboarding'];
  driverVehicles: DripplexClient['driverVehicles'];
  driverProfile: DripplexClient['driverProfile'];
  kyc: DripplexClient['kyc'];
}

export function resolveCustomerSdkConfig(config: Partial<SdkConfig> = {}): SdkConfig {
  return resolveSdkConfig(config);
}

export { DripplexApiError } from './errors/api-error.js';
export { DripplexNetworkError } from './errors/network-error.js';
export { describeSdkError, messageForHttpStatus } from './errors/status-messages.js';
export type { SdkConfig, AuthTokensUpdate } from './config/sdk-config.js';
