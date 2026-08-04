import { KycDocumentType } from '@prisma/client';

/** DPX-DRIVER-002 Phase 4 — a driver must have a VERIFIED document of each of
 * these types before activation. Single source of truth, read by
 * DriverActivationService — not duplicated anywhere else. */
export const REQUIRED_DRIVER_KYC_DOCUMENT_TYPES: readonly KycDocumentType[] = [
  KycDocumentType.DRIVER_LICENSE,
  KycDocumentType.VEHICLE_REGISTRATION,
  KycDocumentType.GUARANTOR_ID,
];

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
  /// DPX-DRIVER-002
  VEHICLE_SUBMITTED: 'driver.vehicle.submitted',
  VEHICLE_APPROVED: 'driver.vehicle.approved',
  VEHICLE_REJECTED: 'driver.vehicle.rejected',
  EMERGENCY_CONTACT_UPDATED: 'driver.emergency_contact.updated',
  AGREEMENT_ACCEPTED: 'driver.agreement.accepted',
  ONBOARDING_SUBMITTED: 'driver.onboarding.submitted',
  INSPECTION_CENTRE_CREATED: 'driver.inspection_centre.created',
  INSPECTION_CENTRE_UPDATED: 'driver.inspection_centre.updated',
  INSPECTION_SCHEDULED: 'driver.inspection.scheduled',
  INSPECTION_CHECKLIST_RECORDED: 'driver.inspection.checklist_recorded',
  INSPECTION_PASSED: 'driver.inspection.passed',
  INSPECTION_FAILED: 'driver.inspection.failed',
  INSPECTION_CANCELLED: 'driver.inspection.cancelled',
  /// Driver Slice 2 item 3
  SUPPORT_TICKET_SUBMITTED: 'driver.support_ticket.submitted',
  SUPPORT_TICKET_UPDATED: 'driver.support_ticket.updated',
  /// Driver Slice 2 item 4
  INCIDENT_REPORT_SUBMITTED: 'driver.incident_report.submitted',
  INCIDENT_REPORT_UPDATED: 'driver.incident_report.updated',
  /// Driver Slice 2 item 5
  SOS_ALERT_TRIGGERED: 'driver.sos_alert.triggered',
  SOS_ALERT_UPDATED: 'driver.sos_alert.updated',
  /// Driver Slice 2 item 6
  SHIFT_STARTED: 'driver.shift.started',
  SHIFT_BREAK_STARTED: 'driver.shift.break_started',
  SHIFT_BREAK_ENDED: 'driver.shift.break_ended',
  SHIFT_ENDED: 'driver.shift.ended',
  SHIFT_FORCE_ENDED: 'driver.shift.force_ended',
  PLANNED_AVAILABILITY_SET: 'driver.planned_availability.set',
  PLANNED_AVAILABILITY_DELETED: 'driver.planned_availability.deleted',
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
  /// DPX-DRIVER-002 — reuses the pre-existing 'driver:onboarding:submit'
  /// seed permission (previously unwired to any endpoint; DriverOnboarding
  /// itself was a vestigial, unused model before this).
  ONBOARDING_MANAGE: 'driver:onboarding:submit',
  VEHICLE_MANAGE: 'driver:vehicle:manage',
  ADMIN_VEHICLE_MANAGE: 'admin:drivers:vehicles:manage',
  INSPECTION_BOOK: 'driver:inspection:manage',
  ADMIN_INSPECTION_CENTRES_MANAGE: 'admin:inspection-centres:manage',
  /// Inspection Officer — records the checklist/photos on an assigned
  /// inspection. Distinct from the supervisor's approve/reject authority.
  INSPECTION_CHECKLIST_MANAGE: 'inspection:checklist:manage',
  /// Inspection Supervisor — final pass/fail decision, re-inspection
  /// scheduling, full inspection history/reporting.
  INSPECTION_APPROVE: 'inspection:approve',
  /// Driver Slice 2 item 3 — Driver Support
  SUPPORT_TICKET_MANAGE: 'driver:support-ticket:manage',
  ADMIN_SUPPORT_TICKET_MANAGE: 'admin:drivers:support-ticket:manage',
  /// Driver Slice 2 item 4 — Incident Reporting
  INCIDENT_REPORT_MANAGE: 'driver:incident-report:manage',
  ADMIN_INCIDENT_REPORT_MANAGE: 'admin:drivers:incident-report:manage',
  /// Driver Slice 2 item 5 — SOS/Emergency
  SOS_ALERT_MANAGE: 'driver:sos-alert:manage',
  ADMIN_SOS_ALERT_MANAGE: 'admin:drivers:sos-alert:manage',
  /// Driver Slice 2 item 6 — Shift Management (covers shift lifecycle +
  /// planned availability; one flat permission per side, no need to split
  /// further for v1)
  SHIFT_MANAGE: 'driver:shift:manage',
  ADMIN_SHIFT_MANAGE: 'admin:drivers:shifts:manage',
  /// Driver Slice 2 item 7 — Help Centre. Read-only; authoring goes
  /// through the existing admin:cms:manage permission (AdminCmsController)
  /// — no new admin permission needed.
  HELP_READ: 'driver:help:read',
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

/** Driver Slice 2 item 6 — Shift Management safety tracking (founder-added
 * scope, 2026-08-04): advisory-only figures surfaced to the driver and
 * Operations — `DriverShiftService` never blocks a shift/break/trip action
 * on these. Plain constants for v1 (not admin-configurable like
 * `DriverSecuritySettings` — no request for that here); revisit if the
 * founder wants per-market tuning later. */
/** Continuous driving time (minutes, since shift start or the last break
 * ended) after which a break reminder becomes due. */
export const DEFAULT_SHIFT_BREAK_REMINDER_MINUTES = 240;
/** Continuous driving time (minutes) after which the (separate, more
 * urgent) fatigue warning is raised — intentionally higher than the break
 * reminder threshold. */
export const DEFAULT_SHIFT_FATIGUE_WARNING_MINUTES = 300;
/** Recommended maximum total minutes worked (across all shifts) per
 * calendar day before `dailyLimitExceeded` is raised. */
export const DEFAULT_SHIFT_MAX_DAILY_MINUTES = 720;
