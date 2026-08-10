// DPX-RIDER-001 — delivery-rider approval lifecycle types. Mirrors the driver
// approval DTOs; riders have a leaner profile (no KYC/vehicle gate).

export type RiderStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export interface RiderProfileDto {
  id: string;
  riderId: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  status: RiderStatus;
  isApproved: boolean;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectedReason: string | null;
  suspendedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RiderApprovalDto {
  riderId: string;
  status: RiderStatus;
  approvedAt?: string;
  approvedBy?: string;
  rejectedReason?: string;
}
