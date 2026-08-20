import type { RatingSummaryDto } from '../product/index.js';

export type MerchantStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export type BusinessStatus = 'DRAFT' | 'SUBMITTED' | 'ACTIVE' | 'PAUSED' | 'SUSPENDED';

export type BusinessVerificationStatus = 'PENDING' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED';

export type BusinessType =
  'SOLE_PROPRIETORSHIP' | 'PARTNERSHIP' | 'LIMITED_LIABILITY' | 'CORPORATION' | 'OTHER';

/**
 * What a merchant SELLS. Distinct from BusinessType, which is how it is
 * legally constituted — the two were conflated, and the marketplace filtered
 * on the legal one because it was the only field that looked like a category.
 *
 * `null` on a merchant means uncategorised, which is a real state: everything
 * onboarded before this existed has no category, and a guessed one would be
 * worse than a blank. Uncategorised merchants still list under "All".
 */
export type MerchantCategory =
  | 'SUPERMARKET'
  | 'RESTAURANT'
  | 'PHARMACY'
  | 'ELECTRONICS'
  | 'FASHION'
  | 'BEAUTY'
  | 'HARDWARE'
  | 'HOTEL'
  | 'FURNITURE'
  | 'SERVICES'
  | 'WHOLESALE'
  | 'OTHER';

export const MERCHANT_CATEGORIES = [
  'SUPERMARKET',
  'RESTAURANT',
  'PHARMACY',
  'ELECTRONICS',
  'FASHION',
  'BEAUTY',
  'HARDWARE',
  'HOTEL',
  'FURNITURE',
  'SERVICES',
  'WHOLESALE',
  'OTHER',
] as const satisfies readonly MerchantCategory[];

/** What a customer sees. One place, so the app and the merchant portal cannot
 *  drift into calling the same category two different things. */
export const MERCHANT_CATEGORY_LABEL: Record<MerchantCategory, string> = {
  SUPERMARKET: 'Supermarket',
  RESTAURANT: 'Restaurant',
  PHARMACY: 'Pharmacy',
  ELECTRONICS: 'Electronics',
  FASHION: 'Fashion',
  BEAUTY: 'Beauty',
  HARDWARE: 'Hardware',
  HOTEL: 'Hotel',
  FURNITURE: 'Furniture & Home',
  SERVICES: 'Services',
  WHOLESALE: 'Wholesale',
  OTHER: 'Other',
};

export type KycDocumentType =
  | 'NATIONAL_ID'
  | 'PASSPORT'
  | 'DRIVER_LICENSE'
  | 'CAC_CERTIFICATE'
  | 'BUSINESS_REGISTRATION'
  | 'VEHICLE_REGISTRATION'
  | 'GUARANTOR_ID'
  /** DPX-DRIVER-002 */
  | 'INSURANCE';

export type KycVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface BusinessDto {
  id: string;
  merchantId: string;
  businessName: string;
  businessType: BusinessType;
  category: MerchantCategory | null;
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
  operatingHours: OperatingHoursDto | null;
  status: BusinessStatus;
  verificationStatus: BusinessVerificationStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedReason: string | null;
  pausedAt: string | null;
  pauseReason: string | null;
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
  category?: MerchantCategory;
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
  category?: MerchantCategory;
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

/// DPX-MERCHANT-001 Phase 1 — mirrors `MerchantController`'s
/// `POST /merchant/business/pause` (`apps/backend/src/merchants/
/// controllers/merchant.controller.ts`); `resumeStore` takes no body.
export interface PauseStoreRequest {
  reason?: string;
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

// --- Customer-facing marketplace (R1.5) ---

export interface OperatingHoursDayDto {
  open: string;
  close: string;
}

export type OperatingHoursDayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type OperatingHoursDto = Partial<Record<OperatingHoursDayKey, OperatingHoursDayDto | null>>;

export const MERCHANT_SORTS = ['recommended', 'nearest', 'rating_desc', 'newest'] as const;
export type MerchantSort = (typeof MERCHANT_SORTS)[number];

export interface MerchantSummaryDto {
  id: string;
  businessName: string;
  businessType: BusinessType;
  /** What they sell. null = uncategorised (onboarded before categories existed). */
  category: MerchantCategory | null;
  logoUrl: string | null;
  coverPhotoUrl: string | null;
  verificationStatus: BusinessVerificationStatus;
  city: string;
  state: string;
  rating: RatingSummaryDto;
  distanceKm: number | null;
  /** null when the merchant hasn't set operating hours yet — render as "Hours unavailable", not "Closed". */
  isOpenNow: boolean | null;
}

export interface MerchantDetailDto extends MerchantSummaryDto {
  description: string | null;
  address: string;
  country: string;
  phone: string;
  email: string;
  operatingHours: OperatingHoursDto | null;
  productCount: number;
}

export interface BrowseMerchantsQuery {
  q?: string;
  businessType?: BusinessType;
  /** Filter by what they SELL. The chips in the marketplace mean this, not
   *  businessType — which is a legal structure and was never a category. */
  category?: MerchantCategory;
  minRating?: number;
  lat?: number;
  lng?: number;
  sort?: MerchantSort;
  cursor?: string;
  limit?: number;
}
