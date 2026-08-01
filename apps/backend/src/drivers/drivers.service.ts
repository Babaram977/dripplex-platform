import { Inject, Injectable } from '@nestjs/common';
import { DriverStatus, KycDocumentType, KycVerificationStatus } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import {
  NOTIFICATION_SERVICE,
  type NotificationService,
} from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';

import { DRIVER_AUDIT_ACTIONS } from './driver.constants';
import { toDriverApprovalDto, toDriverKycDto, toDriverProfileDto } from './driver.mapper';

import type { ListDriversQueryDto } from './dto/list-drivers-query.dto';
import type { SubmitDriverKycDto } from './dto/submit-driver-kyc.dto';
import type { DriverApprovalDto, DriverKycDto, DriverProfileDto } from '@dripplex/types';
import type { DriverKyc, DriverProfile, User } from '@prisma/client';

/** A driver must have a VERIFIED document of each of these types before approval. */
export const REQUIRED_DRIVER_KYC_DOCUMENT_TYPES: readonly KycDocumentType[] = [
  KycDocumentType.DRIVER_LICENSE,
  KycDocumentType.VEHICLE_REGISTRATION,
  KycDocumentType.NATIONAL_ID,
];

@Injectable()
export class DriversService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Inject(NOTIFICATION_SERVICE)
    private readonly notifications: NotificationService,
  ) {}

  public async submitKyc(
    driverUserId: string,
    dto: SubmitDriverKycDto,
    context: AuditContext,
  ): Promise<DriverKycDto> {
    const profile = await this.requireDriverProfile(driverUserId);

    const kyc = await this.prisma.driverKyc.create({
      data: {
        driverId: driverUserId,
        documentType: dto.documentType,
        documentNumber: dto.documentNumber.trim(),
        frontImage: dto.frontImage,
        ...(dto.backImage !== undefined ? { backImage: dto.backImage } : {}),
      },
    });

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.KYC_SUBMITTED,
      { ...context, userId: driverUserId },
      { resource: 'driver_kyc', resourceId: kyc.id, metadata: { documentType: kyc.documentType } },
    );

    await this.notifications.notifyDriverLifecycle({
      email: profile.user.email,
      event: 'kyc_submitted',
      driverId: driverUserId,
      documentType: kyc.documentType,
    });

    return toDriverKycDto(kyc);
  }

  public async getOwnProfile(driverUserId: string): Promise<DriverProfileDto> {
    const profile = await this.requireDriverProfile(driverUserId);
    const kyc = await this.prisma.driverKyc.findMany({
      where: { driverId: driverUserId },
      orderBy: { createdAt: 'desc' },
    });
    return toDriverProfileDto({ profile: profile.profile, user: profile.user, kyc });
  }

  public async listDrivers(query: ListDriversQueryDto): Promise<{
    items: DriverProfileDto[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const where = query.status ? { status: query.status } : {};
    const [profiles, total] = await Promise.all([
      this.prisma.driverProfile.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.driverProfile.count({ where }),
    ]);

    const kycByDriver = await this.prisma.driverKyc.findMany({
      where: { driverId: { in: profiles.map((p) => p.userId) } },
      orderBy: { createdAt: 'desc' },
    });

    const items = profiles.map((profile) =>
      toDriverProfileDto({
        profile,
        user: profile.user,
        kyc: kycByDriver.filter((k) => k.driverId === profile.userId),
      }),
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

  public async getDriverProfile(driverUserId: string): Promise<DriverProfileDto> {
    const { profile, user } = await this.requireDriverProfile(driverUserId);
    const kyc = await this.prisma.driverKyc.findMany({
      where: { driverId: driverUserId },
      orderBy: { createdAt: 'desc' },
    });
    return toDriverProfileDto({ profile, user, kyc });
  }

  public async verifyKyc(
    kycId: string,
    adminUserId: string,
    remarks: string | undefined,
    context: AuditContext,
  ): Promise<DriverKycDto> {
    const kyc = await this.requireKyc(kycId);

    const updated = await this.prisma.driverKyc.update({
      where: { id: kyc.id },
      data: {
        verificationStatus: KycVerificationStatus.VERIFIED,
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
        ...(remarks !== undefined ? { remarks } : {}),
      },
    });

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.KYC_VERIFIED,
      { ...context, userId: adminUserId },
      { resource: 'driver_kyc', resourceId: kyc.id, metadata: { documentType: kyc.documentType } },
    );

    return toDriverKycDto(updated);
  }

  public async rejectKyc(
    kycId: string,
    adminUserId: string,
    remarks: string,
    context: AuditContext,
  ): Promise<DriverKycDto> {
    const kyc = await this.requireKyc(kycId);

    const updated = await this.prisma.driverKyc.update({
      where: { id: kyc.id },
      data: {
        verificationStatus: KycVerificationStatus.REJECTED,
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
        remarks,
      },
    });

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.KYC_REJECTED,
      { ...context, userId: adminUserId },
      { resource: 'driver_kyc', resourceId: kyc.id, metadata: { documentType: kyc.documentType } },
    );

    return toDriverKycDto(updated);
  }

  public async approveDriver(
    driverUserId: string,
    adminUserId: string,
    context: AuditContext,
  ): Promise<DriverApprovalDto> {
    const { profile, user } = await this.requireDriverProfile(driverUserId);

    if (profile.status === DriverStatus.APPROVED) {
      throw new ConflictDomainException('Driver is already approved');
    }

    const kyc = await this.prisma.driverKyc.findMany({ where: { driverId: driverUserId } });
    const missing = REQUIRED_DRIVER_KYC_DOCUMENT_TYPES.filter(
      (type) =>
        !kyc.some(
          (doc) =>
            doc.documentType === type && doc.verificationStatus === KycVerificationStatus.VERIFIED,
        ),
    );
    if (missing.length > 0) {
      throw new ValidationDomainException(
        `All required documents must be verified before approval (missing: ${missing.join(', ')})`,
      );
    }

    const now = new Date();
    const updated = await this.prisma.driverProfile.update({
      where: { userId: driverUserId },
      data: {
        status: DriverStatus.APPROVED,
        isApproved: true,
        approvedAt: now,
        approvedBy: adminUserId,
        rejectedReason: null,
        suspendedAt: null,
      },
    });

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.APPROVED,
      { ...context, userId: adminUserId },
      { resource: 'driver', resourceId: driverUserId, metadata: { approvedBy: adminUserId } },
    );

    await this.notifications.notifyDriverLifecycle({
      email: user.email,
      event: 'driver_approved',
      driverId: driverUserId,
    });

    return toDriverApprovalDto(updated);
  }

  public async rejectDriver(
    driverUserId: string,
    adminUserId: string,
    reason: string,
    context: AuditContext,
  ): Promise<DriverApprovalDto> {
    const { user } = await this.requireDriverProfile(driverUserId);

    const updated = await this.prisma.driverProfile.update({
      where: { userId: driverUserId },
      data: {
        status: DriverStatus.REJECTED,
        isApproved: false,
        approvedAt: null,
        approvedBy: adminUserId,
        rejectedReason: reason,
      },
    });

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.REJECTED,
      { ...context, userId: adminUserId },
      { resource: 'driver', resourceId: driverUserId, metadata: { reason } },
    );

    await this.notifications.notifyDriverLifecycle({
      email: user.email,
      event: 'driver_rejected',
      driverId: driverUserId,
      reason,
    });

    return toDriverApprovalDto(updated, { rejectedReason: reason });
  }

  public async suspendDriver(
    driverUserId: string,
    adminUserId: string,
    reason: string,
    context: AuditContext,
  ): Promise<DriverApprovalDto> {
    const { profile, user } = await this.requireDriverProfile(driverUserId);
    if (profile.status !== DriverStatus.APPROVED) {
      throw new ValidationDomainException('Only approved drivers can be suspended');
    }

    const updated = await this.prisma.driverProfile.update({
      where: { userId: driverUserId },
      data: {
        status: DriverStatus.SUSPENDED,
        isApproved: false,
        suspendedAt: new Date(),
        rejectedReason: reason,
      },
    });

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.SUSPENDED,
      { ...context, userId: adminUserId },
      { resource: 'driver', resourceId: driverUserId, metadata: { reason } },
    );

    await this.notifications.notifyDriverLifecycle({
      email: user.email,
      event: 'driver_suspended',
      driverId: driverUserId,
      reason,
    });

    return toDriverApprovalDto(updated, { rejectedReason: reason });
  }

  public async reactivateDriver(
    driverUserId: string,
    adminUserId: string,
    context: AuditContext,
  ): Promise<DriverApprovalDto> {
    const { profile, user } = await this.requireDriverProfile(driverUserId);
    if (profile.status !== DriverStatus.SUSPENDED) {
      throw new ValidationDomainException('Only suspended drivers can be reactivated');
    }

    const now = new Date();
    const updated = await this.prisma.driverProfile.update({
      where: { userId: driverUserId },
      data: {
        status: DriverStatus.APPROVED,
        isApproved: true,
        approvedAt: now,
        approvedBy: adminUserId,
        rejectedReason: null,
        suspendedAt: null,
      },
    });

    await this.auditService.record(
      DRIVER_AUDIT_ACTIONS.REACTIVATED,
      { ...context, userId: adminUserId },
      { resource: 'driver', resourceId: driverUserId },
    );

    await this.notifications.notifyDriverLifecycle({
      email: user.email,
      event: 'driver_reactivated',
      driverId: driverUserId,
    });

    return toDriverApprovalDto(updated);
  }

  private async requireDriverProfile(
    driverUserId: string,
  ): Promise<{ profile: DriverProfile; user: User }> {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId: driverUserId },
      include: { user: true },
    });
    if (!profile) {
      throw new NotFoundDomainException('Driver profile not found');
    }
    const { user, ...rest } = profile;
    return { profile: rest, user };
  }

  private async requireKyc(kycId: string): Promise<DriverKyc> {
    const kyc = await this.prisma.driverKyc.findUnique({ where: { id: kycId } });
    if (!kyc) {
      throw new NotFoundDomainException('Driver KYC document not found');
    }
    return kyc;
  }
}
