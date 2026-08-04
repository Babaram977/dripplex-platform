import type { OnboardingStatus } from '../auth/index.js';
import type { KycDocumentType, KycVerificationStatus } from '../merchant/index.js';
import type { RideType } from '../ride/index.js';

export type { OnboardingStatus };

// --- DPX-DRIVER-002: Vehicle Management ---

export type VehicleApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface VehicleDto {
  id: string;
  driverId: string;
  plateNumber: string;
  make: string;
  model: string;
  color: string;
  year: number;
  rideCategory: RideType;
  isActive: boolean;
  approvalStatus: VehicleApprovalStatus;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectedReason: string | null;
  photos: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateVehicleRequest {
  plateNumber: string;
  make: string;
  model: string;
  color: string;
  year: number;
  rideCategory: RideType;
  photos?: string[];
}

export interface UpdateVehicleRequest {
  make?: string;
  model?: string;
  color?: string;
  year?: number;
  rideCategory?: RideType;
  isActive?: boolean;
  photos?: string[];
}

export interface RejectVehicleRequest {
  rejectedReason: string;
}

// --- DPX-DRIVER-002: Inspection Engine ---

export interface InspectionCentreDto {
  id: string;
  name: string;
  address: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInspectionCentreRequest {
  name: string;
  address: string;
  city: string;
  latitude?: number;
  longitude?: number;
}

export interface UpdateInspectionCentreRequest {
  name?: string;
  address?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  isActive?: boolean;
}

export type InspectionStatus = 'SCHEDULED' | 'PASSED' | 'FAILED' | 'CANCELLED';

/** Free-form checklist item recorded by an Inspection Officer. The item set
 * itself is not enum-modeled here — see DPX-DRIVER-002 Phase 3 for the
 * baseline checklist categories (tyres/brakes/lights/etc.). */
export interface InspectionChecklistItem {
  key: string;
  label: string;
  passed: boolean;
  notes?: string;
}

export interface InspectionDto {
  id: string;
  driverId: string;
  vehicleId: string;
  centreId: string;
  /** Officer who conducted the walkthrough and recorded the checklist. */
  inspectorId: string | null;
  /** Supervisor who made the final pass/fail call — distinct from `inspectorId`. */
  decidedBy: string | null;
  status: InspectionStatus;
  scheduledAt: string;
  completedAt: string | null;
  checklist: InspectionChecklistItem[] | null;
  notes: string | null;
  photos: string[];
  /** Non-null when this inspection was scheduled as a re-inspection of an earlier one. */
  reinspectionOfId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleInspectionRequest {
  vehicleId: string;
  centreId: string;
  scheduledAt: string;
  /** Set when scheduling a re-inspection of a failed inspection. */
  reinspectionOfId?: string;
  notes?: string;
}

export interface RecordInspectionChecklistRequest {
  checklist: InspectionChecklistItem[];
  photos?: string[];
  notes?: string;
}

export interface DecideInspectionRequest {
  passed: boolean;
  notes?: string;
}

export type DriverStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export interface DriverKycDto {
  id: string;
  driverId: string;
  documentType: KycDocumentType;
  documentNumber: string;
  frontImage: string;
  backImage: string | null;
  /** DPX-DRIVER-002 — insurance/licence expiry tracking. */
  expiresAt: string | null;
  verificationStatus: KycVerificationStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  remarks: string | null;
  createdAt: string;
}

export interface DriverProfileDto {
  id: string;
  driverId: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  status: DriverStatus;
  isApproved: boolean;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectedReason: string | null;
  suspendedAt: string | null;
  /** DPX-DRIVER-002 Phase 1 */
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  /** DPX-DRIVER-002 Phase 4 */
  agreementAcceptedAt: string | null;
  agreementVersion: string | null;
  createdAt: string;
  updatedAt: string;
  kyc: DriverKycDto[];
}

export interface SubmitDriverKycRequest {
  documentType: KycDocumentType;
  documentNumber: string;
  frontImage: string;
  backImage?: string;
  expiresAt?: string;
}

/** DPX-DRIVER-002 Phase 1 — structured onboarding submission (emergency
 * contact + agreement acceptance). Replaces the flat single-document-upload
 * flow this pairs with `SubmitDriverKycRequest` for. */
export interface SubmitEmergencyContactRequest {
  emergencyContactName: string;
  emergencyContactPhone: string;
}

export interface AcceptDriverAgreementRequest {
  agreementVersion: string;
}

export interface DriverOnboardingDto {
  id: string;
  driverId: string;
  status: OnboardingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DriverApprovalDto {
  driverId: string;
  status: DriverStatus;
  approvedAt?: string;
  approvedBy?: string;
  rejectedReason?: string;
}

/** DPX-DRIVER-002 Phase 4 — the single unified activation gate. Every place
 * that activates a driver (approve, reactivate) evaluates this same check;
 * it is also exposed directly so a driver or admin can see exactly what's
 * blocking activation before attempting it. See DriverActivationService. */
export interface DriverActivationChecks {
  identityVerified: boolean;
  requiredDocumentsApproved: boolean;
  vehicleApproved: boolean;
  inspectionPassed: boolean;
  agreementAccepted: boolean;
  accountNotLocked: boolean;
}

export interface DriverActivationEligibilityDto {
  driverId: string;
  eligible: boolean;
  checks: DriverActivationChecks;
  /** Human-readable reasons for each unmet check, in the same order as
   * `checks`'s keys — empty when `eligible` is true. */
  missingReasons: string[];
  /** The vehicle that satisfied `vehicleApproved`/`inspectionPassed`, if any. */
  qualifyingVehicleId: string | null;
}

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

export type DriverAuditAction = (typeof DRIVER_AUDIT_ACTIONS)[keyof typeof DRIVER_AUDIT_ACTIONS];

/** Driver-001: risk-based facial/identity verification (Smile ID). See
 * docs/DRIVER-001-IDENTITY-VERIFICATION-DESIGN.md. */
export type IdentityVerificationProviderName = 'SMILE_ID';

export type DriverVerificationTrigger =
  | 'ONBOARDING'
  | 'IDLE_TIMEOUT'
  | 'NEW_DEVICE'
  | 'SUSPICIOUS_ACTIVITY'
  | 'ACCOUNT_RECOVERY'
  | 'MANUAL_ADMIN'
  | 'CREDENTIAL_CHANGE'
  | 'FAILED_LOGIN_LOCKOUT'
  | 'FIRST_LOGIN_OF_DAY'
  | 'GPS_ANOMALY'
  | 'RANDOM_SPOT_CHECK'
  | 'PHONE_NUMBER_CHANGED';

export type DriverVerificationStatus = 'PENDING' | 'PASSED' | 'FAILED' | 'ERROR';

export interface DriverIdentityVerificationDto {
  id: string;
  driverId: string;
  provider: IdentityVerificationProviderName;
  trigger: DriverVerificationTrigger;
  status: DriverVerificationStatus;
  confidenceScore: number | null;
  failureReason: string | null;
  sessionId: string | null;
  requestedAt: string;
  completedAt: string | null;
}

export interface IdentityVerificationStatusDto {
  required: boolean;
  reason: DriverVerificationTrigger | null;
  lastVerifiedAt: string | null;
  /** DPX-DS-001: true = a support-review lock, not a normal retry-able
   * requirement — the client must not offer the capture flow. */
  locked: boolean;
}

/** Driver-001 Security Standard — admin-configurable risk-engine policy.
 * Editable without a redeploy; see docs/DPX-DRIVER-001-SECURITY-STANDARD.md. */
export interface DriverSecuritySettingsDto {
  id: string;
  idleHours: number;
  gpsAnomalySpeedKmh: number;
  lockoutThreshold: number;
  spotCheckDenominator: number;
  newDeviceVerificationEnabled: boolean;
  adminForceVerificationEnabled: boolean;
  updatedBy: string | null;
  updatedAt: string;
}

export interface UpdateDriverSecuritySettingsRequest {
  idleHours?: number;
  gpsAnomalySpeedKmh?: number;
  lockoutThreshold?: number;
  spotCheckDenominator?: number;
  newDeviceVerificationEnabled?: boolean;
  adminForceVerificationEnabled?: boolean;
}

export interface SubmitIdentityVerificationRequest {
  selfieImageBase64: string;
  idDocumentImageBase64?: string;
  idNumber?: string;
  deviceId?: string;
  latitude?: number;
  longitude?: number;
}

/** Driver Slice 2 item 2 — one-tap phone calling (founder-approved
 * 2026-08-04): plain `tel:` calling only, no masked calling. Resolved from
 * the Ride module's own tables (read-only, cross-module — see
 * `DriverRideContactService`) for whichever ride is currently active for
 * the calling driver (`DRIVER_ASSIGNED`/`ARRIVED`/`IN_PROGRESS`). `phone` is
 * `null` when the customer has no phone on file — the UI must handle that
 * honestly rather than assume a number always exists. */
export interface RidePassengerContactDto {
  rideId: string;
  customerId: string;
  name: string;
  phone: string | null;
}
