export const DRIVER_AUDIT_ACTIONS = {
  KYC_SUBMITTED: 'driver.kyc.submitted',
  KYC_VERIFIED: 'driver.kyc.verified',
  KYC_REJECTED: 'driver.kyc.rejected',
  APPROVED: 'driver.approved',
  REJECTED: 'driver.rejected',
  SUSPENDED: 'driver.suspended',
  REACTIVATED: 'driver.reactivated',
  IDENTITY_VERIFICATION_REQUESTED: 'driver.identity_verification.requested',
  IDENTITY_VERIFICATION_PASSED: 'driver.identity_verification.passed',
  IDENTITY_VERIFICATION_FAILED: 'driver.identity_verification.failed',
  IDENTITY_VERIFICATION_LOCKED: 'driver.identity_verification.locked',
  IDENTITY_VERIFICATION_UNLOCKED: 'driver.identity_verification.unlocked',
  SECURITY_SETTINGS_UPDATED: 'driver.security_settings.updated',
} as const;

export const DRIVER_PERMISSIONS = {
  KYC_MANAGE: 'driver:kyc:manage',
  IDENTITY_VERIFICATION_MANAGE: 'driver:identity-verification:manage',
  REVIEW: 'admin:drivers:review',
  APPROVE: 'admin:drivers:approve',
  REJECT: 'admin:drivers:reject',
  SUSPEND: 'admin:drivers:suspend',
  REACTIVATE: 'admin:drivers:reactivate',
  ADMIN_IDENTITY_VERIFICATION_MANAGE: 'admin:drivers:identity-verification:manage',
  ADMIN_SECURITY_SETTINGS_MANAGE: 'admin:drivers:security-settings:manage',
} as const;

/** DriverSecuritySettings is a singleton row (enforced at the service
 * layer, not a DB constraint) — always read/written by this fixed id. */
export const DRIVER_SECURITY_SETTINGS_ID = '00000000-0000-0000-0000-000000000001';

/** Idle period after which a driver going online must re-verify their
 * identity. Founder-reconfirmed default is 2h (was 8h; originally-approved
 * range was 6-12h before the founder explicitly tightened it). This constant
 * (via IDENTITY_VERIFICATION_IDLE_HOURS) only seeds DriverSecuritySettings
 * the first time that row is created — an admin can change the effective
 * value afterward without a redeploy. Not read directly by the risk engine. */
export const DEFAULT_IDENTITY_VERIFICATION_IDLE_HOURS = 2;

/** DPX-DS-001 risk-engine thresholds — extensible/configurable per the
 * founder's standard, not hard-coded. Real defaults live here; they seed
 * DriverSecuritySettings (via AppConfigService's DRIVER_IDV_* env vars) the
 * first time that row is created. Not read directly by the risk engine
 * afterward — see DriverSecuritySettingsService. */
export const DEFAULT_IDENTITY_VERIFICATION_LOCKOUT_THRESHOLD = 5;
export const DEFAULT_GPS_ANOMALY_SPEED_KMH_THRESHOLD = 150;
export const DEFAULT_RANDOM_SPOT_CHECK_DENOMINATOR = 20;
/** Below this elapsed gap, skip the GPS-anomaly check entirely — normal GPS
 * jitter over a short window can imply an absurd speed with no real signal.
 * Not a security threshold the founder specified — a false-positive guard,
 * left as a constant, not part of DriverSecuritySettings. */
export const GPS_ANOMALY_MIN_INTERVAL_MS = 5 * 60 * 1000;
