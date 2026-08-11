// DPX-RIDER-001 — delivery-rider approval lifecycle types. Mirrors the driver
// approval DTOs; riders have a leaner profile (no vehicle/inspection gate).
// DPX-RIDER-002 adds document KYC (ID + guarantor ID) and a company name.

import type { KycDocumentType, KycVerificationStatus } from '../merchant/index.js';
import type { RatingSummaryDto } from '../product/index.js';

export type RiderStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

/** DPX-RIDER-002 — a single rider KYC document. Same shape as DriverKycDto
 * minus the driver-only insurance/licence `expiresAt`; riders submit an ID
 * and a guarantor ID, neither of which has a meaningful expiry. */
export interface RiderKycDto {
  id: string;
  riderId: string;
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

export interface RiderProfileDto {
  id: string;
  riderId: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  status: RiderStatus;
  /** DPX-RIDER-002 — the company/organisation the rider delivers for. */
  companyName: string | null;
  isApproved: boolean;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectedReason: string | null;
  suspendedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** DPX-RIDER-002 — the rider's submitted KYC documents. */
  kyc: RiderKycDto[];
  /** DPX-REVIEWS-001 — the rider's public delivery rating (avg ★ + count),
   * sourced from ReviewAggregate(RIDER). Zero/empty when unrated. */
  rating: RatingSummaryDto;
}

/** DPX-RIDER-002 — self-service update of the rider's own profile fields.
 * Currently just the company name (founder scope: name only). */
export interface UpdateRiderProfileRequest {
  companyName?: string | null;
}

/** DPX-RIDER-002 — self-service rider KYC document submission. Image fields
 * are hosted-URL strings (uploaded first via the signed-upload flow), same
 * convention as the driver KYC submission. */
export interface SubmitRiderKycRequest {
  documentType: KycDocumentType;
  documentNumber: string;
  frontImage: string;
  backImage?: string;
}

export interface RiderApprovalDto {
  riderId: string;
  status: RiderStatus;
  approvedAt?: string;
  approvedBy?: string;
  rejectedReason?: string;
}
