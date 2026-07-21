export type MerchantStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export type BusinessStatus = 'DRAFT' | 'SUBMITTED' | 'ACTIVE' | 'SUSPENDED';

export type BusinessVerificationStatus = 'PENDING' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED';

export type BusinessType =
  'SOLE_PROPRIETORSHIP' | 'PARTNERSHIP' | 'LIMITED_LIABILITY' | 'CORPORATION' | 'OTHER';

export type KycDocumentType =
  'NATIONAL_ID' | 'PASSPORT' | 'DRIVER_LICENSE' | 'CAC_CERTIFICATE' | 'BUSINESS_REGISTRATION';

export type KycVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface BusinessDto {
  id: string;
  merchantId: string;
  businessName: string;
  businessType: BusinessType;
  registrationNumber: string;
  taxNumber: string | null;
  description: string | null;
  email: string;
  phone: string;
  country: string;
  state: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  logoUrl: string | null;
  coverPhotoUrl: string | null;
  status: BusinessStatus;
  verificationStatus: BusinessVerificationStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MerchantKycDto {
  id: string;
  merchantId: string;
  businessId: string;
  documentType: KycDocumentType;
  documentNumber: string;
  frontImage: string;
  backImage: string | null;
  selfieImage: string | null;
  verificationStatus: KycVerificationStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  remarks: string | null;
  createdAt: string;
}

export interface BankAccountDto {
  id: string;
  merchantId: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  currency: string;
  isDefault: boolean;
  verifiedAt: string | null;
  createdAt: string;
}

export interface MerchantProfileDto {
  id: string;
  merchantId: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  status: MerchantStatus;
  isApproved: boolean;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectedReason: string | null;
  suspendedAt: string | null;
  createdAt: string;
  updatedAt: string;
  business: BusinessDto | null;
  kyc: MerchantKycDto | null;
  bankAccounts: BankAccountDto[];
}

export interface MerchantApprovalDto {
  merchantId: string;
  status: MerchantStatus;
  approvedAt?: string;
  approvedBy?: string;
  rejectedReason?: string;
}

export const MERCHANT_AUDIT_ACTIONS = {
  BUSINESS_CREATED: 'merchant.business.created',
  BUSINESS_UPDATED: 'merchant.business.updated',
  KYC_SUBMITTED: 'merchant.kyc.submitted',
  KYC_VERIFIED: 'merchant.kyc.verified',
  KYC_REJECTED: 'merchant.kyc.rejected',
  BANK_CREATED: 'merchant.bank.created',
  BANK_UPDATED: 'merchant.bank.updated',
  APPROVED: 'merchant.approved',
  REJECTED: 'merchant.rejected',
  SUSPENDED: 'merchant.suspended',
  REACTIVATED: 'merchant.reactivated',
} as const;

export type MerchantAuditAction =
  (typeof MERCHANT_AUDIT_ACTIONS)[keyof typeof MERCHANT_AUDIT_ACTIONS];

export interface CreateBusinessRequest {
  businessName: string;
  businessType: BusinessType;
  registrationNumber: string;
  taxNumber?: string;
  description?: string;
  email: string;
  phone: string;
  country: string;
  state: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  logoUrl?: string;
  coverPhotoUrl?: string;
}

export interface UpdateBusinessRequest {
  businessName?: string;
  businessType?: BusinessType;
  registrationNumber?: string;
  taxNumber?: string;
  description?: string;
  email?: string;
  phone?: string;
  country?: string;
  state?: string;
  city?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  logoUrl?: string;
  coverPhotoUrl?: string;
}

export interface SubmitKycRequest {
  documentType: KycDocumentType;
  documentNumber: string;
  frontImage: string;
  backImage?: string;
  selfieImage?: string;
}

export interface CreateBankAccountRequest {
  bankName: string;
  accountName: string;
  accountNumber: string;
  currency?: string;
  isDefault?: boolean;
}

export interface ListMerchantsQuery {
  page?: number;
  limit?: number;
  status?: MerchantStatus;
  verificationStatus?: BusinessVerificationStatus;
  country?: string;
  state?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface PaginatedMerchantsResult {
  items: MerchantProfileDto[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface MerchantDetailResponse {
  profile: MerchantProfileDto;
  auditSummary: {
    action: string;
    count: number;
    lastAt: string | null;
  }[];
}

export interface KycStatusResponse {
  latest: MerchantKycDto | null;
  items: MerchantKycDto[];
}
