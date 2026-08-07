import type { KycDocumentType } from '../merchant/index.js';

/**
 * DPX-PROFILE-KYC-001/002 — customer identity verification (Level 2).
 * Founder-locked lifecycle (2026-08-07): NOT_STARTED, IN_PROGRESS,
 * PENDING_REVIEW, VERIFIED, REJECTED, EXPIRED, REQUIRES_RESUBMISSION.
 * Deliberately separate from `KycVerificationStatus` (driver/merchant) --
 * different persona, different lifecycle richness, and the driver/merchant
 * pipeline is frozen/shipped.
 */
export type CustomerKycStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'PENDING_REVIEW'
  | 'VERIFIED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'REQUIRES_RESUBMISSION';

export type CustomerKycLevel = 'LEVEL_0' | 'LEVEL_1' | 'LEVEL_2';

export interface CustomerKycStatusDto {
  level: CustomerKycLevel;
  status: CustomerKycStatus;
  documentType: KycDocumentType | null;
  documentNumber: string | null;
  frontImageUrl: string | null;
  backImageUrl: string | null;
  selfieUrl: string | null;
  remarks: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  reviewStartedAt: string | null;
  reviewedAt: string | null;
  verifiedAt: string | null;
  rejectedAt: string | null;
  expiresAt: string | null;
  /**
   * Whether the account already meets Level 0 (phone verified) / Level 1
   * (phone + email verified, or no email on the account) requirements --
   * neither goes through this document flow, so this is read-only context
   * for the UI, not something `POST /kyc/me/start`/`submit` can change.
   */
  levelAccess: {
    level0: boolean;
    level1: boolean;
  };
}

export interface SubmitCustomerKycValues {
  documentType: KycDocumentType;
  documentNumber?: string;
  frontImageUrl: string;
  backImageUrl?: string;
  selfieUrl?: string;
}

export interface AdminCustomerKycListItemDto {
  id: string;
  userId: string;
  userFullName: string;
  userEmail: string;
  status: CustomerKycStatus;
  documentType: KycDocumentType | null;
  submittedAt: string | null;
  createdAt: string;
}

export interface ReviewCustomerKycValues {
  remarks?: string;
}

export interface RejectCustomerKycValues {
  remarks: string;
}
