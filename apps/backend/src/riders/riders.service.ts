import { Injectable } from '@nestjs/common';
import { OnboardingStatus, RiderStatus } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';
import { StorageAssetService } from '../uploads/storage-asset.service';

import { RIDER_AUDIT_ACTIONS } from './rider.constants';
import { toRiderApprovalDto, toRiderKycDto, toRiderProfileDto } from './rider.mapper';

import type { ListRidersQueryDto } from './dto/list-riders-query.dto';
import type { SubmitRiderKycDto } from './dto/submit-rider-kyc.dto';
import type { UpdateRiderProfileDto } from './dto/update-rider-profile.dto';
import type { RiderApprovalDto, RiderKycDto, RiderProfileDto } from '@dripplex/types';
import type { RiderKyc, RiderProfile, User } from '@prisma/client';

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
    private readonly storageAssets: StorageAssetService,
  ) {}

  public async listRiders(query: ListRidersQueryDto): Promise<{
    items: RiderProfileDto[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const where = query.status ? { status: query.status } : {};
    const [profiles, total] = await Promise.all([
      this.prisma.riderProfile.findMany({
        where,
        include: { user: { include: { riderKycDocuments: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.riderProfile.count({ where }),
    ]);

    const items = await Promise.all(
      profiles.map(async ({ user, ...profile }) =>
        await this.signRiderProfile(toRiderProfileDto({ profile, user, kyc: user.riderKycDocuments })),
      ),
    );

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
    const { profile, user, kyc } = await this.requireRiderProfile(riderUserId);
    return await this.signRiderProfile(toRiderProfileDto({ profile, user, kyc }));
  }

  /**
   * DPX-RIDER-002 — the rider's own profile (self endpoint), with the same
   * signed-URL KYC images as the admin view.
   */
  public async getOwnProfile(riderUserId: string): Promise<RiderProfileDto> {
    return await this.getRiderProfile(riderUserId);
  }

  /**
   * DPX-RIDER-002 — rider submits one KYC document (an ID or a guarantor ID).
   * The image URLs must already be DrippleX-owned uploads belonging to this
   * rider (same ownership assertion as driver KYC).
   */
  public async submitRiderKyc(
    riderUserId: string,
    dto: SubmitRiderKycDto,
    context: AuditContext,
  ): Promise<RiderKycDto> {
    await this.requireRiderProfile(riderUserId);

    this.storageAssets.assertOwned(dto.frontImage, {
      folder: 'kyc-documents',
      ownerId: riderUserId,
    });
    this.storageAssets.assertOwnedOptional(dto.backImage, {
      folder: 'kyc-documents',
      ownerId: riderUserId,
    });

    const kyc = await this.prisma.riderKyc.create({
      data: {
        riderId: riderUserId,
        documentType: dto.documentType,
        documentNumber: dto.documentNumber.trim(),
        frontImage: dto.frontImage,
        ...(dto.backImage !== undefined ? { backImage: dto.backImage } : {}),
      },
    });

    await this.auditService.record(
      RIDER_AUDIT_ACTIONS.KYC_SUBMITTED,
      { ...context, userId: riderUserId },
      { resource: 'rider_kyc', resourceId: kyc.id, metadata: { documentType: kyc.documentType } },
    );

    return await this.signRiderKyc(toRiderKycDto(kyc));
  }

  /**
   * DPX-RIDER-002 — rider updates their own profile (currently just the
   * company/organisation name).
   */
  public async updateOwnProfile(
    riderUserId: string,
    dto: UpdateRiderProfileDto,
    context: AuditContext,
  ): Promise<RiderProfileDto> {
    await this.requireRiderProfile(riderUserId);

    await this.prisma.riderProfile.update({
      where: { userId: riderUserId },
      data: {
        ...(dto.companyName !== undefined
          ? { companyName: dto.companyName.trim() === '' ? null : dto.companyName.trim() }
          : {}),
      },
    });

    await this.auditService.record(
      RIDER_AUDIT_ACTIONS.PROFILE_UPDATED,
      { ...context, userId: riderUserId },
      { resource: 'rider', resourceId: riderUserId },
    );

    return await this.getRiderProfile(riderUserId);
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
  ): Promise<{ profile: RiderProfile; user: User; kyc: RiderKyc[] }> {
    const profile = await this.prisma.riderProfile.findUnique({
      where: { userId: riderUserId },
      include: { user: { include: { riderKycDocuments: true } } },
    });
    if (!profile || profile.deletedAt) {
      throw new NotFoundDomainException('Rider profile not found');
    }
    const { user, ...rest } = profile;
    const { riderKycDocuments, ...userRest } = user;
    return { profile: rest, user: userRest, kyc: riderKycDocuments };
  }

  /** Sign a single rider KYC document's images into short-lived GET URLs. */
  private async signRiderKyc(dto: RiderKycDto): Promise<RiderKycDto> {
    const [frontImage, backImage] = await Promise.all([
      this.storageAssets.toSignedGetUrl(dto.frontImage),
      this.storageAssets.toSignedGetUrlOptional(dto.backImage),
    ]);
    return { ...dto, frontImage, backImage: backImage ?? null };
  }

  /** Sign the KYC documents embedded in a rider profile DTO. */
  private async signRiderProfile(dto: RiderProfileDto): Promise<RiderProfileDto> {
    const kyc = await Promise.all(dto.kyc.map((item) => this.signRiderKyc(item)));
    return { ...dto, kyc };
  }
}
