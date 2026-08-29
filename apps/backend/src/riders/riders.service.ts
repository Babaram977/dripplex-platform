import { Inject, Injectable } from '@nestjs/common';
import {
  KycVerificationStatus,
  OnboardingStatus,
  Prisma,
  ReviewTargetType,
  RiderStatus,
} from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import {
  NOTIFICATION_SERVICE,
  type NotificationService,
  type RiderLifecycleEvent,
} from '../notifications/notification.service';
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
 * inspection activation gate (riders have no such requirement).
 *
 * DPX-RIDER-005: riders now send lifecycle emails like every other partner.
 * They were the only persona with no notification port at all, so a rejected
 * rider was simply never told — the reason sat in the database and on the
 * Operations desk and never reached them.
 */
@Injectable()
export class RidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly storageAssets: StorageAssetService,
    @Inject(NOTIFICATION_SERVICE)
    private readonly notifications: NotificationService,
  ) {}

  public async listRiders(query: ListRidersQueryDto): Promise<{
    items: RiderProfileDto[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    // Same reason as the driver roster: deletion stamps `deletedAt` on the
    // rider profile, and a roster that ignores it keeps showing people who
    // have already been removed.
    const where: Prisma.RiderProfileWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
    };
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

    // DPX-REVIEWS-001 — batch-load each rider's public rating aggregate.
    const riderUserIds = profiles.map((profile) => profile.userId);
    const aggregates = await this.prisma.reviewAggregate.findMany({
      where: { targetType: ReviewTargetType.RIDER, targetId: { in: riderUserIds } },
    });
    const aggregateByRider = new Map(aggregates.map((agg) => [agg.targetId, agg]));

    const items = await Promise.all(
      profiles.map(
        async ({ user, ...profile }) =>
          await this.signRiderProfile(
            toRiderProfileDto({
              profile,
              user,
              kyc: user.riderKycDocuments,
              ratingAggregate: aggregateByRider.get(profile.userId) ?? null,
            }),
          ),
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
    const ratingAggregate = await this.prisma.reviewAggregate.findUnique({
      where: {
        targetType_targetId: { targetType: ReviewTargetType.RIDER, targetId: riderUserId },
      },
    });
    return await this.signRiderProfile(toRiderProfileDto({ profile, user, kyc, ratingAggregate }));
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

    await this.notifyRiderById(riderUserId, {
      event: 'kyc_submitted',
      documentType: dto.documentType,
    });

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
    const { profile, user } = await this.requireRiderProfile(riderUserId);

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

    await this.notifications.notifyRiderLifecycle({
      email: user.email,
      event: 'rider_approved',
      riderId: riderUserId,
    });

    return toRiderApprovalDto(updated);
  }

  public async rejectRider(
    riderUserId: string,
    adminUserId: string,
    reason: string,
    context: AuditContext,
  ): Promise<RiderApprovalDto> {
    const { profile, user } = await this.requireRiderProfile(riderUserId);

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

    // The rejection reason is the whole point of the email: without it the
    // rider only knows they were turned down, not what to fix.
    await this.notifications.notifyRiderLifecycle({
      email: user.email,
      event: 'rider_rejected',
      riderId: riderUserId,
      reason,
    });

    return toRiderApprovalDto(updated, { rejectedReason: reason });
  }

  public async suspendRider(
    riderUserId: string,
    adminUserId: string,
    reason: string,
    context: AuditContext,
  ): Promise<RiderApprovalDto> {
    const { profile, user } = await this.requireRiderProfile(riderUserId);
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

    await this.notifications.notifyRiderLifecycle({
      email: user.email,
      event: 'rider_suspended',
      riderId: riderUserId,
      reason,
    });

    return toRiderApprovalDto(updated, { rejectedReason: reason });
  }

  public async reactivateRider(
    riderUserId: string,
    adminUserId: string,
    context: AuditContext,
  ): Promise<RiderApprovalDto> {
    const { profile, user } = await this.requireRiderProfile(riderUserId);
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

    await this.notifications.notifyRiderLifecycle({
      email: user.email,
      event: 'rider_reactivated',
      riderId: riderUserId,
    });

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

  /**
   * DPX-RIDER-003 — admin review of a submitted rider KYC document. Mirrors
   * DriversService.verifyKyc/rejectKyc exactly; without these a rider's document
   * stayed "KYC Pending" forever because operations had no way to act on it.
   */
  public async verifyKyc(
    kycId: string,
    adminUserId: string,
    remarks: string | undefined,
    context: AuditContext,
  ): Promise<RiderKycDto> {
    const kyc = await this.requireRiderKyc(kycId);

    const updated = await this.prisma.riderKyc.update({
      where: { id: kyc.id },
      data: {
        verificationStatus: KycVerificationStatus.VERIFIED,
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
        ...(remarks !== undefined ? { remarks } : {}),
      },
    });

    await this.auditService.record(
      RIDER_AUDIT_ACTIONS.KYC_VERIFIED,
      { ...context, userId: adminUserId },
      { resource: 'rider_kyc', resourceId: kyc.id, metadata: { documentType: kyc.documentType } },
    );

    await this.notifyRiderById(kyc.riderId, {
      event: 'kyc_verified',
      documentType: kyc.documentType,
    });

    return await this.signRiderKyc(toRiderKycDto(updated));
  }

  public async rejectKyc(
    kycId: string,
    adminUserId: string,
    remarks: string,
    context: AuditContext,
  ): Promise<RiderKycDto> {
    const kyc = await this.requireRiderKyc(kycId);

    const updated = await this.prisma.riderKyc.update({
      where: { id: kyc.id },
      data: {
        verificationStatus: KycVerificationStatus.REJECTED,
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
        remarks,
      },
    });

    await this.auditService.record(
      RIDER_AUDIT_ACTIONS.KYC_REJECTED,
      { ...context, userId: adminUserId },
      { resource: 'rider_kyc', resourceId: kyc.id, metadata: { documentType: kyc.documentType } },
    );

    // Name the document AND the reason — a rider who is told only "rejected"
    // cannot know which of their two documents to replace.
    await this.notifyRiderById(kyc.riderId, {
      event: 'kyc_rejected',
      documentType: kyc.documentType,
      reason: remarks,
    });

    return await this.signRiderKyc(toRiderKycDto(updated));
  }

  /**
   * Email a rider looked up by id. KYC review is keyed by document, not by
   * rider, so the address is not already in hand at those call sites.
   */
  private async notifyRiderById(
    riderUserId: string,
    input: { event: RiderLifecycleEvent; documentType?: string; reason?: string },
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: riderUserId } });
    if (!user?.email) {
      return;
    }
    await this.notifications.notifyRiderLifecycle({
      email: user.email,
      riderId: riderUserId,
      ...input,
    });
  }

  private async requireRiderKyc(kycId: string): Promise<RiderKyc> {
    const kyc = await this.prisma.riderKyc.findUnique({ where: { id: kycId } });
    if (!kyc) {
      throw new NotFoundDomainException('Rider KYC document not found');
    }
    return kyc;
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
