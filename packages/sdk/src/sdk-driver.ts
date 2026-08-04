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
    rides: client.driverRides,
    profile: client.driverProfile,
    rideContact: client.driverRideContact,
    support: client.driverSupport,
    incidentReports: client.driverIncidentReports,
    sosAlerts: client.driverSosAlerts,
    shifts: client.driverShifts,
    plannedAvailability: client.driverPlannedAvailability,
    help: client.driverHelp,
    identityVerification: client.driverIdentityVerification,
    vehicles: client.driverVehicles,
    onboarding: client.driverOnboarding,
    inspections: client.driverInspections,
  };
}

export interface DriverSdk {
  auth: DripplexClient['auth'];
  driverCampaign: DripplexClient['driverCampaign'];
  notifications: DripplexClient['driverNotifications'];
  wallet: DripplexClient['wallet'];
  rides: DripplexClient['driverRides'];
  profile: DripplexClient['driverProfile'];
  rideContact: DripplexClient['driverRideContact'];
  support: DripplexClient['driverSupport'];
  incidentReports: DripplexClient['driverIncidentReports'];
  sosAlerts: DripplexClient['driverSosAlerts'];
  shifts: DripplexClient['driverShifts'];
  plannedAvailability: DripplexClient['driverPlannedAvailability'];
  help: DripplexClient['driverHelp'];
  identityVerification: DripplexClient['driverIdentityVerification'];
  vehicles: DripplexClient['driverVehicles'];
  onboarding: DripplexClient['driverOnboarding'];
  inspections: DripplexClient['driverInspections'];
}

export function resolveDriverSdkConfig(config: Partial<SdkConfig> = {}): SdkConfig {
  return resolveSdkConfig(config);
}

export { DripplexApiError } from './errors/api-error.js';
export { DripplexNetworkError } from './errors/network-error.js';
export { describeSdkError, messageForHttpStatus } from './errors/status-messages.js';
export type { SdkConfig, AuthTokensUpdate } from './config/sdk-config.js';
