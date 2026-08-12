import { Injectable } from '@nestjs/common';
import {
  BusinessStatus,
  BusinessVerificationStatus,
  KycVerificationStatus,
  MerchantStatus,
  OnboardingStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

import type {
  AuditSummaryItem,
  CreateBankAccountInput,
  CreateBusinessInput,
  CreateKycInput,
  ListMerchantsFilter,
  MerchantAdminDetail,
  MerchantProfileWithUser,
  MerchantsRepository,
  SetBusinessPauseStateInput,
  UpdateBusinessInput,
} from './merchants.repository';
import type { BankAccount, Business, MerchantKyc } from '@prisma/client';

const adminDetailInclude = {
  user: true,
  onboarding: { select: { id: true, status: true } },
} as const;

@Injectable()
export class PrismaMerchantsRepository implements MerchantsRepository {
  constructor(private readonly prisma: PrismaService) {}

  public async findMerchantProfileByUserId(
    userId: string,
  ): Promise<MerchantProfileWithUser | null> {
    return await this.prisma.merchantProfile.findFirst({
      where: { userId, deletedAt: null },
      include: { user: true },
    });
  }

  public async findMerchantProfileById(id: string): Promise<MerchantProfileWithUser | null> {
    return await this.prisma.merchantProfile.findFirst({
      where: { id, deletedAt: null },
      include: { user: true },
    });
  }

  public async findBusinessByMerchantId(merchantId: string): Promise<Business | null> {
    return await this.prisma.business.findUnique({ where: { merchantId } });
  }

  public async findBusinessByRegistrationNumber(
    registrationNumber: string,
  ): Promise<Business | null> {
    return await this.prisma.business.findUnique({
      where: { registrationNumber },
    });
  }

  public async createBusiness(input: CreateBusinessInput): Promise<Business> {
    return await this.prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          merchantId: input.merchantId,
          businessName: input.businessName,
          businessType: input.businessType,
          registrationNumber: input.registrationNumber,
          email: input.email,
          phone: input.phone,
          country: input.country,
          state: input.state,
          city: input.city,
          address: input.address,
          latitude: input.latitude,
          longitude: input.longitude,
          status: input.status,
          verificationStatus: input.verificationStatus,
          ...(input.taxNumber !== undefined ? { taxNumber: input.taxNumber } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
          ...(input.coverPhotoUrl !== undefined ? { coverPhotoUrl: input.coverPhotoUrl } : {}),
          ...(input.operatingHours !== undefined
            ? { operatingHours: input.operatingHours as Prisma.InputJsonValue }
            : {}),
        },
      });

      await tx.merchantProfile.update({
        where: { userId: input.merchantId },
        data: { status: MerchantStatus.UNDER_REVIEW },
      });

      await tx.merchantOnboarding.updateMany({
        where: { merchantProfile: { userId: input.merchantId } },
        data: { status: OnboardingStatus.SUBMITTED },
      });

      return business;
    });
  }

  public async updateBusiness(id: string, input: UpdateBusinessInput): Promise<Business> {
    return await this.prisma.business.update({
      where: { id },
      data: {
        ...(input.businessName !== undefined ? { businessName: input.businessName } : {}),
        ...(input.businessType !== undefined ? { businessType: input.businessType } : {}),
        ...(input.registrationNumber !== undefined
          ? { registrationNumber: input.registrationNumber }
          : {}),
        ...(input.taxNumber !== undefined ? { taxNumber: input.taxNumber } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.country !== undefined ? { country: input.country } : {}),
        ...(input.state !== undefined ? { state: input.state } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
        ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
        ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
        ...(input.coverPhotoUrl !== undefined ? { coverPhotoUrl: input.coverPhotoUrl } : {}),
        ...(input.operatingHours !== undefined
          ? {
              operatingHours:
                input.operatingHours === null
                  ? Prisma.JsonNull
                  : (input.operatingHours as Prisma.InputJsonValue),
            }
          : {}),
      },
    });
  }

  public async setBusinessPauseState(
    id: string,
    input: SetBusinessPauseStateInput,
  ): Promise<Business> {
    return await this.prisma.business.update({
      where: { id },
      data: {
        status: input.status,
        pausedAt: input.pausedAt,
        pauseReason: input.pauseReason,
      },
    });
  }

  public async createKyc(input: CreateKycInput): Promise<MerchantKyc> {
    return await this.prisma.merchantKyc.create({
      data: {
        merchantId: input.merchantId,
        businessId: input.businessId,
        documentType: input.documentType,
        documentNumber: input.documentNumber,
        frontImage: input.frontImage,
        verificationStatus: KycVerificationStatus.PENDING,
        ...(input.backImage !== undefined ? { backImage: input.backImage } : {}),
        ...(input.selfieImage !== undefined ? { selfieImage: input.selfieImage } : {}),
      },
    });
  }

  public async findLatestKycByMerchantId(merchantId: string): Promise<MerchantKyc | null> {
    return await this.prisma.merchantKyc.findFirst({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async findActivePendingKyc(merchantId: string): Promise<MerchantKyc | null> {
    return await this.prisma.merchantKyc.findFirst({
      where: {
        merchantId,
        verificationStatus: KycVerificationStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async listKycByMerchantId(merchantId: string): Promise<MerchantKyc[]> {
    return await this.prisma.merchantKyc.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async verifyKyc(id: string, reviewedBy: string, remarks?: string): Promise<MerchantKyc> {
    return await this.prisma.merchantKyc.update({
      where: { id },
      data: {
        verificationStatus: KycVerificationStatus.VERIFIED,
        reviewedBy,
        reviewedAt: new Date(),
        remarks: remarks ?? null,
      },
    });
  }

  public async rejectKyc(id: string, reviewedBy: string, remarks: string): Promise<MerchantKyc> {
    return await this.prisma.merchantKyc.update({
      where: { id },
      data: {
        verificationStatus: KycVerificationStatus.REJECTED,
        reviewedBy,
        reviewedAt: new Date(),
        remarks,
      },
    });
  }

  public async createBankAccount(input: CreateBankAccountInput): Promise<BankAccount> {
    return await this.prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.bankAccount.updateMany({
          where: { merchantId: input.merchantId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const existingCount = await tx.bankAccount.count({
        where: { merchantId: input.merchantId },
      });

      return await tx.bankAccount.create({
        data: {
          merchantId: input.merchantId,
          bankName: input.bankName,
          accountName: input.accountName,
          accountNumber: input.accountNumber,
          currency: input.currency,
          isDefault: input.isDefault || existingCount === 0,
        },
      });
    });
  }

  public async findBankAccountById(id: string): Promise<BankAccount | null> {
    return await this.prisma.bankAccount.findUnique({ where: { id } });
  }

  public async findBankAccountByNumber(
    merchantId: string,
    accountNumber: string,
  ): Promise<BankAccount | null> {
    return await this.prisma.bankAccount.findUnique({
      where: {
        merchantId_accountNumber: { merchantId, accountNumber },
      },
    });
  }

  public async listBankAccounts(merchantId: string): Promise<BankAccount[]> {
    return await this.prisma.bankAccount.findMany({
      where: { merchantId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  public async setDefaultBankAccount(merchantId: string, accountId: string): Promise<BankAccount> {
    return await this.prisma.$transaction(async (tx) => {
      await tx.bankAccount.updateMany({
        where: { merchantId, isDefault: true },
        data: { isDefault: false },
      });
      return await tx.bankAccount.update({
        where: { id: accountId },
        data: { isDefault: true },
      });
    });
  }

  public async listMerchants(
    filter: ListMerchantsFilter,
  ): Promise<{ items: MerchantAdminDetail[]; total: number }> {
    const where: Prisma.MerchantProfileWhereInput = {
      deletedAt: null,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.country || filter.state || filter.verificationStatus
        ? {
            user: {
              businesses: {
                some: {
                  ...(filter.country ? { country: filter.country } : {}),
                  ...(filter.state ? { state: filter.state } : {}),
                  ...(filter.verificationStatus
                    ? { verificationStatus: filter.verificationStatus }
                    : {}),
                },
              },
            },
          }
        : {}),
      ...(filter.createdFrom || filter.createdTo
        ? {
            createdAt: {
              ...(filter.createdFrom ? { gte: filter.createdFrom } : {}),
              ...(filter.createdTo ? { lte: filter.createdTo } : {}),
            },
          }
        : {}),
    };

    const [profiles, total] = await this.prisma.$transaction([
      this.prisma.merchantProfile.findMany({
        where,
        include: adminDetailInclude,
        skip: filter.skip,
        take: filter.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.merchantProfile.count({ where }),
    ]);

    const items = await Promise.all(
      profiles.map(async (profile) => await this.hydrateAdminDetail(profile)),
    );

    return { items, total };
  }

  public async getMerchantAdminDetail(merchantUserId: string): Promise<MerchantAdminDetail | null> {
    const profile = await this.prisma.merchantProfile.findFirst({
      where: { userId: merchantUserId, deletedAt: null },
      include: adminDetailInclude,
    });
    if (!profile) {
      return null;
    }
    return await this.hydrateAdminDetail(profile);
  }

  public async updateMerchantLifecycle(input: {
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
  }): Promise<MerchantAdminDetail> {
    await this.prisma.$transaction(async (tx) => {
      await tx.merchantProfile.update({
        where: { userId: input.merchantUserId },
        data: {
          status: input.status,
          isApproved: input.isApproved,
          ...(input.approvedAt !== undefined ? { approvedAt: input.approvedAt } : {}),
          ...(input.approvedBy !== undefined ? { approvedBy: input.approvedBy } : {}),
          ...(input.rejectedReason !== undefined ? { rejectedReason: input.rejectedReason } : {}),
          ...(input.suspendedAt !== undefined ? { suspendedAt: input.suspendedAt } : {}),
        },
      });

      if (
        input.businessStatus !== undefined ||
        input.businessVerificationStatus !== undefined ||
        input.businessApprovedBy !== undefined ||
        input.businessApprovedAt !== undefined ||
        input.businessRejectedReason !== undefined
      ) {
        await tx.business.updateMany({
          where: { merchantId: input.merchantUserId },
          data: {
            ...(input.businessStatus !== undefined ? { status: input.businessStatus } : {}),
            ...(input.businessVerificationStatus !== undefined
              ? { verificationStatus: input.businessVerificationStatus }
              : {}),
            ...(input.businessApprovedBy !== undefined
              ? { approvedBy: input.businessApprovedBy }
              : {}),
            ...(input.businessApprovedAt !== undefined
              ? { approvedAt: input.businessApprovedAt }
              : {}),
            ...(input.businessRejectedReason !== undefined
              ? { rejectedReason: input.businessRejectedReason }
              : {}),
          },
        });
      }

      if (input.onboardingStatus !== undefined) {
        await tx.merchantOnboarding.updateMany({
          where: { merchantProfile: { userId: input.merchantUserId } },
          data: { status: input.onboardingStatus },
        });
      }
    });

    const detail = await this.getMerchantAdminDetail(input.merchantUserId);
    if (!detail) {
      throw new Error('Merchant not found after lifecycle update');
    }
    return detail;
  }

  public async getAuditSummary(merchantUserId: string): Promise<AuditSummaryItem[]> {
    const rows = await this.prisma.auditLog.groupBy({
      by: ['action'],
      where: {
        OR: [{ userId: merchantUserId }, { resourceId: merchantUserId }],
        action: { startsWith: 'merchant.' },
      },
      _count: { action: true },
      _max: { createdAt: true },
    });

    return rows.map((row) => ({
      action: row.action,
      count: row._count.action,
      lastAt: row._max.createdAt,
    }));
  }

  private async hydrateAdminDetail(
    profile: MerchantProfileWithUser & {
      onboarding: { id: string; status: OnboardingStatus } | null;
    },
  ): Promise<MerchantAdminDetail> {
    const [business, kycDocuments, bankAccounts] = await Promise.all([
      this.prisma.business.findUnique({ where: { merchantId: profile.userId } }),
      this.prisma.merchantKyc.findMany({
        where: { merchantId: profile.userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.bankAccount.findMany({
        where: { merchantId: profile.userId },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    return {
      ...profile,
      business,
      kycDocuments,
      bankAccounts,
    };
  }
}
