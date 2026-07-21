import type {
  BankAccount,
  Business,
  BusinessStatus,
  BusinessType,
  BusinessVerificationStatus,
  KycDocumentType,
  MerchantKyc,
  MerchantProfile,
  MerchantStatus,
  OnboardingStatus,
  Prisma,
  User,
} from '@prisma/client';

export type BusinessWithRelations = Business;

export type MerchantProfileWithUser = MerchantProfile & {
  user: User;
};

export type MerchantAdminDetail = MerchantProfile & {
  user: User;
  business: Business | null;
  kycDocuments: MerchantKyc[];
  bankAccounts: BankAccount[];
  onboarding: { id: string; status: OnboardingStatus } | null;
};

export interface CreateBusinessInput {
  merchantId: string;
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
  status: BusinessStatus;
  verificationStatus: BusinessVerificationStatus;
}

export interface UpdateBusinessInput {
  businessName?: string;
  businessType?: BusinessType;
  registrationNumber?: string;
  taxNumber?: string | null;
  description?: string | null;
  email?: string;
  phone?: string;
  country?: string;
  state?: string;
  city?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  logoUrl?: string | null;
  coverPhotoUrl?: string | null;
}

export interface CreateKycInput {
  merchantId: string;
  businessId: string;
  documentType: KycDocumentType;
  documentNumber: string;
  frontImage: string;
  backImage?: string;
  selfieImage?: string;
}

export interface CreateBankAccountInput {
  merchantId: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  currency: string;
  isDefault: boolean;
}

export interface ListMerchantsFilter {
  status?: MerchantStatus;
  verificationStatus?: BusinessVerificationStatus;
  country?: string;
  state?: string;
  createdFrom?: Date;
  createdTo?: Date;
  skip: number;
  take: number;
}

export interface AuditSummaryItem {
  action: string;
  count: number;
  lastAt: Date | null;
}

export interface MerchantsRepository {
  findMerchantProfileByUserId(userId: string): Promise<MerchantProfileWithUser | null>;
  findMerchantProfileById(id: string): Promise<MerchantProfileWithUser | null>;
  findBusinessByMerchantId(merchantId: string): Promise<Business | null>;
  findBusinessByRegistrationNumber(registrationNumber: string): Promise<Business | null>;
  createBusiness(input: CreateBusinessInput): Promise<Business>;
  updateBusiness(id: string, input: UpdateBusinessInput): Promise<Business>;
  createKyc(input: CreateKycInput): Promise<MerchantKyc>;
  findLatestKycByMerchantId(merchantId: string): Promise<MerchantKyc | null>;
  findActivePendingKyc(merchantId: string): Promise<MerchantKyc | null>;
  listKycByMerchantId(merchantId: string): Promise<MerchantKyc[]>;
  verifyKyc(id: string, reviewedBy: string, remarks?: string): Promise<MerchantKyc>;
  rejectKyc(id: string, reviewedBy: string, remarks: string): Promise<MerchantKyc>;
  createBankAccount(input: CreateBankAccountInput): Promise<BankAccount>;
  findBankAccountById(id: string): Promise<BankAccount | null>;
  findBankAccountByNumber(merchantId: string, accountNumber: string): Promise<BankAccount | null>;
  listBankAccounts(merchantId: string): Promise<BankAccount[]>;
  setDefaultBankAccount(merchantId: string, accountId: string): Promise<BankAccount>;
  listMerchants(
    filter: ListMerchantsFilter,
  ): Promise<{ items: MerchantAdminDetail[]; total: number }>;
  getMerchantAdminDetail(merchantUserId: string): Promise<MerchantAdminDetail | null>;
  updateMerchantLifecycle(input: {
    merchantUserId: string;
    status: MerchantStatus;
    isApproved: boolean;
    approvedAt?: Date | null;
    approvedBy?: string | null;
    rejectedReason?: string | null;
    suspendedAt?: Date | null;
    businessStatus?: BusinessStatus;
    businessVerificationStatus?: BusinessVerificationStatus;
    businessApprovedBy?: string | null;
    businessApprovedAt?: Date | null;
    businessRejectedReason?: string | null;
    onboardingStatus?: OnboardingStatus;
  }): Promise<MerchantAdminDetail>;
  getAuditSummary(merchantUserId: string): Promise<AuditSummaryItem[]>;
}

export const MERCHANTS_REPOSITORY = Symbol('MERCHANTS_REPOSITORY');

export type { Prisma };
