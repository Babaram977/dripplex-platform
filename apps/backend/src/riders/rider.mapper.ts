import type { RiderApprovalDto, RiderProfileDto } from '@dripplex/types';
import type { RiderProfile, User } from '@prisma/client';

export function toRiderProfileDto(input: { profile: RiderProfile; user: User }): RiderProfileDto {
  return {
    id: input.profile.id,
    riderId: input.profile.userId,
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
