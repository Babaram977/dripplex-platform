import { Injectable } from '@nestjs/common';
import { OnboardingStatus, RiderStatus } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

import { RIDER_AUDIT_ACTIONS } from './rider.constants';
import { toRiderApprovalDto, toRiderProfileDto } from './rider.mapper';

import type { ListRidersQueryDto } from './dto/list-riders-query.dto';
import type { RiderApprovalDto, RiderProfileDto } from '@dripplex/types';
import type { RiderProfile, User } from '@prisma/client';

/**
 * DPX-RIDER-001 — delivery-rider approval workflow. Mirrors DriversService's
 * approve/reject/suspend/reactivate, minus the driver-only KYC/vehicle/
 * inspection activation gate (riders have no such requirement). Lifecycle
 * notification emails are a follow-up (no notifyRiderLifecycle port yet).
 */
@Injectable()
export class RidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  public async listRiders(query: ListRidersQueryDto): Promise<{
    items: RiderProfileDto[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const where = query.status ? { status: query.status } : {};
    const [profiles, total] = await Promise.all([
      this.prisma.riderProfile.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.riderProfile.count({ where }),
    ]);

    const items = profiles.map((profile) => toRiderProfileDto({ profile, user: profile.user }));

    return {
      items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  public async getRiderProfile(riderUserId: string): Promise<RiderProfileDto> {
    const { profile, user } = await this.requireRiderProfile(riderUserId);
    return toRiderProfileDto({ profile, user });
  }

  public async approveRider(
    riderUserId: string,
    adminUserId: string,
    context: AuditContext,
  ): Promise<RiderApprovalDto> {
    const { profile } = await this.requireRiderProfile(riderUserId);

    if (profile.status === RiderStatus.APPROVED) {
      throw new ConflictDomainException('Rider is already approved');
    }

    const updated = await this.prisma.riderProfile.update({
      where: { userId: riderUserId },
      data: {
        status: RiderStatus.APPROVED,
        isApproved: true,
        approvedAt: new Date(),
        approvedBy: adminUserId,
        rejectedReason: null,
        suspendedAt: null,
      },
    });

    // Keep the rider onboarding state machine in sync (no-op if the rider has
    // no structured onboarding record).
    await this.prisma.riderOnboarding.updateMany({
      where: { riderProfileId: profile.id },
      data: { status: OnboardingStatus.APPROVED },
    });

    await this.auditService.record(
      RIDER_AUDIT_ACTIONS.APPROVED,
      { ...context, userId: adminUserId },
      { resource: 'rider', resourceId: riderUserId, metadata: { approvedBy: adminUserId } },
    );

    return toRiderApprovalDto(updated);
  }

  public async rejectRider(
    riderUserId: string,
    adminUserId: string,
    reason: string,
    context: AuditContext,
  ): Promise<RiderApprovalDto> {
    const { profile } = await this.requireRiderProfile(riderUserId);

    const updated = await this.prisma.riderProfile.update({
      where: { userId: riderUserId },
      data: {
        status: RiderStatus.REJECTED,
        isApproved: false,
        approvedAt: null,
        approvedBy: adminUserId,
        rejectedReason: reason,
      },
    });

    await this.prisma.riderOnboarding.updateMany({
      where: { riderProfileId: profile.id },
      data: { status: OnboardingStatus.REJECTED },
    });

    await this.auditService.record(
      RIDER_AUDIT_ACTIONS.REJECTED,
      { ...context, userId: adminUserId },
      { resource: 'rider', resourceId: riderUserId, metadata: { reason } },
    );

    return toRiderApprovalDto(updated, { rejectedReason: reason });
  }

  public async suspendRider(
    riderUserId: string,
    adminUserId: string,
    reason: string,
    context: AuditContext,
  ): Promise<RiderApprovalDto> {
    const { profile } = await this.requireRiderProfile(riderUserId);
    if (profile.status !== RiderStatus.APPROVED) {
      throw new ValidationDomainException('Only approved riders can be suspended');
    }

    const updated = await this.prisma.riderProfile.update({
      where: { userId: riderUserId },
      data: {
        status: RiderStatus.SUSPENDED,
        isApproved: false,
        suspendedAt: new Date(),
        rejectedReason: reason,
      },
    });

    await this.auditService.record(
      RIDER_AUDIT_ACTIONS.SUSPENDED,
      { ...context, userId: adminUserId },
      { resource: 'rider', resourceId: riderUserId, metadata: { reason } },
    );

    return toRiderApprovalDto(updated, { rejectedReason: reason });
  }

  public async reactivateRider(
    riderUserId: string,
    adminUserId: string,
    context: AuditContext,
  ): Promise<RiderApprovalDto> {
    const { profile } = await this.requireRiderProfile(riderUserId);
    if (profile.status !== RiderStatus.SUSPENDED) {
      throw new ValidationDomainException('Only suspended riders can be reactivated');
    }

    const updated = await this.prisma.riderProfile.update({
      where: { userId: riderUserId },
      data: {
        status: RiderStatus.APPROVED,
        isApproved: true,
        approvedAt: new Date(),
        approvedBy: adminUserId,
        rejectedReason: null,
        suspendedAt: null,
      },
    });

    await this.auditService.record(
      RIDER_AUDIT_ACTIONS.REACTIVATED,
      { ...context, userId: adminUserId },
      { resource: 'rider', resourceId: riderUserId },
    );

    return toRiderApprovalDto(updated);
  }

  private async requireRiderProfile(
    riderUserId: string,
  ): Promise<{ profile: RiderProfile; user: User }> {
    const profile = await this.prisma.riderProfile.findUnique({
      where: { userId: riderUserId },
      include: { user: true },
    });
    if (!profile || profile.deletedAt) {
      throw new NotFoundDomainException('Rider profile not found');
    }
    const { user, ...rest } = profile;
    return { profile: rest, user };
  }
}
