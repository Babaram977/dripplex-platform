import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  BusinessStatus,
  BusinessVerificationStatus,
  KycVerificationStatus,
  MerchantStatus,
  OnboardingStatus,
} from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import {
  ConflictDomainException,
  EmailNotVerifiedDomainException,
  ForbiddenDomainException,
  NotFoundDomainException,
  PhoneNotVerifiedDomainException,
  ValidationDomainException,
} from '../common/exceptions/domain.exception';
import { DomainEventBus } from '../events/domain-event-bus';
import { DOMAIN_EVENTS } from '../events/domain-events';
import {
  NOTIFICATION_SERVICE,
  type NotificationService,
} from '../notifications/notification.service';

import { MERCHANT_AUDIT_ACTIONS } from './merchant.constants';
import {
  toBankAccountDto,
  toBusinessDto,
  toMerchantKycDto,
  toMerchantProfileDto,
} from './merchant.mapper';
import {
  MERCHANTS_REPOSITORY,
  type MerchantAdminDetail,
  type MerchantProfileWithUser,
  type MerchantsRepository,
} from './repositories/merchants.repository';

import type { CreateBankAccountDto } from './dto/create-bank-account.dto';
import type { CreateBusinessDto } from './dto/create-business.dto';
import type { ListMerchantsQueryDto } from './dto/list-merchants-query.dto';
import type { SubmitKycDto } from './dto/submit-kyc.dto';
import type { UpdateBusinessDto } from './dto/update-business.dto';
import type { AuditContext } from '../audit/audit.service';
import type {
  BankAccountDto,
  BusinessDto,
  MerchantApprovalDto,
  MerchantKycDto,
  MerchantProfileDto,
} from '@dripplex/types';

@Injectable()
export class MerchantsService {
  constructor(
    @Inject(MERCHANTS_REPOSITORY)
    private readonly merchantsRepository: MerchantsRepository,
    private readonly auditService: AuditService,
    @Inject(NOTIFICATION_SERVICE)
    private readonly notifications: NotificationService,
    @Optional()
    private readonly eventBus?: DomainEventBus,
  ) {}

  public async createBusiness(
    merchantUserId: string,
    dto: CreateBusinessDto,
    context: AuditContext,
  ): Promise<BusinessDto> {
    const profile = await this.requireMerchantProfile(merchantUserId);
    this.assertIdentityVerified(profile.user);

    const existing = await this.merchantsRepository.findBusinessByMerchantId(merchantUserId);
    if (existing && existing.status !== BusinessStatus.SUSPENDED) {
      throw new ConflictDomainException('Merchant already has an active business');
    }
    if (existing) {
      throw new ConflictDomainException('Merchant already has a business profile');
    }

    const duplicateReg = await this.merchantsRepository.findBusinessByRegistrationNumber(
      dto.registrationNumber.trim().toUpperCase(),
    );
    if (duplicateReg) {
      throw new ConflictDomainException('Registration/CAC number already registered');
    }

    this.assertValidCoordinates(dto.latitude, dto.longitude);
    this.assertAddress(dto);

    const business = await this.merchantsRepository.createBusiness({
      merchantId: merchantUserId,
      businessName: dto.businessName.trim(),
      businessType: dto.businessType,
      registrationNumber: dto.registrationNumber.trim().toUpperCase(),
      email: dto.email.trim().toLowerCase(),
      phone: dto.phone.trim(),
      country: dto.country.trim(),
      state: dto.state.trim(),
      city: dto.city.trim(),
      address: dto.address.trim(),
      latitude: dto.latitude,
      longitude: dto.longitude,
      status: BusinessStatus.SUBMITTED,
      verificationStatus: BusinessVerificationStatus.UNDER_REVIEW,
      ...(dto.taxNumber !== undefined ? { taxNumber: dto.taxNumber.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
      ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
      ...(dto.coverPhotoUrl !== undefined ? { coverPhotoUrl: dto.coverPhotoUrl } : {}),
    });

    await this.auditService.record(
      MERCHANT_AUDIT_ACTIONS.BUSINESS_CREATED,
      { ...context, userId: merchantUserId },
      {
        resource: 'business',
        resourceId: business.id,
        metadata: { businessName: business.businessName },
      },
    );

    await this.notifications.notifyMerchantLifecycle({
      email: profile.user.email,
      event: 'business_submitted',
      merchantId: merchantUserId,
      businessName: business.businessName,
    });

    return toBusinessDto(business);
  }

  public async getBusiness(merchantUserId: string): Promise<BusinessDto> {
    await this.requireMerchantProfile(merchantUserId);
    const business = await this.merchantsRepository.findBusinessByMerchantId(merchantUserId);
    if (!business) {
      throw new NotFoundDomainException('Business not found');
    }
    return toBusinessDto(business);
  }

  public async updateBusiness(
    merchantUserId: string,
    dto: UpdateBusinessDto,
    context: AuditContext,
  ): Promise<BusinessDto> {
    await this.requireMerchantProfile(merchantUserId);
    const business = await this.merchantsRepository.findBusinessByMerchantId(merchantUserId);
    if (!business) {
      throw new NotFoundDomainException('Business not found');
    }

    if (business.status === BusinessStatus.SUSPENDED) {
      throw new ForbiddenDomainException('Suspended businesses cannot be updated');
    }

    if (dto.registrationNumber) {
      const normalized = dto.registrationNumber.trim().toUpperCase();
      const duplicate = await this.merchantsRepository.findBusinessByRegistrationNumber(normalized);
      if (duplicate && duplicate.id !== business.id) {
        throw new ConflictDomainException('Registration/CAC number already registered');
      }
    }

    if (dto.latitude !== undefined || dto.longitude !== undefined) {
      this.assertValidCoordinates(
        dto.latitude ?? Number(business.latitude),
        dto.longitude ?? Number(business.longitude),
      );
    }

    if (
      dto.address !== undefined ||
      dto.city !== undefined ||
      dto.state !== undefined ||
      dto.country !== undefined
    ) {
      this.assertAddress({
        address: dto.address ?? business.address,
        city: dto.city ?? business.city,
        state: dto.state ?? business.state,
        country: dto.country ?? business.country,
      });
    }

    const updated = await this.merchantsRepository.updateBusiness(business.id, {
      ...(dto.businessName !== undefined ? { businessName: dto.businessName.trim() } : {}),
      ...(dto.businessType !== undefined ? { businessType: dto.businessType } : {}),
      ...(dto.registrationNumber !== undefined
        ? { registrationNumber: dto.registrationNumber.trim().toUpperCase() }
        : {}),
      ...(dto.taxNumber !== undefined ? { taxNumber: dto.taxNumber.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
      ...(dto.email !== undefined ? { email: dto.email.trim().toLowerCase() } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
      ...(dto.country !== undefined ? { country: dto.country.trim() } : {}),
      ...(dto.state !== undefined ? { state: dto.state.trim() } : {}),
      ...(dto.city !== undefined ? { city: dto.city.trim() } : {}),
      ...(dto.address !== undefined ? { address: dto.address.trim() } : {}),
      ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
      ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
      ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
      ...(dto.coverPhotoUrl !== undefined ? { coverPhotoUrl: dto.coverPhotoUrl } : {}),
    });

    await this.auditService.record(
      MERCHANT_AUDIT_ACTIONS.BUSINESS_UPDATED,
      { ...context, userId: merchantUserId },
      {
        resource: 'business',
        resourceId: updated.id,
        metadata: { fields: Object.keys(dto) },
      },
    );

    return toBusinessDto(updated);
  }

  public async pauseStore(
    merchantUserId: string,
    reason: string | undefined,
    context: AuditContext,
  ): Promise<BusinessDto> {
    await this.requireMerchantProfile(merchantUserId);
    const business = await this.merchantsRepository.findBusinessByMerchantId(merchantUserId);
    if (!business) {
      throw new NotFoundDomainException('Business not found');
    }
    if (business.status !== BusinessStatus.ACTIVE) {
      throw new ValidationDomainException('Only active stores can be paused');
    }

    const updated = await this.merchantsRepository.setBusinessPauseState(business.id, {
      status: BusinessStatus.PAUSED,
      pausedAt: new Date(),
      pauseReason: reason ?? null,
    });

    await this.auditService.record(
      MERCHANT_AUDIT_ACTIONS.STORE_PAUSED,
      { ...context, userId: merchantUserId },
      { resource: 'business', resourceId: updated.id, metadata: { reason: reason ?? null } },
    );

    await this.eventBus?.emit(
      DOMAIN_EVENTS.STORE_PAUSED,
      { merchantId: merchantUserId, businessId: updated.id, reason: reason ?? null },
      { actorUserId: merchantUserId },
    );

    return toBusinessDto(updated);
  }

  public async resumeStore(merchantUserId: string, context: AuditContext): Promise<BusinessDto> {
    await this.requireMerchantProfile(merchantUserId);
    const business = await this.merchantsRepository.findBusinessByMerchantId(merchantUserId);
    if (!business) {
      throw new NotFoundDomainException('Business not found');
    }
    if (business.status !== BusinessStatus.PAUSED) {
      throw new ValidationDomainException('Only paused stores can be resumed');
    }

    const updated = await this.merchantsRepository.setBusinessPauseState(business.id, {
      status: BusinessStatus.ACTIVE,
      pausedAt: null,
      pauseReason: null,
    });

    await this.auditService.record(
      MERCHANT_AUDIT_ACTIONS.STORE_RESUMED,
      { ...context, userId: merchantUserId },
      { resource: 'business', resourceId: updated.id, metadata: {} },
    );

    await this.eventBus?.emit(
      DOMAIN_EVENTS.STORE_RESUMED,
      { merchantId: merchantUserId, businessId: updated.id },
      { actorUserId: merchantUserId },
    );

    return toBusinessDto(updated);
  }

  public async submitKyc(
    merchantUserId: string,
    dto: SubmitKycDto,
    context: AuditContext,
  ): Promise<MerchantKycDto> {
    const profile = await this.requireMerchantProfile(merchantUserId);
    this.assertIdentityVerified(profile.user);

    const business = await this.merchantsRepository.findBusinessByMerchantId(merchantUserId);
    if (!business) {
      throw new NotFoundDomainException('Create a business before submitting KYC');
    }

    const pending = await this.merchantsRepository.findActivePendingKyc(merchantUserId);
    if (pending) {
      throw new ConflictDomainException('An active KYC submission is already pending review');
    }

    const kyc = await this.merchantsRepository.createKyc({
      merchantId: merchantUserId,
      businessId: business.id,
      documentType: dto.documentType,
      documentNumber: dto.documentNumber.trim(),
      frontImage: dto.frontImage,
      ...(dto.backImage !== undefined ? { backImage: dto.backImage } : {}),
      ...(dto.selfieImage !== undefined ? { selfieImage: dto.selfieImage } : {}),
    });

    await this.auditService.record(
      MERCHANT_AUDIT_ACTIONS.KYC_SUBMITTED,
      { ...context, userId: merchantUserId },
      {
        resource: 'merchant_kyc',
        resourceId: kyc.id,
        metadata: { documentType: kyc.documentType },
      },
    );

    await this.notifications.notifyMerchantLifecycle({
      email: profile.user.email,
      event: 'kyc_submitted',
      merchantId: merchantUserId,
      documentType: kyc.documentType,
    });

    return toMerchantKycDto(kyc);
  }

  public async getKycStatus(merchantUserId: string): Promise<{
    latest: MerchantKycDto | null;
    items: MerchantKycDto[];
  }> {
    await this.requireMerchantProfile(merchantUserId);
    const items = await this.merchantsRepository.listKycByMerchantId(merchantUserId);
    return {
      latest: items[0] ? toMerchantKycDto(items[0]) : null,
      items: items.map(toMerchantKycDto),
    };
  }

  public async createBankAccount(
    merchantUserId: string,
    dto: CreateBankAccountDto,
    context: AuditContext,
  ): Promise<BankAccountDto> {
    await this.requireMerchantProfile(merchantUserId);

    const duplicate = await this.merchantsRepository.findBankAccountByNumber(
      merchantUserId,
      dto.accountNumber,
    );
    if (duplicate) {
      throw new ConflictDomainException('Bank account number already exists for this merchant');
    }

    const account = await this.merchantsRepository.createBankAccount({
      merchantId: merchantUserId,
      bankName: dto.bankName.trim(),
      accountName: dto.accountName.trim(),
      accountNumber: dto.accountNumber,
      currency: (dto.currency ?? 'NGN').toUpperCase(),
      isDefault: dto.isDefault ?? false,
    });

    await this.auditService.record(
      MERCHANT_AUDIT_ACTIONS.BANK_CREATED,
      { ...context, userId: merchantUserId },
      {
        resource: 'bank_account',
        resourceId: account.id,
        metadata: { bankName: account.bankName },
      },
    );

    return toBankAccountDto(account);
  }

  public async listBankAccounts(merchantUserId: string): Promise<BankAccountDto[]> {
    await this.requireMerchantProfile(merchantUserId);
    const accounts = await this.merchantsRepository.listBankAccounts(merchantUserId);
    return accounts.map(toBankAccountDto);
  }

  public async setDefaultBankAccount(
    merchantUserId: string,
    accountId: string,
    context: AuditContext,
  ): Promise<BankAccountDto> {
    await this.requireMerchantProfile(merchantUserId);
    const account = await this.merchantsRepository.findBankAccountById(accountId);
    if (account?.merchantId !== merchantUserId) {
      throw new NotFoundDomainException('Bank account not found');
    }

    const updated = await this.merchantsRepository.setDefaultBankAccount(merchantUserId, accountId);

    await this.auditService.record(
      MERCHANT_AUDIT_ACTIONS.BANK_UPDATED,
      { ...context, userId: merchantUserId },
      {
        resource: 'bank_account',
        resourceId: updated.id,
        metadata: { isDefault: true },
      },
    );

    return toBankAccountDto(updated);
  }

  public async listMerchants(query: ListMerchantsQueryDto): Promise<{
    items: MerchantProfileDto[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const skip = (query.page - 1) * query.limit;
    const { items, total } = await this.merchantsRepository.listMerchants({
      skip,
      take: query.limit,
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.verificationStatus !== undefined
        ? { verificationStatus: query.verificationStatus }
        : {}),
      ...(query.country !== undefined ? { country: query.country } : {}),
      ...(query.state !== undefined ? { state: query.state } : {}),
      ...(query.dateFrom !== undefined ? { createdFrom: new Date(query.dateFrom) } : {}),
      ...(query.dateTo !== undefined ? { createdTo: new Date(query.dateTo) } : {}),
    });

    return {
      items: items.map((item) =>
        toMerchantProfileDto({
          profile: item,
          user: item.user,
          business: item.business,
          kyc: item.kycDocuments[0] ?? null,
          bankAccounts: item.bankAccounts,
        }),
      ),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  public async getMerchantProfile(merchantUserId: string): Promise<{
    profile: MerchantProfileDto;
    auditSummary: { action: string; count: number; lastAt: string | null }[];
  }> {
    const detail = await this.merchantsRepository.getMerchantAdminDetail(merchantUserId);
    if (!detail) {
      throw new NotFoundDomainException('Merchant not found');
    }

    const auditSummary = await this.merchantsRepository.getAuditSummary(merchantUserId);

    return {
      profile: toMerchantProfileDto({
        profile: detail,
        user: detail.user,
        business: detail.business,
        kyc: detail.kycDocuments[0] ?? null,
        bankAccounts: detail.bankAccounts,
      }),
      auditSummary: auditSummary.map((row) => ({
        action: row.action,
        count: row.count,
        lastAt: row.lastAt ? row.lastAt.toISOString() : null,
      })),
    };
  }

  public async verifyKyc(
    merchantUserId: string,
    adminUserId: string,
    remarks: string | undefined,
    context: AuditContext,
  ): Promise<MerchantKycDto> {
    const pending = await this.merchantsRepository.findActivePendingKyc(merchantUserId);
    if (!pending) {
      throw new NotFoundDomainException('No pending KYC submission found');
    }

    const verified = await this.merchantsRepository.verifyKyc(pending.id, adminUserId, remarks);

    await this.auditService.record(
      MERCHANT_AUDIT_ACTIONS.KYC_VERIFIED,
      { ...context, userId: adminUserId },
      {
        resource: 'merchant_kyc',
        resourceId: verified.id,
        metadata: { merchantId: merchantUserId },
      },
    );

    return toMerchantKycDto(verified);
  }

  public async rejectKyc(
    merchantUserId: string,
    adminUserId: string,
    remarks: string,
    context: AuditContext,
  ): Promise<MerchantKycDto> {
    if (!remarks.trim() || remarks.trim().length < 3) {
      throw new ValidationDomainException('KYC rejection remarks are required');
    }

    const pending = await this.merchantsRepository.findActivePendingKyc(merchantUserId);
    if (!pending) {
      throw new NotFoundDomainException('No pending KYC submission found');
    }

    const rejected = await this.merchantsRepository.rejectKyc(
      pending.id,
      adminUserId,
      remarks.trim(),
    );

    await this.auditService.record(
      MERCHANT_AUDIT_ACTIONS.KYC_REJECTED,
      { ...context, userId: adminUserId },
      {
        resource: 'merchant_kyc',
        resourceId: rejected.id,
        metadata: { merchantId: merchantUserId, remarks },
      },
    );

    return toMerchantKycDto(rejected);
  }

  public async approveMerchant(
    merchantUserId: string,
    adminUserId: string,
    context: AuditContext,
  ): Promise<MerchantApprovalDto> {
    const detail = await this.requireAdminDetail(merchantUserId);
    if (!detail.business) {
      throw new ValidationDomainException('Business profile is required before approval');
    }

    const latestKyc = detail.kycDocuments[0];
    if (latestKyc?.verificationStatus !== KycVerificationStatus.VERIFIED) {
      throw new ValidationDomainException('KYC must be verified before approval');
    }

    if (detail.status === MerchantStatus.APPROVED) {
      throw new ConflictDomainException('Merchant is already approved');
    }

    const now = new Date();
    const updated = await this.merchantsRepository.updateMerchantLifecycle({
      merchantUserId,
      status: MerchantStatus.APPROVED,
      isApproved: true,
      approvedAt: now,
      approvedBy: adminUserId,
      rejectedReason: null,
      suspendedAt: null,
      businessStatus: BusinessStatus.ACTIVE,
      businessVerificationStatus: BusinessVerificationStatus.VERIFIED,
      businessApprovedBy: adminUserId,
      businessApprovedAt: now,
      businessRejectedReason: null,
      onboardingStatus: OnboardingStatus.APPROVED,
    });

    await this.auditService.record(
      MERCHANT_AUDIT_ACTIONS.APPROVED,
      { ...context, userId: adminUserId },
      {
        resource: 'merchant',
        resourceId: merchantUserId,
        metadata: { approvedBy: adminUserId },
      },
    );

    await this.notifications.notifyMerchantLifecycle({
      email: updated.user.email,
      event: 'merchant_approved',
      merchantId: merchantUserId,
      ...(updated.business ? { businessName: updated.business.businessName } : {}),
    });

    return {
      merchantId: merchantUserId,
      status: MerchantStatus.APPROVED,
      approvedAt: now.toISOString(),
      approvedBy: adminUserId,
    };
  }

  public async rejectMerchant(
    merchantUserId: string,
    adminUserId: string,
    reason: string,
    context: AuditContext,
  ): Promise<MerchantApprovalDto> {
    const detail = await this.requireAdminDetail(merchantUserId);

    const updated = await this.merchantsRepository.updateMerchantLifecycle({
      merchantUserId,
      status: MerchantStatus.REJECTED,
      isApproved: false,
      approvedAt: null,
      approvedBy: adminUserId,
      rejectedReason: reason,
      businessRejectedReason: reason,
      onboardingStatus: OnboardingStatus.REJECTED,
      ...(detail.business
        ? {
            businessStatus: BusinessStatus.DRAFT,
            businessVerificationStatus: BusinessVerificationStatus.REJECTED,
          }
        : {}),
    });

    await this.auditService.record(
      MERCHANT_AUDIT_ACTIONS.REJECTED,
      { ...context, userId: adminUserId },
      {
        resource: 'merchant',
        resourceId: merchantUserId,
        metadata: { reason },
      },
    );

    await this.notifications.notifyMerchantLifecycle({
      email: updated.user.email,
      event: 'merchant_rejected',
      merchantId: merchantUserId,
      reason,
    });

    return {
      merchantId: merchantUserId,
      status: MerchantStatus.REJECTED,
      rejectedReason: reason,
      approvedBy: adminUserId,
    };
  }

  public async suspendMerchant(
    merchantUserId: string,
    adminUserId: string,
    reason: string,
    context: AuditContext,
  ): Promise<MerchantApprovalDto> {
    const detail = await this.requireAdminDetail(merchantUserId);
    if (detail.status !== MerchantStatus.APPROVED) {
      throw new ValidationDomainException('Only approved merchants can be suspended');
    }

    const now = new Date();
    const updated = await this.merchantsRepository.updateMerchantLifecycle({
      merchantUserId,
      status: MerchantStatus.SUSPENDED,
      isApproved: false,
      suspendedAt: now,
      rejectedReason: reason,
      ...(detail.business ? { businessStatus: BusinessStatus.SUSPENDED } : {}),
    });

    await this.auditService.record(
      MERCHANT_AUDIT_ACTIONS.SUSPENDED,
      { ...context, userId: adminUserId },
      {
        resource: 'merchant',
        resourceId: merchantUserId,
        metadata: { reason },
      },
    );

    await this.notifications.notifyMerchantLifecycle({
      email: updated.user.email,
      event: 'merchant_suspended',
      merchantId: merchantUserId,
      reason,
    });

    return {
      merchantId: merchantUserId,
      status: MerchantStatus.SUSPENDED,
      rejectedReason: reason,
      approvedBy: adminUserId,
    };
  }

  public async reactivateMerchant(
    merchantUserId: string,
    adminUserId: string,
    context: AuditContext,
  ): Promise<MerchantApprovalDto> {
    const detail = await this.requireAdminDetail(merchantUserId);
    if (detail.status !== MerchantStatus.SUSPENDED) {
      throw new ValidationDomainException('Only suspended merchants can be reactivated');
    }

    const now = new Date();
    const updated = await this.merchantsRepository.updateMerchantLifecycle({
      merchantUserId,
      status: MerchantStatus.APPROVED,
      isApproved: true,
      approvedAt: now,
      approvedBy: adminUserId,
      rejectedReason: null,
      suspendedAt: null,
      onboardingStatus: OnboardingStatus.APPROVED,
      ...(detail.business ? { businessStatus: BusinessStatus.ACTIVE } : {}),
    });

    await this.auditService.record(
      MERCHANT_AUDIT_ACTIONS.REACTIVATED,
      { ...context, userId: adminUserId },
      {
        resource: 'merchant',
        resourceId: merchantUserId,
      },
    );

    await this.notifications.notifyMerchantLifecycle({
      email: updated.user.email,
      event: 'merchant_reactivated',
      merchantId: merchantUserId,
      ...(updated.business ? { businessName: updated.business.businessName } : {}),
    });

    return {
      merchantId: merchantUserId,
      status: MerchantStatus.APPROVED,
      approvedAt: now.toISOString(),
      approvedBy: adminUserId,
    };
  }

  private async requireMerchantProfile(merchantUserId: string): Promise<MerchantProfileWithUser> {
    const profile = await this.merchantsRepository.findMerchantProfileByUserId(merchantUserId);
    if (!profile) {
      throw new NotFoundDomainException('Merchant profile not found');
    }
    return profile;
  }

  private async requireAdminDetail(merchantUserId: string): Promise<MerchantAdminDetail> {
    const detail = await this.merchantsRepository.getMerchantAdminDetail(merchantUserId);
    if (!detail) {
      throw new NotFoundDomainException('Merchant not found');
    }
    return detail;
  }

  private assertIdentityVerified(user: {
    emailVerifiedAt: Date | null;
    phoneVerifiedAt: Date | null;
  }): void {
    if (!user.emailVerifiedAt) {
      throw new EmailNotVerifiedDomainException(
        'Email must be verified before merchant onboarding',
      );
    }
    if (!user.phoneVerifiedAt) {
      throw new PhoneNotVerifiedDomainException(
        'Phone must be verified before merchant onboarding',
      );
    }
  }

  private assertValidCoordinates(latitude: number, longitude: number): void {
    if (
      Number.isNaN(latitude) ||
      Number.isNaN(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new ValidationDomainException('Invalid latitude/longitude coordinates');
    }
  }

  private assertAddress(input: {
    address: string;
    city: string;
    state: string;
    country: string;
  }): void {
    if (
      !input.address.trim() ||
      !input.city.trim() ||
      !input.state.trim() ||
      !input.country.trim()
    ) {
      throw new ValidationDomainException('Complete address is required');
    }
  }
}
