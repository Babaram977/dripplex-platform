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
    adminDriverIdentityVerification: client.adminDriverIdentityVerification,
    adminDriverPlannedAvailability: client.adminDriverPlannedAvailability,
    adminDriverShifts: client.adminDriverShifts,
    adminRideReports: client.adminRideReports,
    adminDrivers: client.adminDrivers,
    adminRiders: client.adminRiders,
    adminDriverVehicles: client.adminDriverVehicles,
    adminInspectionCentres: client.adminInspectionCentres,
    operationsInspections: client.operationsInspections,
    operationsFleet: client.operationsFleet,
    operationsRides: client.operationsRides,
    operationsQueues: client.operationsQueues,
    operationsCases: client.operationsCases,
    operationsDashboard: client.operationsDashboard,
    operationsStaff: client.operationsStaff,
    operationsAnalytics: client.operationsAnalytics,
    adminPromotions: client.adminPromotions,
    analytics: client.analytics,
    notifications: client.notifications,
    promotions: client.promotions,
    reviews: client.reviews,
    search: client.search,
    cms: client.cms,
    wallet: client.wallet,
    adminCommercialCreditSettings: client.adminCommercialCreditSettings,
    adminPlatformCommissionSettings: client.adminPlatformCommissionSettings,
    adminCommissionAccounts: client.adminCommissionAccounts,
    adminCustomerKyc: client.adminCustomerKyc,
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
  adminDriverIdentityVerification: DripplexClient['adminDriverIdentityVerification'];
  adminDriverPlannedAvailability: DripplexClient['adminDriverPlannedAvailability'];
  adminDriverShifts: DripplexClient['adminDriverShifts'];
  adminRideReports: DripplexClient['adminRideReports'];
  adminDrivers: DripplexClient['adminDrivers'];
  adminRiders: DripplexClient['adminRiders'];
  adminDriverVehicles: DripplexClient['adminDriverVehicles'];
  adminInspectionCentres: DripplexClient['adminInspectionCentres'];
  operationsInspections: DripplexClient['operationsInspections'];
  operationsFleet: DripplexClient['operationsFleet'];
  operationsRides: DripplexClient['operationsRides'];
  operationsQueues: DripplexClient['operationsQueues'];
  operationsCases: DripplexClient['operationsCases'];
  operationsDashboard: DripplexClient['operationsDashboard'];
  operationsStaff: DripplexClient['operationsStaff'];
  operationsAnalytics: DripplexClient['operationsAnalytics'];
  adminPromotions: DripplexClient['adminPromotions'];
  analytics: DripplexClient['analytics'];
  notifications: DripplexClient['notifications'];
  promotions: DripplexClient['promotions'];
  reviews: DripplexClient['reviews'];
  search: DripplexClient['search'];
  cms: DripplexClient['cms'];
  wallet: DripplexClient['wallet'];
  /** DPX-COMMERCIAL-001 Slice 1/5 — commission credit-limit policy (admin-configurable). */
  adminCommercialCreditSettings: DripplexClient['adminCommercialCreditSettings'];
  adminPlatformCommissionSettings: DripplexClient['adminPlatformCommissionSettings'];
  /** DPX-COMMERCIAL-001 Slice 1/5 — any owner's commission account/ledger + manual payment recording. */
  adminCommissionAccounts: DripplexClient['adminCommissionAccounts'];
  /** DPX-PROFILE-KYC-002 — admin review of customer Level 2 identity verification submissions. */
  adminCustomerKyc: DripplexClient['adminCustomerKyc'];
}

export function resolveAdminSdkConfig(config: Partial<SdkConfig> = {}): SdkConfig {
  return resolveSdkConfig(config);
}

export { DripplexApiError } from './errors/api-error.js';
export { DripplexNetworkError } from './errors/network-error.js';
export { describeSdkError, messageForHttpStatus } from './errors/status-messages.js';
export type { SdkConfig, AuthTokensUpdate } from './config/sdk-config.js';
