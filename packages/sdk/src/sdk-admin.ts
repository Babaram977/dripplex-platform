import { DripplexClient } from './client/dripplex-client.js';
import { resolveSdkConfig } from './config/sdk-config.js';

import type { SdkConfig } from './config/sdk-config.js';

/**
 * Admin & Operations SDK barrel — the only public Backend Core integration point
 * for admin-portal and operations-console screens and components.
 */
export function createAdminSdk(config: Partial<SdkConfig> = {}): AdminSdk {
  const client = new DripplexClient(config);
  return {
    auth: client.auth,
    adminMerchants: client.adminMerchants,
    adminDelivery: client.adminDelivery,
    adminWallet: client.adminWallet,
    adminCms: client.adminCms,
    adminFraud: client.adminFraud,
    adminReferrals: client.adminReferrals,
    adminDriverCampaign: client.adminDriverCampaign,
    adminDriverSecuritySettings: client.adminDriverSecuritySettings,
    adminDrivers: client.adminDrivers,
    adminDriverVehicles: client.adminDriverVehicles,
    adminInspectionCentres: client.adminInspectionCentres,
    operationsInspections: client.operationsInspections,
    adminPromotions: client.adminPromotions,
    analytics: client.analytics,
    notifications: client.notifications,
    promotions: client.promotions,
    reviews: client.reviews,
    search: client.search,
    cms: client.cms,
    wallet: client.wallet,
  };
}

export interface AdminSdk {
  auth: DripplexClient['auth'];
  adminMerchants: DripplexClient['adminMerchants'];
  adminDelivery: DripplexClient['adminDelivery'];
  adminWallet: DripplexClient['adminWallet'];
  adminCms: DripplexClient['adminCms'];
  adminFraud: DripplexClient['adminFraud'];
  adminReferrals: DripplexClient['adminReferrals'];
  adminDriverCampaign: DripplexClient['adminDriverCampaign'];
  adminDriverSecuritySettings: DripplexClient['adminDriverSecuritySettings'];
  adminDrivers: DripplexClient['adminDrivers'];
  adminDriverVehicles: DripplexClient['adminDriverVehicles'];
  adminInspectionCentres: DripplexClient['adminInspectionCentres'];
  operationsInspections: DripplexClient['operationsInspections'];
  adminPromotions: DripplexClient['adminPromotions'];
  analytics: DripplexClient['analytics'];
  notifications: DripplexClient['notifications'];
  promotions: DripplexClient['promotions'];
  reviews: DripplexClient['reviews'];
  search: DripplexClient['search'];
  cms: DripplexClient['cms'];
  wallet: DripplexClient['wallet'];
}

export function resolveAdminSdkConfig(config: Partial<SdkConfig> = {}): SdkConfig {
  return resolveSdkConfig(config);
}

export { DripplexApiError } from './errors/api-error.js';
export { DripplexNetworkError } from './errors/network-error.js';
export { describeSdkError, messageForHttpStatus } from './errors/status-messages.js';
export type { SdkConfig, AuthTokensUpdate } from './config/sdk-config.js';
