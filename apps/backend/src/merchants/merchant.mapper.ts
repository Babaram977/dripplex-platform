import type {
  BankAccountDto,
  BusinessDto,
  MerchantKycDto,
  MerchantProfileDto,
} from '@dripplex/types';
import type { BankAccount, Business, MerchantKyc, MerchantProfile, User } from '@prisma/client';

export function toBusinessDto(business: Business): BusinessDto {
  return {
    id: business.id,
    merchantId: business.merchantId,
    businessName: business.businessName,
    businessType: business.businessType,
    registrationNumber: business.registrationNumber,
    taxNumber: business.taxNumber,
    description: business.description,
    email: business.email,
    phone: business.phone,
    country: business.country,
    state: business.state,
    city: business.city,
    address: business.address,
    latitude: Number(business.latitude),
    longitude: Number(business.longitude),
    logoUrl: business.logoUrl,
    coverPhotoUrl: business.coverPhotoUrl,
    status: business.status,
    verificationStatus: business.verificationStatus,
    approvedBy: business.approvedBy,
    approvedAt: business.approvedAt ? business.approvedAt.toISOString() : null,
    rejectedReason: business.rejectedReason,
    pausedAt: business.pausedAt ? business.pausedAt.toISOString() : null,
    pauseReason: business.pauseReason,
    createdAt: business.createdAt.toISOString(),
    updatedAt: business.updatedAt.toISOString(),
  };
}

export function toMerchantKycDto(kyc: MerchantKyc): MerchantKycDto {
  return {
    id: kyc.id,
    merchantId: kyc.merchantId,
    businessId: kyc.businessId,
    documentType: kyc.documentType,
    documentNumber: kyc.documentNumber,
    frontImage: kyc.frontImage,
    backImage: kyc.backImage,
    selfieImage: kyc.selfieImage,
    verificationStatus: kyc.verificationStatus,
    reviewedBy: kyc.reviewedBy,
    reviewedAt: kyc.reviewedAt ? kyc.reviewedAt.toISOString() : null,
    remarks: kyc.remarks,
    createdAt: kyc.createdAt.toISOString(),
  };
}

export function toBankAccountDto(account: BankAccount): BankAccountDto {
  return {
    id: account.id,
    merchantId: account.merchantId,
    bankName: account.bankName,
    accountName: account.accountName,
    accountNumber: account.accountNumber,
    currency: account.currency,
    isDefault: account.isDefault,
    verifiedAt: account.verifiedAt ? account.verifiedAt.toISOString() : null,
    createdAt: account.createdAt.toISOString(),
  };
}

export function toMerchantProfileDto(input: {
  profile: MerchantProfile;
  user: User;
  business: Business | null;
  kyc: MerchantKyc | null;
  bankAccounts: BankAccount[];
}): MerchantProfileDto {
  return {
    id: input.profile.id,
    merchantId: input.profile.userId,
    email: input.user.email,
    phone: input.user.phone,
    firstName: input.user.firstName,
    lastName: input.user.lastName,
    status: input.profile.status,
    isApproved: input.profile.isApproved,
    approvedAt: input.profile.approvedAt ? input.profile.approvedAt.toISOString() : null,
    approvedBy: input.profile.approvedBy,
    rejectedReason: input.profile.rejectedReason,
    suspendedAt: input.profile.suspendedAt ? input.profile.suspendedAt.toISOString() : null,
    createdAt: input.profile.createdAt.toISOString(),
    updatedAt: input.profile.updatedAt.toISOString(),
    business: input.business ? toBusinessDto(input.business) : null,
    kyc: input.kyc ? toMerchantKycDto(input.kyc) : null,
    bankAccounts: input.bankAccounts.map(toBankAccountDto),
  };
}
