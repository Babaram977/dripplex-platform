import { Injectable } from '@nestjs/common';
import { CustomerKycStatus } from '@prisma/client';

import { AuditService, type AuditContext } from '../audit/audit.service';
import {
  ConflictDomainException,
  NotFoundDomainException,
} from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';
import { StorageAssetService } from '../uploads/storage-asset.service';

import { toCustomerKycStatusDto } from './customer-kyc.mapper';
import { KYC_AUDIT_ACTIONS } from './kyc.constants';

import type { SubmitCustomerKycDto } from './dto/submit-customer-kyc.dto';
import type { AdminCustomerKycListItemDto, CustomerKycStatusDto } from '@dripplex/types';
import type { CustomerKyc } from '@prisma/client';

/** Server-derived storage folder customer KYC documents live under (DPX-STORAGE-001). */
const KYC_FOLDER = 'kyc-documents' as const;

/**
 * DPX-PROFILE-KYC-002 -- customer Level 2 identity verification. Deliberately
 * a standalone model/service, not an extension of `DriversService`'s
 * `DriverKyc` handling: different persona, different lifecycle richness, and
 * the driver KYC pipeline is frozen/shipped (see
 * docs/DPX-PROFILE-KYC-001-DESIGN.md). Follows the same direct-Prisma-access
 * pattern `DriversService` uses for `DriverKyc` rather than a repository
 * abstraction, for consistency with the closest existing precedent.
 */
@Injectable()
export class CustomerKycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly storageAssets: StorageAssetService,
  ) {}

  /**
   * DPX-STORAGE-001 (F) — KYC document objects are private (not public-read);
   * every read path returns short-lived signed GET URLs instead of the stored
   * canonical URLs. No-op in dev (storage unconfigured) or for legacy values.
   */
  private async withSignedDocumentUrls(dto: CustomerKycStatusDto): Promise<CustomerKycStatusDto> {
    const [frontImageUrl, backImageUrl, selfieUrl] = await Promise.all([
      this.storageAssets.toSignedGetUrlOptional(dto.frontImageUrl),
      this.storageAssets.toSignedGetUrlOptional(dto.backImageUrl),
      this.storageAssets.toSignedGetUrlOptional(dto.selfieUrl),
    ]);
    return {
      ...dto,
      frontImageUrl: frontImageUrl ?? null,
      backImageUrl: backImageUrl ?? null,
      selfieUrl: selfieUrl ?? null,
    };
  }

  public async getMyStatus(userId: string): Promise<CustomerKycStatusDto> {
    const [record, user] = await Promise.all([
      this.prisma.customerKyc.findFirst({ where: { userId } }),
      this.prisma.user.findFirstOrThrow({
        where: { id: userId },
        select: { phoneVerifiedAt: true, emailVerifiedAt: true, email: true },
      }),
    ]);

    return await this.withSignedDocumentUrls(toCustomerKycStatusDto(record, user));
  }

  public async start(userId: string, context: AuditContext): Promise<CustomerKycStatusDto> {
    const existing = await this.prisma.customerKyc.findFirst({ where: { userId } });

    if (
      existing &&
      (existing.status === CustomerKycStatus.PENDING_REVIEW ||
        existing.status === CustomerKycStatus.VERIFIED)
    ) {
      throw new ConflictDomainException(
        existing.status === CustomerKycStatus.VERIFIED
          ? 'Identity verification is already complete'
          : 'Identity verification is already pending review',
      );
    }

    const record = existing
      ? await this.prisma.customerKyc.update({
          where: { id: existing.id },
          data: {
            status: CustomerKycStatus.IN_PROGRESS,
            startedAt: existing.startedAt ?? new Date(),
          },
        })
      : await this.prisma.customerKyc.create({
          data: {
            userId,
            status: CustomerKycStatus.IN_PROGRESS,
            startedAt: new Date(),
          },
        });

    await this.auditService.record(
      KYC_AUDIT_ACTIONS.CUSTOMER_KYC_STARTED,
      { ...context, userId },
      { resource: 'customer_kyc', resourceId: record.id },
    );

    const user = await this.prisma.user.findFirstOrThrow({
      where: { id: userId },
      select: { phoneVerifiedAt: true, emailVerifiedAt: true, email: true },
    });
    return await this.withSignedDocumentUrls(toCustomerKycStatusDto(record, user));
  }

  public async submit(
    userId: string,
    dto: SubmitCustomerKycDto,
    context: AuditContext,
  ): Promise<CustomerKycStatusDto> {
    const existing = await this.prisma.customerKyc.findFirst({ where: { userId } });

    if (
      !existing ||
      (existing.status !== CustomerKycStatus.IN_PROGRESS &&
        existing.status !== CustomerKycStatus.REQUIRES_RESUBMISSION)
    ) {
      throw new ConflictDomainException(
        'Call POST /kyc/me/start before submitting documents, or you already have a submission under review',
      );
    }

    // DPX-STORAGE-001 (D) — only accept DrippleX-controlled storage URLs owned
    // by this user; reject arbitrary external / foreign-bucket / cross-user URLs.
    this.storageAssets.assertOwned(dto.frontImageUrl, { folder: KYC_FOLDER, ownerId: userId });
    this.storageAssets.assertOwnedOptional(dto.backImageUrl, {
      folder: KYC_FOLDER,
      ownerId: userId,
    });
    this.storageAssets.assertOwnedOptional(dto.selfieUrl, { folder: KYC_FOLDER, ownerId: userId });

    const record = await this.prisma.customerKyc.update({
      where: { id: existing.id },
      data: {
        documentType: dto.documentType,
        documentNumber: dto.documentNumber ?? null,
        frontImageUrl: dto.frontImageUrl,
        backImageUrl: dto.backImageUrl ?? null,
        selfieUrl: dto.selfieUrl ?? null,
        status: CustomerKycStatus.PENDING_REVIEW,
        submittedAt: new Date(),
        // A resubmission clears the previous rejection/remarks context.
        remarks: null,
      },
    });

    await this.auditService.record(
      KYC_AUDIT_ACTIONS.CUSTOMER_KYC_SUBMITTED,
      { ...context, userId },
      {
        resource: 'customer_kyc',
        resourceId: record.id,
        metadata: { documentType: dto.documentType },
      },
    );

    const user = await this.prisma.user.findFirstOrThrow({
      where: { id: userId },
      select: { phoneVerifiedAt: true, emailVerifiedAt: true, email: true },
    });
    return await this.withSignedDocumentUrls(toCustomerKycStatusDto(record, user));
  }

  public async listPendingReview(): Promise<AdminCustomerKycListItemDto[]> {
    const records = await this.prisma.customerKyc.findMany({
      where: { status: CustomerKycStatus.PENDING_REVIEW },
      orderBy: { submittedAt: 'asc' },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });

    return records.map((record) => ({
      id: record.id,
      userId: record.userId,
      userFullName: `${record.user.firstName} ${record.user.lastName}`.trim(),
      userEmail: record.user.email,
      status: record.status,
      documentType: record.documentType,
      submittedAt: record.submittedAt ? record.submittedAt.toISOString() : null,
      createdAt: record.createdAt.toISOString(),
    }));
  }

  public async getForUser(targetUserId: string): Promise<CustomerKycStatusDto> {
    const [record, user] = await Promise.all([
      this.prisma.customerKyc.findFirst({ where: { userId: targetUserId } }),
      this.prisma.user.findFirstOrThrow({
        where: { id: targetUserId },
        select: { phoneVerifiedAt: true, emailVerifiedAt: true, email: true },
      }),
    ]);

    return await this.withSignedDocumentUrls(toCustomerKycStatusDto(record, user));
  }

  public async verify(
    kycId: string,
    reviewerId: string,
    remarks: string | undefined,
    context: AuditContext,
  ): Promise<CustomerKycStatusDto> {
    const existing = await this.requirePendingReview(kycId);
    const now = new Date();

    const record = await this.prisma.customerKyc.update({
      where: { id: existing.id },
      data: {
        status: CustomerKycStatus.VERIFIED,
        reviewedBy: reviewerId,
        reviewedAt: now,
        reviewStartedAt: existing.reviewStartedAt ?? now,
        verifiedAt: now,
        remarks: remarks ?? null,
      },
    });

    await this.auditService.record(
      KYC_AUDIT_ACTIONS.CUSTOMER_KYC_VERIFIED,
      { ...context, userId: reviewerId },
      {
        resource: 'customer_kyc',
        resourceId: record.id,
        metadata: { customerUserId: record.userId },
      },
    );

    return await this.getForUser(record.userId);
  }

  public async reject(
    kycId: string,
    reviewerId: string,
    remarks: string,
    context: AuditContext,
  ): Promise<CustomerKycStatusDto> {
    const existing = await this.requirePendingReview(kycId);
    const now = new Date();

    const record = await this.prisma.customerKyc.update({
      where: { id: existing.id },
      data: {
        status: CustomerKycStatus.REJECTED,
        reviewedBy: reviewerId,
        reviewedAt: now,
        reviewStartedAt: existing.reviewStartedAt ?? now,
        rejectedAt: now,
        remarks,
      },
    });

    await this.auditService.record(
      KYC_AUDIT_ACTIONS.CUSTOMER_KYC_REJECTED,
      { ...context, userId: reviewerId },
      {
        resource: 'customer_kyc',
        resourceId: record.id,
        metadata: { customerUserId: record.userId },
      },
    );

    return await this.getForUser(record.userId);
  }

  public async requestResubmission(
    kycId: string,
    reviewerId: string,
    remarks: string,
    context: AuditContext,
  ): Promise<CustomerKycStatusDto> {
    const existing = await this.requirePendingReview(kycId);
    const now = new Date();

    const record = await this.prisma.customerKyc.update({
      where: { id: existing.id },
      data: {
        status: CustomerKycStatus.REQUIRES_RESUBMISSION,
        reviewedBy: reviewerId,
        reviewedAt: now,
        reviewStartedAt: existing.reviewStartedAt ?? now,
        remarks,
      },
    });

    await this.auditService.record(
      KYC_AUDIT_ACTIONS.CUSTOMER_KYC_RESUBMISSION_REQUESTED,
      { ...context, userId: reviewerId },
      {
        resource: 'customer_kyc',
        resourceId: record.id,
        metadata: { customerUserId: record.userId },
      },
    );

    return await this.getForUser(record.userId);
  }

  private async requirePendingReview(kycId: string): Promise<CustomerKyc> {
    const existing = await this.prisma.customerKyc.findFirst({ where: { id: kycId } });
    if (!existing) {
      throw new NotFoundDomainException('KYC submission not found');
    }
    if (existing.status !== CustomerKycStatus.PENDING_REVIEW) {
      throw new ConflictDomainException('KYC submission is not pending review');
    }
    return existing;
  }
}
