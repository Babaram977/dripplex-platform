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
} as const;

export type DriverAuditAction = (typeof DRIVER_AUDIT_ACTIONS)[keyof typeof DRIVER_AUDIT_ACTIONS];
