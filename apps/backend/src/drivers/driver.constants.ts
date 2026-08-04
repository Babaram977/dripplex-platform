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
} as const;

/** Idle period after which a driver going online must re-verify their
 * identity. Founder-specified range is 6-12h; default sits in the middle.
 * Configurable via IDENTITY_VERIFICATION_IDLE_HOURS, not hardcoded. */
export const DEFAULT_IDENTITY_VERIFICATION_IDLE_HOURS = 8;

/** DPX-DS-001 risk-engine thresholds — extensible/configurable per the
 * founder's standard, not hard-coded. Real defaults live here; the
 * effective values are read from AppConfigService (DRIVER_IDV_* env vars),
 * which fall back to these exact numbers. */
export const DEFAULT_IDENTITY_VERIFICATION_LOCKOUT_THRESHOLD = 5;
export const DEFAULT_GPS_ANOMALY_SPEED_KMH_THRESHOLD = 150;
export const DEFAULT_RANDOM_SPOT_CHECK_DENOMINATOR = 20;
/** Below this elapsed gap, skip the GPS-anomaly check entirely — normal GPS
 * jitter over a short window can imply an absurd speed with no real signal.
 * Not a security threshold the founder specified — a false-positive guard,
 * left as a constant. */
export const GPS_ANOMALY_MIN_INTERVAL_MS = 5 * 60 * 1000;
