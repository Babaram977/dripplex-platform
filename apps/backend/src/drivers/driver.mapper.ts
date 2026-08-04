import type { DriverApprovalDto, DriverKycDto, DriverProfileDto } from '@dripplex/types';
import type { DriverKyc, DriverProfile, User } from '@prisma/client';

export function toDriverKycDto(kyc: DriverKyc): DriverKycDto {
  return {
    id: kyc.id,
    driverId: kyc.driverId,
    documentType: kyc.documentType,
    documentNumber: kyc.documentNumber,
    frontImage: kyc.frontImage,
    backImage: kyc.backImage,
    expiresAt: kyc.expiresAt ? kyc.expiresAt.toISOString() : null,
    verificationStatus: kyc.verificationStatus,
    reviewedBy: kyc.reviewedBy,
    reviewedAt: kyc.reviewedAt ? kyc.reviewedAt.toISOString() : null,
    remarks: kyc.remarks,
    createdAt: kyc.createdAt.toISOString(),
  };
}

export function toDriverProfileDto(input: {
  profile: DriverProfile;
  user: User;
  kyc: DriverKyc[];
}): DriverProfileDto {
  return {
    id: input.profile.id,
    driverId: input.profile.userId,
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
    emergencyContactName: input.profile.emergencyContactName,
    emergencyContactPhone: input.profile.emergencyContactPhone,
    agreementAcceptedAt: input.profile.agreementAcceptedAt
      ? input.profile.agreementAcceptedAt.toISOString()
      : null,
    agreementVersion: input.profile.agreementVersion,
    avatarUrl: input.profile.avatarUrl,
    languagesSpoken: input.profile.languagesSpoken,
    preferredServiceAreas: input.profile.preferredServiceAreas,
    drivingExperienceYears: input.profile.drivingExperienceYears,
    createdAt: input.profile.createdAt.toISOString(),
    updatedAt: input.profile.updatedAt.toISOString(),
    kyc: input.kyc.map(toDriverKycDto),
  };
}

export function toDriverApprovalDto(
  profile: DriverProfile,
  overrides: { rejectedReason?: string } = {},
): DriverApprovalDto {
  return {
    driverId: profile.userId,
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
