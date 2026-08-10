import type { RiderApprovalDto, RiderKycDto, RiderProfileDto } from '@dripplex/types';
import type { RiderKyc, RiderProfile, User } from '@prisma/client';

export function toRiderKycDto(kyc: RiderKyc): RiderKycDto {
  return {
    id: kyc.id,
    riderId: kyc.riderId,
    documentType: kyc.documentType,
    documentNumber: kyc.documentNumber,
    frontImage: kyc.frontImage,
    backImage: kyc.backImage,
    verificationStatus: kyc.verificationStatus,
    reviewedBy: kyc.reviewedBy,
    reviewedAt: kyc.reviewedAt ? kyc.reviewedAt.toISOString() : null,
    remarks: kyc.remarks,
    createdAt: kyc.createdAt.toISOString(),
  };
}

export function toRiderProfileDto(input: {
  profile: RiderProfile;
  user: User;
  kyc: RiderKyc[];
}): RiderProfileDto {
  return {
    id: input.profile.id,
    riderId: input.profile.userId,
    email: input.user.email,
    phone: input.user.phone,
    firstName: input.user.firstName,
    lastName: input.user.lastName,
    status: input.profile.status,
    companyName: input.profile.companyName,
    isApproved: input.profile.isApproved,
    approvedAt: input.profile.approvedAt ? input.profile.approvedAt.toISOString() : null,
    approvedBy: input.profile.approvedBy,
    rejectedReason: input.profile.rejectedReason,
    suspendedAt: input.profile.suspendedAt ? input.profile.suspendedAt.toISOString() : null,
    createdAt: input.profile.createdAt.toISOString(),
    updatedAt: input.profile.updatedAt.toISOString(),
    kyc: input.kyc.map(toRiderKycDto),
  };
}

export function toRiderApprovalDto(
  profile: RiderProfile,
  overrides: { rejectedReason?: string } = {},
): RiderApprovalDto {
  return {
    riderId: profile.userId,
    status: profile.status,
    ...(profile.approvedAt ? { approvedAt: profile.approvedAt.toISOString() } : {}),
    ...(profile.approvedBy ? { approvedBy: profile.approvedBy } : {}),
    ...(overrides.rejectedReason !== undefined
      ? { rejectedReason: overrides.rejectedReason }
      : profile.rejectedReason
        ? { rejectedReason: profile.rejectedReason }
        : {}),
  };
}
