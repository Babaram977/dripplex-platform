import type { KycDocumentType, KycVerificationStatus } from '../merchant/index.js';

export type DriverStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export interface DriverKycDto {
  id: string;
  driverId: string;
  documentType: KycDocumentType;
  documentNumber: string;
  frontImage: string;
  backImage: string | null;
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
  createdAt: string;
  updatedAt: string;
  kyc: DriverKycDto[];
}

export interface SubmitDriverKycRequest {
  documentType: KycDocumentType;
  documentNumber: string;
  frontImage: string;
  backImage?: string;
}

export interface DriverApprovalDto {
  driverId: string;
  status: DriverStatus;
  approvedAt?: string;
  approvedBy?: string;
  rejectedReason?: string;
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

export interface SubmitIdentityVerificationRequest {
  selfieImageBase64: string;
  idDocumentImageBase64?: string;
  idNumber?: string;
  deviceId?: string;
  latitude?: number;
  longitude?: number;
}
